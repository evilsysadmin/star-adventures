#!/usr/bin/env python3
"""Make a strictly bounded, immutable K-47 GLB handoff from original source art.

This NEVER uploads or changes the game's published manifest. The output is a
candidate that Infra can verify byte-for-byte after real Chromium visual QA.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct

CDN = "https://assets.chess-studio.shadowops.dpdns.org/star-adventures/environment/"
SHA = re.compile(r"[0-9a-f]{40}\Z")
SLOTS = (
    ("south", "south-industrial-shell", ((3, 7), (4, 7), (5, 7), (6, 7), (7, 7)), (5, 0, 7)),
    ("archive", "west-archive-shell", ((0, 3), (0, 4), (0, 5)), (0, 0, 4)),
    ("east", "east-utilities-shell", ((8, 1), (8, 2), (8, 3)), (8, 0, 2)),
)
MAX_GLBS = 3
MAX_FILE = 4 * 1024 * 1024
MAX_PACK = 12 * 1024 * 1024


class CandidateError(ValueError):
    pass


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise CandidateError(reason)


def verify_glb(data: bytes) -> None:
    require(32 <= len(data) <= MAX_FILE, "GLB size outside 32 B..4 MiB")
    require(struct.unpack_from("<III", data) == (0x46546C67, 2, len(data)),
            "not a self-contained GLB 2.0")
    count, kind = struct.unpack_from("<II", data, 12)
    require(kind == 0x4E4F534A and count > 4 and count % 4 == 0
            and 20 + count + 8 <= len(data), "missing valid GLB JSON chunk")
    try:
        tree = json.loads(data[20:20 + count])
    except (UnicodeError, ValueError):
        raise CandidateError("invalid embedded glTF JSON") from None
    require(tree.get("asset", {}).get("version") == "2.0"
            and isinstance(tree.get("meshes"), list) and tree["meshes"],
            "model must contain glTF 2.0 meshes")
    require(not tree.get("extensionsRequired"),
            "required GLB extensions are not permitted")
    require(all("uri" not in x for x in tree.get("buffers", [])),
            "external GLB buffers are not permitted")
    require(all("uri" not in x and isinstance(x.get("bufferView"), int)
                for x in tree.get("images", [])),
            "external GLB textures are not permitted")
    bin_offset = 20 + count
    bin_size, bin_kind = struct.unpack_from("<II", data, bin_offset)
    require(bin_kind == 0x004E4942 and bin_size > 0
            and bin_offset + 8 + bin_size == len(data),
            "GLB must contain one complete embedded BIN chunk")


def validate_source(meta: dict, blob: bytes, slot: tuple) -> dict:
    stem, logical_id, footprint, anchor = slot
    require(isinstance(meta, dict) and meta.get("id") == logical_id,
            "wrong or missing model ID: " + stem)
    digest = hashlib.sha256(blob).hexdigest()
    require(meta.get("sha256") == digest and
            type(meta.get("bytes")) is int and meta["bytes"] == len(blob),
            "original-model SHA-256/size mismatch: " + stem)
    require(meta.get("anchor") == list(anchor)
            and meta.get("license") == "original"
            and isinstance(meta.get("source"), str)
            and 5 <= len(meta["source"]) <= 256
            and "original" in meta["source"].lower(),
            "missing original provenance or wrong anchor: " + stem)
    require(type(meta.get("authored_elements")) is int
            and meta["authored_elements"] >= 75
            and type(meta.get("materials")) is int and meta["materials"] >= 8,
            "not a complete source-authored building: " + stem)
    bounds = meta.get("bounds")
    require(isinstance(bounds, list) and len(bounds) == 2
            and all(isinstance(v, list) and len(v) == 3 for v in bounds)
            and all(type(n) in (int, float) and abs(n) < 1000
                    for v in bounds for n in v),
            "invalid GLB local bounds: " + stem)
    lower, upper = bounds
    require(all(lo <= hi for lo, hi in zip(lower, upper)),
            "inverted GLB bounds: " + stem)
    xlo = min(c[0] for c in footprint) - .56
    xhi = max(c[0] for c in footprint) + .56
    zlo = min(c[1] for c in footprint) - .56
    zhi = max(c[1] for c in footprint) + .56
    if logical_id == "west-archive-shell":
        xlo = -3.36
    require(anchor[0] + lower[0] >= xlo and
            anchor[0] + upper[0] <= xhi and
            anchor[2] + lower[2] >= zlo and
            anchor[2] + upper[2] <= zhi and
            -.4 <= anchor[1] + lower[1] <= anchor[1] + upper[1] <= 5,
            "model would exceed approved blocked footprint: " + stem)
    verify_glb(blob)
    name = logical_id + "-" + digest[:16] + ".glb"
    return {
        "id": logical_id,
        "footprint": [list(c) for c in footprint],
        "anchor": list(anchor),
        "status": "published",
        "asset": {
            "url": CDN + name,
            "sha256": digest,
            "bytes": len(blob),
            "license": "original",
            "source": meta["source"],
        },
    }


def assemble(fixtures: Path, output: Path, source_sha: str) -> dict:
    require(bool(SHA.fullmatch(source_sha)), "full 40-character source SHA required")
    require(fixtures.is_dir() and not fixtures.is_symlink(), "fixtures directory missing")
    require(not output.exists() and not output.is_symlink(),
            "output directory must not already exist")
    entries = []
    staged: list[tuple[str, bytes]] = []
    total = 0
    for slot in SLOTS:
        stem = slot[0]
        file = fixtures / ("k47-" + stem + "-candidate.glb")
        sidecar = file.with_suffix(".json")
        require(file.is_file() and not file.is_symlink()
                and sidecar.is_file() and not sidecar.is_symlink(),
                "original GLB and sidecar are both required: " + stem)
        try:
            blob = file.read_bytes()
            meta = json.loads(sidecar.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, ValueError):
            raise CandidateError("invalid original GLB metadata: " + stem) from None
        entry = validate_source(meta, blob, slot)
        key = entry["asset"]["url"].removeprefix(CDN)
        staged.append((key, blob))
        entries.append(entry)
        total += len(blob)
    require(len(staged) == MAX_GLBS and total <= MAX_PACK, "wrong candidate pack budget")
    manifest = {"schemaVersion": 1, "scene": "meridian.surface", "slots": entries}
    manifest_payload = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    checksums = [{
        "key": "assets/" + key,
        "sha256": entry["asset"]["sha256"],
        "bytes": entry["asset"]["bytes"],
        "id": entry["id"],
    } for (key, _), entry in zip(staged, entries)]
    receipt = {
        "schemaVersion": 1,
        "sourceSha": source_sha,
        "modelCount": MAX_GLBS,
        "bytes": total,
        "sha256sums": checksums,
        "manifestSha256": hashlib.sha256(manifest_payload.encode("utf-8")).hexdigest(),
        "published": False,
        "visualAcceptance": "review Chrome 390/1280 actual mission screenshots before any R2 write",
    }
    try:
        (output / "assets").mkdir(parents=True, exist_ok=False)
        for name, data in staged:
            (output / "assets" / name).write_bytes(data)
        (output / "manifest.candidate.json").write_text(
            manifest_payload, encoding="utf-8")
        (output / "receipt.json").write_text(
            json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except OSError:
        if output.exists():
            shutil.rmtree(output)
        raise CandidateError("could not stage immutable candidate") from None
    return receipt


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source-sha", required=True)
    p.add_argument("--fixtures", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    receipt = assemble(args.fixtures, args.output, args.source_sha)
    print("K47_ORIGINAL_ART_CANDIDATE " + json.dumps({
        "sourceSha": receipt["sourceSha"], "models": receipt["modelCount"],
        "bytes": receipt["bytes"], "published": False,
    }, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except CandidateError as exc:
        raise SystemExit("K47_ART_CANDIDATE_BLOCKED: " + str(exc))
