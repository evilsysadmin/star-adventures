# Spatial checkpoint contract v1

The ship/away camera persists separately from the already shipped **crew/mission v2 action replay**. There is no runtime dependency on Chess Studio, Chronicles or shadowops-infra.

- Source: `src/spatialCheckpoint.mjs`.
- Payload: strict JSON of `saveVersion=1`, `worldVersion`, `area`, integer `x,y`, cardinal `heading`.
- Load validates world membership and walkability against current authored map. Bad/future/corrupt data returns a known safe world spawn.
- Teleporter confirmation state is **never serialized**. F5 preserves the tile/heading, but the player must choose `E` again to reopen the prompt.
- An invalid snapshot must not overwrite or discard existing crew XP/mission commands.
- Domain has a compact 1024-byte cap. No arbitrary executed scripts, no derived mission stats, no secrets.

### Limits
This is a validated **snapshot**, unlike crew v2 which is verified through command replay. It is suitable for an offline prototype's location restore, not an anti-cheat mechanism. A future shared campaign transaction will need unified consistency across mission, squad and location. Do not claim atomic cross-key persistence.

The next React PR must provide a real reload test for bridge, surface, blocked/invalid state and pending confirmation; maintain existing browser paths.
