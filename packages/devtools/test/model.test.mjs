import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from 'three';
import { frameStats, renderStats, sceneGeometries, orphanGeometries, treeRows, countObjects, structureKey, compact } from '../src/model.js';

test( 'frameStats averages, finds the worst frame and counts slow ones', () => {

	assert.deepEqual( frameStats( [] ), { fps: 0, avgMs: 0, worstMs: 0, slow: 0 } );
	const s = frameStats( [ 16, 16, 17, 40, 16 ], 16.7 );
	assert.equal( s.worstMs, 40 );
	assert.equal( s.slow, 1 );
	assert.equal( s.fps, Math.round( 1000 / 21 ) );

} );

test( 'renderStats reads both WebGL (calls) and WebGPU (drawCalls) info', () => {

	assert.deepEqual( renderStats( { info: { render: { calls: 5, triangles: 9 }, memory: { geometries: 2, textures: 1 } } } ), { drawCalls: 5, triangles: 9, geometries: 2, textures: 1 } );
	assert.equal( renderStats( { info: { render: { drawCalls: 7, calls: 99 } } } ).drawCalls, 7 );
	assert.equal( renderStats( undefined ).drawCalls, 0 );

} );

test( 'orphanGeometries reports GPU geometries the scene no longer uses', () => {

	const scene = new Scene();
	const shared = new BoxGeometry();
	scene.add( new Mesh( shared, new MeshBasicMaterial() ), new Mesh( shared, new MeshBasicMaterial() ), new Mesh( new BoxGeometry(), new MeshBasicMaterial() ) );
	assert.equal( sceneGeometries( scene ), 2, 'shared geometry counted once' );

	const renderer = { info: { memory: { geometries: 5 } } };
	assert.equal( orphanGeometries( scene, renderer ), 3 );
	assert.equal( orphanGeometries( scene, renderer, 1 ), 2, 'allowance for PMREM and friends' );
	renderer.info.memory.geometries = 1;
	assert.equal( orphanGeometries( scene, renderer ), 0, 'never negative' );

} );

test( 'treeRows only descends into expanded nodes and reports events', () => {

	const scene = new Scene();
	const system = new Group(); system.name = 'Juno system';
	const planet = new Mesh( new BoxGeometry(), new MeshBasicMaterial() ); planet.name = 'Juno';
	system.add( planet ); scene.add( system );

	let rows = treeRows( scene, new Set() );
	assert.deepEqual( rows.map( ( r ) => r.label ), [ 'Scene', 'Juno system' ] );
	assert.equal( rows[ 1 ].childCount, 1 );

	rows = treeRows( scene, new Set( [ system.uuid ] ), ( o ) => ( o === planet ? 2 : 0 ) );
	assert.deepEqual( rows.map( ( r ) => [ r.label, r.depth, r.events ] ), [ [ 'Scene', 0, 0 ], [ 'Juno system', 1, 0 ], [ 'Juno', 2, 2 ] ] );
	assert.equal( countObjects( scene ), 3 );

} );

test( 'structureKey changes on add, remove and visibility, and compact formats', () => {

	const scene = new Scene();
	const a = structureKey( scene );
	const m = new Mesh(); scene.add( m );
	const b = structureKey( scene );
	m.visible = false;
	const c = structureKey( scene );
	assert.notEqual( a, b ); assert.notEqual( b, c );

	assert.equal( compact( 950 ), '950' );
	assert.equal( compact( 10337 ), '10.3k' );
	assert.equal( compact( 1000000 ), '1M' );

} );

test( 'createLeakTracker flags geometries removed without dispose, after a grace period', async () => {

	const { createLeakTracker } = await import( '../src/model.js' );
	const scene = new Scene();
	const leaky = new Mesh( new BoxGeometry(), new MeshBasicMaterial() );
	const clean = new Mesh( new BoxGeometry(), new MeshBasicMaterial() );
	const moved = new Mesh( new BoxGeometry(), new MeshBasicMaterial() );
	scene.add( leaky, clean, moved );

	const t = createLeakTracker( { graceMs: 1000 } );
	assert.equal( t.update( scene, 0 ).length, 0 );

	scene.remove( leaky );                                  // the mistake
	scene.remove( clean ); clean.geometry.dispose();        // the right way
	scene.remove( moved );                                  // briefly out, then back

	assert.equal( t.update( scene, 100 ).length, 0, 'still inside the grace period' );
	scene.add( moved );
	const leaked = t.update( scene, 1200 );
	assert.deepEqual( leaked, [ leaky.geometry ] );

	leaky.geometry.dispose();
	assert.equal( t.update( scene, 1300 ).length, 0, 'disposing clears it' );

} );
