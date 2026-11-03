# Bridge crew head prototype

The compact 52 KiB head mesh in `frontend/public/art/bridge-head-v1.bin` is a
static, modified subset of **Superhero Male** from Quaternius's Universal Base
Characters — Standard. Quaternius distributes that free pack under CC0 1.0.
The mesh is used as a generic stylized base, not a portrait of a named officer.
The game supplies its own materials and hairstyles; the roster still controls
color and name. There is no copyrighted franchise asset.

- Author and pack: https://quaternius.com/packs/universalbasecharacters.html
- License: https://creativecommons.org/publicdomain/zero/1.0/
- Input: https://raw.githubusercontent.com/programasweights/avatar/main/public/assets/character.glb
- Input SHA-256: `d6f3b64cab629f6ddca9ba063811aeffd3663a8a4e49ade47cd9505dc2bbd70f`
- Output SHA-256: `b6e428982101011778eca051ebfa02fd2399429e38cfd679b45f2f4ea01f59e5`
- Reproduce with `python3 scripts/extract-bridge-head.py character.glb frontend/public/art/bridge-head-v1.bin`.

The extractor selects head triangles from the cited GLB, rotates and normalizes
the geometry, and writes positions, normals and indices. A scalp is derived
from those triangles at runtime; it is not the original hair model. A failed or
malformed request keeps the existing procedural head and gameplay available.
This is an incremental experiment, not a finished animated human character.
