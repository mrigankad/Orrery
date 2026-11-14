import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { World, addOrbitControls } from '@orreryjs/core';
import { mountDevtools } from '@orreryjs/devtools';

// A World is a scene, camera, renderer and loop, lit and on WebGPU when available.
const world = await World.create( { container: document.querySelector( '#app' ), adaptive: true } );
world.renderer.setClearColor( 0xffffff, 0 );
world.camera.position.set( 0, 3, 8 );
await addOrbitControls( world );

const sun = new Mesh( new SphereGeometry( 1, 48, 32 ), new MeshStandardMaterial( { color: 0xff4f1a, emissive: 0xff4f1a, emissiveIntensity: 0.25 } ) );
sun.name = 'Sun';

const orbit = new Group();
orbit.name = 'Planet orbit';
const planet = new Mesh( new SphereGeometry( 0.3, 32, 16 ), new MeshStandardMaterial( { color: 0x121214, roughness: 0.6 } ) );
planet.name = 'Planet';
planet.position.x = 3;
orbit.add( planet );

world.add( sun, orbit );

// Pointer events on objects, no raycaster code.
world.on( planet, 'pointerenter', () => planet.scale.setScalar( 1.3 ) );
world.on( planet, 'pointerleave', () => planet.scale.setScalar( 1 ) );
world.on( planet, 'click', () => planet.material.color.setHex( Math.random() * 0xffffff ) );

world.onUpdate( ( dt ) => { orbit.rotation.y += dt * 0.6; } );
world.start();

mountDevtools( world, { open: false } );
