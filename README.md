<p align="center"><img src="docs/readme/01-hero.png" alt="Orrery, batteries for three.js. Headline: Wind up a world. Watch it run. A small layer on three.js that lights your scene, frees GPU memory, gives objects click events and runs on WebGPU with WebGL as a fallback. Install with npm i orreryjs three. Beside it, a live render of the Orrery demo: an orange sun with planets on orbit rings."></p>

<p align="center">
  <a href="https://mrigankad.github.io/Orrery/"><b>Live demo</b></a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#api">API</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center"><img src="docs/readme/02-before-after.png" alt="Before and after. Plain three.js needs 29 lines for a lit, resizable, clickable cube and still leaks GPU memory on scene.remove. Orrery does it in 9 lines with World.create, world.on and world.remove: lit by default, WebGPU with a WebGL 2 fallback, resize and tone mapping handled, and remove frees geometry, materials and textures."></p>

<p align="center"><img src="docs/readme/03-load-gpu.png" alt="One load for every file and the best GPU path picked for you. world.load picks the loader from the extension: glb and gltf with Draco, KTX2 and Meshopt wired in, ktx2 Basis textures, hdr environments, and png, jpg or webp textures in sRGB, with aggregate progress. World.create uses WebGPU when the browser supports it, falls back to WebGL 2 automatically, and new World gives the classic WebGL renderer."></p>

## Quick start

```sh
npm i orreryjs three
```

```js
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { World } from 'orreryjs';

const world = await World.create( { container: document.querySelector( '#app' ) } );

const cube = new Mesh( new BoxGeometry(), new MeshStandardMaterial( { color: 0xff4f1a } ) );
world.add( cube );

world.on( cube, 'click', () => world.remove( cube ) ); // detaches and frees GPU memory
world.onUpdate( ( dt ) => { cube.rotation.y += dt; } );
world.start();

const city = await world.load( 'city.glb' ); // Draco, KTX2 and Meshopt ready
world.add( city.scene );
```

If you use three's WebGPU build through an import map, also map `three/webgpu`. The [demo](examples/index.html) shows a working import map.

## API

| | |
| --- | --- |
| `await World.create(config)` | WebGPU by default, WebGL 2 fallback built in. `renderer: 'auto' \| 'webgl2' \| 'webgl'` |
| `new World(config)` | Same World on the classic WebGL renderer, created synchronously |
| `world.backend` | `'webgpu'`, `'webgl2'` or `'webgl'` |
| `world.add(...objects)` / `world.remove(obj)` | `remove` detaches and disposes geometry, materials and textures |
| `world.on(obj, type, fn)` | `click`, `pointerenter`, `pointerleave`, `pointerdown`, `pointerup`; returns an unsubscribe |
| `world.load(url)` | glTF/GLB, KTX2, HDR, PNG/JPG/WebP. Cached by URL |
| `world.assets.onProgress(fn)` | `{ url, loaded, total, done }` across every load |
| `world.optimize(root?)` | Folds meshes sharing geometry and material into InstancedMeshes (300 rocks: 300 draw calls to 1). Meshes with events are kept |
| `adaptive: true` | Lowers resolution when frames run over budget, raises it back with headroom. `world.resolutionScale` |
| `world.onGpuLost(fn)` | WebGPU device loss or WebGL context loss, reported once as `{ api, reason, message }` |
| `world.onUpdate(fn)` / `start()` / `stop()` / `dispose()` | Frame loop and lifecycle |
| Config | `lights: 'studio' \| 'none'`, `environment: 'room' \| 'none'`, `toneMapping`, `warnings`, `fov`, `near`, `far` |

Also exported: `createAssetLoader`, `addOrbitControls`, `loadGLTF`, `loadTexture`, `setEnvironment`, `memoizeLoader`, `screenshot`, `addStats`, `addPicking`, `loadAudio`, `disposeObject`, `Loop`, `ResizeManager`, `SceneApp`. Types ship in `index.d.ts`.

## Devtools

```js
import { mountDevtools } from '@orreryjs/devtools';
mountDevtools( world );   // ` toggles, Alt+click selects in the scene
```

A frame graph with a budget line, draw call and triangle budgets, GPU memory with a leak check (geometries that left the scene without `dispose()`), a live scene tree and an inspector. Try it on the [demo](https://mrigankad.github.io/Orrery/examples/?devtools).

## Physics

```js
import { addPhysics } from '@orreryjs/physics';

const physics = await addPhysics( world );        // Rapier, loaded on first use
physics.add( floor, { type: 'fixed' } );          // collider from the mesh's geometry
physics.add( crate );                            // dynamic box
physics.onCollision( crate, ( other, started ) => started && console.log( other.name ) );
world.on( crate, 'click', () => physics.applyImpulse( crate, [ 0, 6, 0 ] ) );
world.remove( crate );                           // the body goes with it
```

Fixed-step simulation inside the world loop, automatic shapes (ball, cuboid, capsule, convex hull, or exact triangles for static meshes), nested parents handled, raycasts and teleports. Try the [physics demo](https://mrigankad.github.io/Orrery/examples/physics.html).

## Labels, keyboard access and text

```js
import { createUI } from '@orreryjs/ui';

const ui = createUI( world );
ui.pin( planet, 'Juno', { fade: { near: 14, far: 30 }, occlude: true } ); // HTML chip that follows it
ui.pin( sun, cardElement, { anchor: 'right' } );                         // any HTML
ui.accessible( planet, 'Juno' );          // Tab reaches it, Enter fires world.on( planet, 'click' )
world.add( ui.text( 'orrery' ) );         // text as a mesh, WebGPU and WebGL
```

Labels are real DOM: sharp at any zoom, readable by screen readers, sorted by depth, dimmed when something is in front. On the [demo](https://mrigankad.github.io/Orrery/), press Tab to move through the planets.

## Roadmap

<p align="center"><img src="docs/readme/04-roadmap.png" alt="Small core, batteries you can add. Shipped: orreryjs core. Next: @orreryjs/devtools with a scene inspector, perf HUD, GPU memory view and upgrade codemods. Then: physics, UI and ECS packages. And: React, Svelte and Vue bindings with a docs site and a starter."></p>

## Develop

```sh
npm install
npm run dev        # demo on http://127.0.0.1:5173  (?renderer=webgl2 or ?renderer=webgl)
npm test           # node --test, 47 tests across four packages (physics runs real Rapier)
npm run typecheck
```

A test checks that every `three/addons` file Orrery imports still exists in the installed three, so an upstream rename fails CI instead of failing users.

## Credit

Orrery is an independent project built on [three.js](https://github.com/mrdoob/three.js). It is not affiliated with or endorsed by the three.js project. All credit for three.js goes to [mrdoob](https://github.com/mrdoob) and its contributors. MIT licensed.
