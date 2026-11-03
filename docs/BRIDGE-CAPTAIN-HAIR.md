# Bridge captain hair asset

`frontend/public/art/captain-hair-v1.obj` is the `short04.obj` mesh from
MakeHuman's system assets. The source itself identifies its September 2020
release under CC0 1.0 by Data Collection AB, Joel Palmius and Jonas Hauquier.
The matching `short04_diffuse.png` is also from the MakeHuman system assets CC0
archive at <https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip>.

Source SHA-256:

- `short04.obj`: `676964a133ee35ffcea1195382bf75542da7a298931e4001bc7b0d7b707225de`
- `short04_diffuse.png`: `0bef7fc0e403db5a40fabb2111ebfa6f7e8158e204c6e56b8da98e9ef527846e`

The source OBJ is unchanged. The texture is resized, converted to grayscale
for roster-driven tinting, and encoded to WebP with ImageMagick:

```
convert short04_diffuse.png -resize 384x384 -colorspace Gray -quality 70 captain-hair-v1.webp
```

The resulting texture SHA-256 is
`625d2e79ba193ef2407399e67a91eb101804d16dd7fbb72e6112796a56b2cfd0`.
The mesh and texture total under 100 KB. If either fails to load, the original
procedural scalp remains; this is presentation only, not a character portrait.
