<p align="center"><img src="brand/mark.svg" width="96" alt="Orrery" /></p>

<h1 align="center">orrery</h1>

<p align="center"><b>Batteries for three.js.</b> Wind up a world. Watch it run.</p>

Orrery is a small layer on top of [three.js](https://github.com/mrdoob/three.js) that removes the usual traps: setup boilerplate, scenes that render black, GPU memory leaks, and hand-rolled raycasting. three is a **peer dependency**, so you keep using it directly and upstream releases are a version bump, not a merge.

```sh
npm i orreryjs three
```

```js
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { World } from 'orreryjs';

const world = new World( { container: document.querySelector( '#app' ) } );

const cube = new Mesh( new BoxGeometry(), new MeshStandardMaterial( { color: 0xff4f1a } ) );
world.add( cube );

world.on( cube, 'click', () => world.remove( cube ) ); // detaches and frees GPU memory
world.onUpdate( ( dt ) => { cube.rotation.y += dt; } );
world.start();
```

## What `World` gives you

| Trap in plain three.js | Orrery default |
| --- | --- |
| About 40 lines of renderer, camera, resize and loop setup | `new World()` |
| PBR materials render black with no light | Studio lights and a room environment, plus a console hint if a scene is unlit |
| Colour space and tone mapping confusion | ACES filmic and sRGB output |
| `scene.remove()` leaks geometries, materials and textures | `world.remove(obj)` frees them |
| No events on objects | `world.on(obj, 'click' \| 'pointerenter' \| 'pointerleave' \| 'pointerdown' \| 'pointerup', fn)` |

Plus the helpers carried over from three.js Ascended: `addOrbitControls`, `loadGLTF` (with Draco), `loadTexture`, `setEnvironment` (HDR), `memoizeLoader`, `screenshot`, `addStats`, `addPicking`, `loadAudio`, `Loop`, `ResizeManager`, `disposeObject`, `SceneApp`.

## Try the demo

```sh
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # node --test
npm run typecheck
```

## Roadmap

| Phase | Scope |
| --- | --- |
| 0 · now | Rename from three.js Ascended, unfork, `World`, tests |
| 1 | WebGPU renderer with WebGL2 fallback, one `load()` for Draco, KTX2 and Meshopt |
| 2 | `@orreryjs/devtools`: inspector, perf HUD, GPU memory view; codemods per three release |
| 3 | `@orreryjs/physics` (Rapier), `@orreryjs/ui`, `@orreryjs/ecs`, React, Svelte and Vue bindings |

## Credit

Orrery is an independent project built on three.js. It is not affiliated with or endorsed by the three.js project. All credit for three.js goes to [mrdoob](https://github.com/mrdoob) and its contributors. MIT licensed.
