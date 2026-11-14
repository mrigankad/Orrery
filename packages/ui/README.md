# @orreryjs/ui

Labels, keyboard access and text for [Orrery](https://github.com/mrigankad/Orrery) worlds.

```js
import { createUI } from '@orreryjs/ui';

const ui = createUI( world );
ui.pin( planet, 'Juno', { fade: { near: 10, far: 30 } } );   // HTML chip that follows the planet
ui.pin( sun, cardElement, { anchor: 'right', occlude: true } ); // any HTML, dimmed when hidden behind something
ui.accessible( planet, 'Juno' );                              // Tab reaches it, Enter fires world.on(planet, 'click')
world.add( ui.text( 'orrery', { size: 0.6 } ) );              // text as a mesh, WebGPU and WebGL
```

Labels are real DOM, so they stay sharp at any zoom and screen readers can read them. Pins and focus targets go away when their object leaves the scene.

MIT licensed. Not affiliated with the three.js project.
