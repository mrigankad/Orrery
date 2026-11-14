# @orreryjs/physics

[Rapier](https://rapier.rs) physics for [Orrery](https://github.com/mrigankad/Orrery) worlds. Colliders are built from your meshes, the simulation runs on a fixed step inside the world loop, and bodies go away when their object leaves the scene.

```js
import { World } from '@orreryjs/core';
import { addPhysics } from '@orreryjs/physics';

const world = await World.create( { container } );
const physics = await addPhysics( world );

physics.add( floor, { type: 'fixed' } );          // trimesh or box from its geometry
physics.add( crate );                            // dynamic box
physics.add( ball, { restitution: 0.8 } );       // dynamic sphere

physics.onCollision( crate, ( other, started ) => started && console.log( 'hit', other.name ) );
world.on( crate, 'click', () => physics.applyImpulse( crate, [ 0, 6, 0 ] ) );
world.remove( crate );                           // body removed too
```

`shape: 'auto'` picks a ball for spheres, a cuboid for boxes and planes, a capsule for capsules, exact triangles for fixed meshes and a convex hull for moving ones.

MIT licensed. Not affiliated with the three.js or Rapier projects.
