# @orreryjs/ecs

A small, optional entity-component-system for [Orrery](https://github.com/mrigankad/Orrery). Entities are the Object3Ds you already have.

```js
import { createECS, Not } from '@orreryjs/ecs';

const ecs = createECS( world );
const Orbit = ecs.trait( { speed: 1 }, 'Orbit' );
const Paused = ecs.trait( {}, 'Paused' );

ecs.add( planet, Orbit( { speed: 0.4 } ) );

ecs.system( function orbit( dt ) {
	for ( const [ object, o ] of ecs.each( Orbit, Not( Paused ) ) ) object.rotation.y += o.speed * dt;
} );
```

Queries are cached and kept live as traits change, systems run in `order` every frame with timings in `ecs.timings`, and entities drop out when their object leaves the scene.

MIT licensed. Not affiliated with the three.js project.
