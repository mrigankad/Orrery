import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Scene, Vector3 } from 'three';
import { createECS, Not } from '../src/index.js';

function setup() {

	const callbacks = [];
	const world = { scene: new Scene(), onUpdate( fn ) { callbacks.push( fn ); return () => callbacks.splice( callbacks.indexOf( fn ), 1 ); }, tick( dt ) { for ( const f of [ ...callbacks ] ) f( dt, 0 ); } };
	return { world, ecs: createECS( world, { sweepEvery: 1 } ) };

}

test( 'traits carry defaults, instances override, factories avoid shared state', () => {

	const { ecs } = setup();
	const Spin = ecs.trait( { speed: 1, axis: 'y' }, 'Spin' );
	const Path = ecs.trait( () => ( { points: [], target: new Vector3() } ) );

	const a = new Mesh(), b = new Mesh();
	ecs.add( a, Spin( { speed: 3 } ), Path );
	ecs.add( b, Spin, Path );

	assert.deepEqual( ecs.get( a, Spin ), { speed: 3, axis: 'y' } );
	assert.deepEqual( ecs.get( b, Spin ), { speed: 1, axis: 'y' } );
	assert.notEqual( ecs.get( a, Path ).points, ecs.get( b, Path ).points, 'no shared arrays' );
	assert.equal( Spin.name, 'Spin' );
	assert.throws( () => ecs.add( a, { speed: 1 } ), /takes traits/ );

} );

test( 'queries are live, support Not(), and are the same array each time', () => {

	const { ecs } = setup();
	const Spin = ecs.trait( { speed: 1 } ), Frozen = ecs.trait();
	const a = new Mesh(), b = new Mesh(), c = new Mesh();

	const spinning = ecs.query( Spin, Not( Frozen ) );
	ecs.add( a, Spin ); ecs.add( b, Spin, Frozen ); ecs.add( c, Frozen );
	assert.deepEqual( spinning, [ a ] );
	assert.equal( ecs.query( Not( Frozen ), Spin ), spinning, 'cached by signature, order does not matter' );

	ecs.remove( b, Frozen );
	assert.deepEqual( spinning, [ a, b ] );
	ecs.remove( a );
	assert.deepEqual( spinning, [ b ] );
	assert.equal( ecs.size, 2 );

} );

test( 'systems run in order each frame; each() yields object and data', () => {

	const { world, ecs } = setup();
	const Spin = ecs.trait( { speed: 2 } );
	const m = new Mesh(); world.scene.add( m );
	ecs.add( m, Spin );

	const log = [];
	ecs.system( () => log.push( 'late' ), { order: 10 } );
	ecs.system( function spin( dt ) { for ( const [ o, s ] of ecs.each( Spin ) ) o.rotation.y += s.speed * dt; log.push( 'spin' ); } );
	world.tick( 0.5 );

	assert.equal( m.rotation.y, 1 );
	assert.deepEqual( log, [ 'spin', 'late' ] );
	assert.ok( ecs.timings.some( ( t ) => t.name === 'spin' ) );

} );

test( 'onAdd/onRemove fire, and entities drop when their object leaves the scene', () => {

	const { world, ecs } = setup();
	const Tag = ecs.trait();
	const events = [];
	ecs.onAdd( Tag, ( o ) => events.push( 'add' ) );
	ecs.onRemove( Tag, ( o ) => events.push( 'remove' ) );

	const m = new Mesh(); world.scene.add( m );
	ecs.add( m, Tag );
	ecs.add( m, Tag( {} ) );                 // replacing data is not a new add
	assert.deepEqual( events, [ 'add' ] );

	world.scene.remove( m );
	world.tick( 1 / 60 );
	assert.deepEqual( events, [ 'add', 'remove' ] );
	assert.equal( ecs.size, 0 );
	assert.deepEqual( ecs.query( Tag ), [] );

} );

test( 'removing entities inside a system while iterating is safe', () => {

	const { world, ecs } = setup();
	const Life = ecs.trait( { left: 1 } );
	for ( let i = 0; i < 5; i ++ ) { const m = new Mesh(); world.scene.add( m ); ecs.add( m, Life( { left: i } ) ); }

	ecs.system( () => { for ( const [ o, life ] of ecs.each( Life ) ) if ( life.left <= 1 ) ecs.remove( o ); } );
	world.tick( 1 / 60 );
	assert.equal( ecs.query( Life ).length, 3 );

} );
