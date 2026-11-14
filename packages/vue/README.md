# @orreryjs/vue

Vue bindings for [Orrery](https://github.com/mrigankad/Orrery). You write plain three.js in composables; the World handles lighting, cleanup and events.

```vue
<script setup>
import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { useObject, useFrame, useEvent } from '@orreryjs/vue';

const cube = new Mesh( new BoxGeometry(), new MeshStandardMaterial( { color: 0xff4f1a } ) );
useObject( cube );                                   // added on mount, removed and freed on unmount
useFrame( ( dt ) => { cube.rotation.y += dt; } );
useEvent( cube, 'click', () => cube.scale.multiplyScalar( 1.1 ) );
</script>
```

Wrap it in `<OrreryCanvas :options="{ adaptive: true }">`. `useObject`, `useEvent` and `useLoad` also accept refs. Keep three.js objects in `shallowRef`, not `ref`: a deep `ref` wraps every vertex and matrix in a reactive Proxy. The bindings unwrap them either way, so events still work.

MIT licensed. Not affiliated with the three.js or Vue projects.
