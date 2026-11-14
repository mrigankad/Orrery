# Changelog

All packages share one version. Orrery follows semver from 1.0; before that, minor versions may change APIs and each entry says how to upgrade.

## Unreleased

- `@orreryjs/svelte` and `@orreryjs/vue` bindings.
- CI also runs the tests against the newest three.js release, so upstream breaking changes show up before users hit them.

## 0.1.0 · 2026-11-14

First release, published to npm under the `@orreryjs` scope. Tested with three r184.

### @orreryjs/core
- `World.create()`: three's WebGPURenderer with its built-in WebGL 2 fallback; `new World()` for the classic WebGLRenderer; `world.backend` reports which is drawing.
- Lit by default (studio lights and a RoomEnvironment), Neutral tone mapping, sRGB output, and a warning when lit materials have no light.
- `world.remove(obj)` detaches and disposes geometry, materials and textures.
- Pointer events on objects: `world.on(obj, 'click' | 'pointerenter' | 'pointerleave' | 'pointerdown' | 'pointerup', fn)`, plus `world.emit` and `world.hasListener`.
- `world.load(url)` for glTF/GLB (Draco, KTX2, Meshopt), KTX2, HDR and sRGB image textures, cached by URL with aggregate progress.
- `adaptive: true` resolution scaling that also climbs back on vsync-locked displays.
- `world.optimize()` folds meshes that share geometry and material into InstancedMeshes.
- GPU loss: `world.onGpuLost`, and automatic recovery onto the WebGL 2 backend with `world.onRendererChange`.
- `npx orreryjs doctor`: three version, duplicate copies, addon imports removed by a release (with replacements), `@types/three`, Orrery package alignment.
- Helpers carried over from three.js Ascended: `addOrbitControls`, `loadGLTF`, `loadTexture`, `setEnvironment`, `memoizeLoader`, `screenshot`, `addStats`, `addPicking`, `loadAudio`, `disposeObject`, `Loop`, `ResizeManager`, `SceneApp`.

### Packages
- `@orreryjs/devtools`: frame graph with budgets, GPU memory with a leak check, live scene tree, inspector, Alt+click picking.
- `@orreryjs/physics`: Rapier with colliders built from mesh geometry, collision events, raycasts, bodies removed with their object.
- `@orreryjs/ui`: DOM labels pinned to objects (fade, occlusion, depth order), keyboard access to 3D objects, text meshes.
- `@orreryjs/ecs`: traits on Object3Ds, live cached queries with `Not()`, ordered systems with timings.
- `@orreryjs/react`: `OrreryCanvas`, `useWorld`, `useFrame`, `useObject`, `useEvent`, `useLoad`.
- `@orreryjs/create`: `npm create @orreryjs` scaffolds a Vite project.

### Fixed from three.js Ascended
- `setEnvironment` loaded `RGBELoader`, which three r184 removed; it now uses `HDRLoader`.
- The canvas never had its CSS size set, so it rendered oversized on 2× displays and shrank under resolution scaling.
