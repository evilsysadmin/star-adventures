#!/usr/bin/env python3
"""Offline security/size/footprint contract for the exact original GLB handoff."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from k47_publication_candidate import (CandidateError, SLOTS, assemble, verify_glb)


def tiny_glb(*, external=False):
    model = {"asset": {"version": "2.0"},
             "meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}],
             "buffers": [{"byteLength": 4}]}
    if external:
        model["buffers"][0]["uri"] = "https://example.net/untrusted.bin"
    content = json.dumps(model, separators=(",", ":")).encode("utf-8")
    chunk = content + b" " * ((-len(content)) % 4)
    bin_chunk = b"\0\0\0\0"
    length = 12 + 8 + len(chunk) + 8 + len(bin_chunk)
    return (struct.pack("<III", 0x46546c67, 2, length)
            + struct.pack("<II", len(chunk), 0x4e4f534a) + chunk
            + struct.pack("<II", len(bin_chunk), 0x004e4942) + bin_chunk)


class OriginalHandoffTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.fixture = self.folder / "fixtures"
        self.fixture.mkdir()
        self.stage = self.folder / "out"
        for stem, name, cells, anchor in SLOTS:
            file = self.fixture / f"k47-{stem}-candidate.glb"
            data = tiny_glb()
            file.write_bytes(data)
            meta = {
                "id": name, "anchor": list(anchor),
                "bounds": ([-3.29, 0, -1.48], [.476, 3.25, 1.48])
                if stem == "archive" else
                ([-2.465, 0, -.502], [2.465, 3.12, .5035])
                if stem == "south" else
                ([-.4955, 0, -1.48], [.4955, 3.0, 1.48]),
                "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                "license": "original", "source": "Original ShadowOps original authored art",
                "authored_elements": 120, "materials": 10,
            }
            file.with_suffix(".json").write_text(json.dumps(meta))

    def test_reproducible_manifest_exactly_three_content_addressed_assets(self):
        sha = "1" * 40
        result = assemble(self.fixture, self.stage, sha)
        self.assertEqual(result["modelCount"], 3)
        self.assertEqual(result["sourceSha"], sha)
        self.assertFalse(result["published"])
        rows = json.loads((self.stage / "manifest.candidate.json").read_text())["slots"]
        self.assertEqual({r["id"] for r in rows}, {slot[1] for slot in SLOTS})
        self.assertEqual(len(list((self.stage / "assets").glob("*"))), 3)
        for entry in rows:
            asset = entry["asset"]
            key = asset["url"].rsplit("/", 1)[1]
            self.assertTrue(key.endswith(asset["sha256"][:16] + ".glb"))
            self.assertEqual(hashlib.sha256((self.stage / "assets" / key)
              .read_bytes()).hexdigest(), asset["sha256"])
            self.assertEqual(entry["status"], "published")  # candidate, never prod

    def test_reject_modified_bytes_even_when_sidecar_still_claims_original(self):
        p = self.fixture / "k47-south-candidate.glb"
        p.write_bytes(p.read_bytes() + b"bad")
        with self.assertRaisesRegex(CandidateError, "SHA-256"):
            assemble(self.fixture, self.stage, "f" * 40)
        self.assertFalse(self.stage.exists())

    def test_reject_model_crossing_a_walkable_cell(self):
        p = self.fixture / "k47-east-candidate.json"
        data = json.loads(p.read_text())
        data["bounds"][1][0] = 1.5
        p.write_text(json.dumps(data))
        with self.assertRaisesRegex(CandidateError, "blocked footprint"):
            assemble(self.fixture, self.stage, "f" * 40)

    def test_reject_untrusted_embedded_glb_uri(self):
        with self.assertRaisesRegex(CandidateError, "external GLB buffers"):
            verify_glb(tiny_glb(external=True))

    def test_require_exact_main_sha_and_no_overwrite(self):
        with self.assertRaisesRegex(CandidateError, "40-character"):
            assemble(self.fixture, self.stage, "main")
        assemble(self.fixture, self.stage, "a" * 40)
        with self.assertRaisesRegex(CandidateError, "must not already exist"):
            assemble(self.fixture, self.stage, "b" * 40)


if __name__ == "__main__":
    unittest.main()
