<p align="center"><img src="https://raw.githubusercontent.com/mrigankad/Orrery/main/docs/readme/01-hero.png" alt="Orrery, batteries for three.js. Headline: Wind up a world. Watch it run. A small layer on three.js that lights your scene, frees GPU memory, gives objects click events and runs on WebGPU with WebGL as a fallback. Install with npm i orreryjs three. Beside it, a live render of the Orrery demo: an orange sun with planets on orbit rings."></p>

<p align="center">
  <a href="https://mrigankad.github.io/Orrery/"><b>Live demo</b></a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#api">API</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center"><img src="https://raw.githubusercontent.com/mrigankad/Orrery/main/docs/readme/02-before-after.png" alt="Before and after. Plain three.js needs 29 lines for a lit, resizable, clickable cube and still leaks GPU memory on scene.remove. Orrery does it in 9 lines with World.create, world.on and world.remove: lit by default, WebGPU with a WebGL 2 fallback, resize and tone mapping handled, and remove frees geometry, materials and textures."></p>

<p align="center"><img src="https://raw.githubusercontent.com/mrigankad/Orrery/main/docs/readme/03-load-gpu.png" alt="One load for every file and the best GPU path picked for you. world.load picks the loader from the extension: glb and gltf with Draco, KTX2 and Meshopt wired in, ktx2 Basis textures, hdr environments, and png, jpg or webp textures in sRGB, with aggregate progress. World.create uses WebGPU when the browser supports it, falls back to WebGL 2 automatically, and new World gives the classic WebGL renderer."></p>

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

If you use three's WebGPU build through an import map, also map `three/webgpu`. The [demo](https://github.com/mrigankad/Orrery/blob/main/examples/index.html) shows a working import map.

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
| `world.onUpdate(fn)` / `start()` / `stop()` / `dispose()` | Frame loop and lifecycle |
| Config | `lights: 'studio' \| 'none'`, `environment: 'room' \| 'none'`, `toneMapping`, `warnings`, `fov`, `near`, `far` |

Also exported: `createAssetLoader`, `addOrbitControls`, `loadGLTF`, `loadTexture`, `setEnvironment`, `memoizeLoader`, `screenshot`, `addStats`, `addPicking`, `loadAudio`, `disposeObject`, `Loop`, `ResizeManager`, `SceneApp`. Types ship in `index.d.ts`.

## Roadmap

<p align="center"><img src="https://raw.githubusercontent.com/mrigankad/Orrery/main/docs/readme/04-roadmap.png" alt="Small core, batteries you can add. Shipped: orreryjs core. Next: @orreryjs/devtools with a scene inspector, perf HUD, GPU memory view and upgrade codemods. Then: physics, UI and ECS packages. And: React, Svelte and Vue bindings with a docs site and a starter."></p>

## Develop

```sh
npm install
npm run dev        # demo on http://127.0.0.1:5173  (?renderer=webgl2 or ?renderer=webgl)
npm test           # node --test, 25 tests
npm run typecheck
```

A test checks that every `three/addons` file Orrery imports still exists in the installed three, so an upstream rename fails CI instead of failing users.

## Credit

Orrery is an independent project built on [three.js](https://github.com/mrdoob/three.js). It is not affiliated with or endorsed by the three.js project. All credit for three.js goes to [mrdoob](https://github.com/mrdoob) and its contributors. MIT licensed.
