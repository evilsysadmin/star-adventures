# Navigable bridge — visual iteration

The existing authored 9×8 bridge now has a Three.js first-person interior. The
surface keeps its Canvas2D renderer. The camera follows the same saved spatial
cell and heading; meshes never decide whether movement or a console order is legal.
The separate elevated tactical camera and picking system are unchanged.

## Art direction and limits

- Matte blue-grey deck, upholstered seating, brass edges, recessed light strips,
  original console diagrams, overhead structure and a panoramic orbital view.
- Every interactive furnishing is located at its existing authored station.
  Decorative light strips and carpet add no collision or movement shortcuts.
- Wider scene and a quieter service journal on desktop; cropped, proportional
  first-person viewport and full-size movement controls on phones.
- Instrument screens are decorative station diagrams, not live sensor readings.
  Actual objectives, targets and outcomes remain in the accessible HTML HUD.
- This is an interior/presentation iteration, not a claim of a complete campaign,
  populated bridge, free-look navigation or finished production art.

## Rendering and recovery

`frontend/src/bridge/bridgeInterior.ts` renders on state changes and when the
orbital texture loads. No continuous animation loop or postprocessing is added.
A small, canvas-authored light probe and one cached 1024px shadow map support
beveled furniture. The output is capped at 960×480 backing pixels, including on
high-DPR devices. Mobile uses proportional cropping rather than stretching.

`BridgeInteriorView` loads the renderer asynchronously. On unmount it disposes
geometries, materials, textures, the environment target, shadow resources and the
WebGL context. Pending image completions dispose their texture after unmount.
WebGL creation failure or context loss returns to the existing compatible 2D
bridge without changing location, crew, mission or save format. The HTML controls
remain the interaction surface in both renderers.

No GPU FPS or physical-device performance claim is made from headless Chrome.

## Original orbital asset

Project asset: `frontend/public/art/meridian-orbit-v1.webp` (1600×800, approximately
119 KiB). Generated with the **built-in imagegen tool**, then resized and encoded
as WebP for the game. No third-party franchise image or model is included.
The full-resolution generated original remains outside git; the runtime asset is
owned by this repository. The viewscreen crops the image to its panoramic aspect
ratio so the planet is not stretched.

Final generation prompt:

> Use case: stylized-concept. Asset type: original game environment texture, panoramic view of space visible THROUGH the front window of an exploration starship. Generate only outer space, absolutely no window frame, no ship interior, no spacecraft, no UI, no text, no logos. Wide cinematic 2:1 composition. A magnificent blue-grey ocean planet with delicate white cloud swirls and a thin luminous cyan atmospheric rim sits to the right of center, its curved limb filling about half the image height. Shadowed lower hemisphere, soft sunlight on upper right. Deep black-blue starfield with sparse small crisp stars and subtle gold dust nebula along the left horizon. Painterly realism, premium cinematic science fiction game art, restrained sophisticated color grading, beautiful atmospheric depth, high texture detail. Original fictional planet, no franchise designs. Avoid oversaturated purple, overwhelming lens flare, large foreground objects. Texture for a real navigable 3D bridge, not a mockup.

## Verification contract

`bridgeArchitecture.spec.ts` captures the real WebGL interior at 360, 390, 430 and
1280px, moves using the real controls, reaches a helm station, rejects entry into
its solid cell and restores the same location after refresh. It also tests WebGL
denial and real context loss without resetting the player. Existing bridge,
medical rescue, mission wayfinding and viewport tests cover the gameplay loop.
Captures require inspection before the visual PR leaves Draft. CI must pass on
the exact PR head. No deployment is owned by this change.
