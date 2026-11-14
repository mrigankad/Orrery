import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, SphereGeometry, TorusKnotGeometry, Vector3 } from 'three';
import { addPhysics, autoShape } from '../src/index.js';

function fakeWorld() {

	const callbacks = [];
	return {
		scene: new Scene(),
		onUpdate( fn ) { callbacks.push( fn ); return () => callbacks.splice( callbacks.indexOf( fn ), 1 ); },
		tick( dt ) { for ( const fn of callbacks ) fn( dt ); },
		run( seconds, dt = 1 / 60 ) { for ( let t = 0; t < seconds; t += dt ) this.tick( dt ); }
	};

}

const mat = new MeshBasicMaterial();

function floorOf( world ) {

	const floor = new Mesh( new BoxGeometry( 20, 1, 20 ), mat );
	floor.name = 'floor';
	floor.position.y = - 0.5;          // top surface at y = 0
	world.scene.add( floor );
	return floor;

}

test( 'autoShape picks primitives, trimesh for static and convex for moving meshes', () => {

	assert.equal( autoShape( new SphereGeometry(), 'dynamic' ), 'ball' );
	assert.equal( autoShape( new BoxGeometry(), 'dynamic' ), 'cuboid' );
	assert.equal( autoShape( new PlaneGeometry(), 'fixed' ), 'cuboid' );
	assert.equal( autoShape( new TorusKnotGeometry(), 'fixed' ), 'trimesh' );
	assert.equal( autoShape( new TorusKnotGeometry(), 'dynamic' ), 'convex' );

} );

test( 'a box falls under gravity and comes to rest on the floor', async () => {

	const world = fakeWorld();
	const physics = await addPhysics( world );
	physics.add( floorOf( world ), { type: 'fixed' } );

	const crate = new Mesh( new BoxGeometry( 1, 1, 1 ), mat );
	crate.position.set( 0, 5, 0 );
	world.scene.add( crate );
	physics.add( crate );

	world.run( 0.5 );
	assert.ok( crate.position.y < 5 && crate.position.y > 0.5, `falling, y=${ crate.position.y }` );
	world.run( 3 );
	assert.ok( Math.abs( crate.position.y - 0.5 ) < 0.05, `resting on the floor, y=${ crate.position.y }` );
	assert.ok( physics.velocity( crate ).length() < 0.05 );

	physics.dispose();

} );

test( 'collision events report the other object, start and stop', async () => {

	const world = fakeWorld();
	const physics = await addPhysics( world );
	const floor = floorOf( world );
	physics.add( floor, { type: 'fixed' } );

	const ball = new Mesh( new SphereGeometry( 0.5 ), mat );
	ball.name = 'ball';
	ball.position.set( 0, 2, 0 );
	world.scene.add( ball );
	physics.add( ball, { restitution: 0 } );

	const hits = [];
	physics.onCollision( ball, ( other, started ) => hits.push( [ other.name, started ] ) );
	world.run( 2 );
	assert.deepEqual( hits[ 0 ], [ 'floor', true ] );

	physics.applyImpulse( ball, [ 0, 8, 0 ] );
	world.run( 0.3 );
	assert.ok( hits.some( ( [ , s ] ) => s === false ), 'stop event when it bounces off' );

	physics.dispose();

} );

test( 'removing an object from the scene removes its body', async () => {

	const world = fakeWorld();
	const physics = await addPhysics( world );
	const crate = new Mesh( new BoxGeometry(), mat );
	world.scene.add( crate );
	physics.add( crate );
	assert.equal( physics.size, 1 );

	world.scene.remove( crate );
	world.tick( 1 / 60 );
	assert.equal( physics.size, 0 );
	assert.equal( physics.has( crate ), false );

	physics.dispose();

} );

test( 'dynamic bodies inside a moved, rotated parent land in the right world spot', async () => {

	const world = fakeWorld();
	const physics = await addPhysics( world );
	physics.add( floorOf( world ), { type: 'fixed' } );

	const rig = new Group();
	rig.position.set( 3, 0, - 2 );
	rig.rotation.y = Math.PI / 2;
	world.scene.add( rig );

	const crate = new Mesh( new BoxGeometry(), mat );
	crate.position.set( 1, 4, 0 );     // local; world x = 3, z = -3
	rig.add( crate );
	physics.add( crate );

	world.run( 3 );
	const p = crate.getWorldPosition( new Vector3() );
	assert.ok( Math.abs( p.x - 3 ) < 0.15 && Math.abs( p.z + 3 ) < 0.15, `x/z kept, got ${ p.toArray() }` );
	assert.ok( Math.abs( p.y - 0.5 ) < 0.05, `on the floor, y=${ p.y }` );

	physics.dispose();

} );

test( 'raycast hits the nearest body; kinematic bodies follow their objects', async () => {

	const world = fakeWorld();
	const physics = await addPhysics( world );
	const floor = floorOf( world );
	physics.add( floor, { type: 'fixed' } );

	const hit = physics.raycast( [ 0, 10, 0 ], [ 0, - 1, 0 ] );
	assert.equal( hit.object, floor );
	assert.ok( Math.abs( hit.distance - 10 ) < 1e-3 );

	const paddle = new Mesh( new BoxGeometry(), mat );
	world.scene.add( paddle );
	physics.add( paddle, { type: 'kinematic' } );
	paddle.position.set( 4, 2, 0 );
	world.run( 0.1 );
	const t = physics.body( paddle ).translation();
	assert.deepEqual( [ t.x, t.y, t.z ].map( ( v ) => Math.round( v * 100 ) / 100 ), [ 4, 2, 0 ] );

	assert.throws( () => physics.add( new Mesh( new BoxGeometry() ), { type: 'floating' } ), /unknown body type/ );
	assert.throws( () => physics.applyImpulse( new Mesh(), [ 0, 1, 0 ] ), /has no body/ );

	physics.dispose();

} );
