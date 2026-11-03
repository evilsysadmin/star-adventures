# Bridge captain hair asset

`frontend/public/art/captain-hair-v1.obj` is the `short03.obj` mesh from
MakeHuman's system assets. The source itself identifies its September 2020
release under CC0 1.0 by Data Collection AB, Joel Palmius and Jonas Hauquier.
The matching `short03_diffuse.png` is also from the MakeHuman system assets CC0
archive at <https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip>.

Source SHA-256:

- `short03.obj`: `4a9fc385718f2c46fb328ab99d33e3a946cecdb717987c8b324cf2466b59bd9c`
- `short03_diffuse.png`: `fe6ed0bb14498a48a2e8fc07e80e2a6f62c8b67686fcd0a7a570d345faec97da`

The source OBJ is unchanged. The texture is resized, converted to grayscale
for roster-driven tinting, and encoded to WebP with ImageMagick:

```
convert short03_diffuse.png -resize 512x512 -colorspace Gray -quality 75 captain-hair-v1.webp
```

The resulting texture SHA-256 is
`20327b3ecf9dd77c9003a77428e08b06cbe8fd5623fa5ca04740af3ff0fe60a1`.
The mesh and texture total under 100 KB. If either fails to load, the original
procedural scalp remains; this is presentation only, not a character portrait.
