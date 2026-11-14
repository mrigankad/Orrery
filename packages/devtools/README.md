# @orreryjs/devtools

Devtools for [Orrery](https://github.com/mrigankad/Orrery) worlds: a frame graph with budgets, GPU memory with a leak check, a live scene tree and an inspector.

```js
import { World } from '@orreryjs/core';
import { mountDevtools } from '@orreryjs/devtools';

const world = await World.create( { container } );
const devtools = mountDevtools( world, { budgets: { drawCalls: 200, triangles: 1e6 } } );
// ` toggles the panel, Alt+click selects an object in the scene
```

MIT licensed. Not affiliated with the three.js project.
