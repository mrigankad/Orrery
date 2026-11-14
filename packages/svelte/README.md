# @orreryjs/svelte

Svelte bindings for [Orrery](https://github.com/mrigankad/Orrery). No compiler plugin: an action creates the World, and helpers return cleanups for `$effect`.

```svelte
<script>
  import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
  import { orrery, track, frame, listen } from '@orreryjs/svelte';

  let world = $state( null );
  const cube = new Mesh( new BoxGeometry(), new MeshStandardMaterial( { color: 0xff4f1a } ) );

  $effect( () => world && track( world, cube ) );   // removed and freed on cleanup
  $effect( () => world && frame( world, ( dt ) => { cube.rotation.y += dt; } ) );
  $effect( () => world && listen( world, cube, 'click', () => cube.scale.multiplyScalar( 1.1 ) ) );
</script>

<div use:orrery={ { onCreated: ( w ) => ( world = w ) } } style="height: 400px"></div>
```

MIT licensed. Not affiliated with the three.js or Svelte projects.
