import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { createAdaptiveResolution } from '../src/adaptive.js';
import { instanceMeshes } from '../src/optimize.js';
import { World } from '../src/World.js';

test( 'adaptive resolution steps down when slow, back up when fast, ignores hitches', () => {

	const a = createAdaptiveResolution( { window: 4, min: 0.5, max: 1, step: 0.25, budgetMs: 16 } );
	const feed = ( ms, n ) => { let r = null; for ( let i = 0; i < n; i ++ ) r = a.feed( ms ) ?? r; return r; };

	assert.equal( feed( 30, 4 ), 0.75 );
	assert.equal( feed( 30, 4 ), 0.5 );
	assert.equal( feed( 30, 4 ), null, 'clamped at min' );
	assert.equal( feed( 1000, 20 ), null, 'hitches over 250ms are ignored' );
	assert.equal( a.scale, 0.5 );
	assert.equal( feed( 16.6, 12 ), null, 'cooldown: 3 windows before raising' );
	assert.equal( feed( 16.6, 4 ), 0.75, 'vsync-locked 60 Hz counts as headroom' );
	assert.equal( feed( 16.6, 4 ), 1 );
	assert.equal( feed( 16.6, 4 ), null, 'clamped at max' );

} );

test( 'instanceMeshes folds shared geometry+material into one InstancedMesh per group', () => {

	const belt = new Group();
	belt.position.set( 10, 0, 0 );
	const rock = new BoxGeometry(), stone = new MeshBasicMaterial(), other = new MeshBasicMaterial();
	for ( let i = 0; i < 20; i ++ ) { const m = new Mesh( rock, stone ); m.position.set( i, 0, 0 ); belt.add( m ); }
	for ( let i = 0; i < 3; i ++ ) belt.add( new Mesh( rock, other ) );           // too few
	const keep = new Mesh( rock, stone ); keep.userData.noInstance = true; belt.add( keep );

	const report = instanceMeshes( belt );
	assert.equal( report.groups, 1 );
	assert.equal( report.meshes, 20 );
	assert.equal( report.drawCallsSaved, 19 );

	const inst = report.instanced[ 0 ];
	assert.equal( inst.parent, belt );
	assert.equal( inst.count, 20 );
	assert.equal( belt.children.length, 1 + 3 + 1, 'instanced + 3 others + opted-out mesh' );

	// transforms are relative to the root, so the root can still move
	const m = new Mesh(); inst.getMatrixAt( 7, m.matrix );
	assert.deepEqual( new Vector3().setFromMatrixPosition( m.matrix ).toArray(), [ 7, 0, 0 ] );

} );

test( 'world.optimize leaves meshes with events alone; adaptive scale drives the resizer', () => {

	const renderer = { domElement: null, setSize() {}, setPixelRatio( r ) { this.ratio = r; }, render() {}, dispose() {} };
	const world = new World( { container: null, createRenderer: () => renderer, adaptive: { window: 2, budgetMs: 16 }, warnings: false } );
	const geo = new BoxGeometry(), mat = new MeshBasicMaterial();
	const clickable = new Mesh( geo, mat );
	world.add( clickable );
	for ( let i = 0; i < 10; i ++ ) world.add( new Mesh( geo, mat ) );
	world.on( clickable, 'click', () => {} );

	const report = world.optimize();
	assert.equal( report.meshes, 10 );
	assert.equal( clickable.parent, world.scene, 'clickable mesh kept' );

	world._resize._measure = () => ( { width: 100, height: 100 } );
	world._tick( 0.05, 0.05 ); world._tick( 0.05, 0.1 );
	assert.equal( world.resolutionScale, 0.75 );
	for ( let i = 0; i < 10; i ++ ) world._tick( 1 / 60, 0 );
	assert.equal( world.resolutionScale, 1, 'climbs back once frames are on budget' );

} );

test( 'the canvas keeps its CSS size when the pixel ratio changes (retina, adaptive)', async () => {

	const { ResizeManager } = await import( '../src/ResizeManager.js' );
	const canvas = { style: {} };
	const renderer = { domElement: canvas, setPixelRatio( r ) { this.ratio = r; }, setSize( w, h ) { canvas.width = w * this.ratio; canvas.height = h * this.ratio; } };
	const camera = { aspect: 1, updateProjectionMatrix() {} };
	const rm = new ResizeManager( { container: null, camera, renderer }, { measure: () => ( { width: 800, height: 400 } ) } );
	rm.scale = 0.5;
	rm.update();
	assert.equal( canvas.width, 400 * ( globalThis.devicePixelRatio ?? 1 ), 'backing store follows the scale' );
	assert.equal( canvas.style.width, '800px', 'but it still fills the container' );
	assert.equal( canvas.style.height, '400px' );

} );
