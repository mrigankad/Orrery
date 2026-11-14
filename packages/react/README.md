# @orreryjs/react

React bindings for [Orrery](https://github.com/mrigankad/Orrery). You write plain three.js inside hooks; the World handles lighting, cleanup and events.

```jsx
import { OrreryCanvas, useFrame, useObject, useEvent } from '@orreryjs/react';

function Spinner() {
  const cube = useMemo( () => new Mesh( new BoxGeometry(), new MeshStandardMaterial( { color: 0xff4f1a } ) ), [] );
  useObject( cube );                                   // added on mount, removed and freed on unmount
  useFrame( ( dt ) => { cube.rotation.y += dt; } );
  useEvent( cube, 'click', () => cube.scale.multiplyScalar( 1.1 ) );
  return null;
}

export default () => <OrreryCanvas style={ { height: 400 } }><Spinner /></OrreryCanvas>;
```

MIT licensed. Not affiliated with the three.js or React projects.
