import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, Texture } from 'three';
import { World } from '../src/World.js';

function fakeRenderer() {

	const listeners = {};
	return {
		renderCount: 0,
		toneMapping: 0,
		outputColorSpace: '',
		domElement: {
			style: {},
			addEventListener: ( t, fn ) => { listeners[ t ] = fn; },
			removeEventListener: ( t ) => { delete listeners[ t ]; },
			getBoundingClientRect: () => ( { left: 0, top: 0, width: 100, height: 100 } )
		},
		listeners,
		setSize() {},
		setPixelRatio() {},
		render() { this.renderCount ++; },
		dispose() {}
	};

}

const makeWorld = ( extra = {} ) => new World( { container: null, createRenderer: fakeRenderer, ...extra } );

test( 'World is lit by default and sets tone mapping', () => {

	const world = makeWorld();
	assert.ok( world.lights, 'studio rig created' );
	assert.equal( world.lights.parent, world.scene );
	assert.notEqual( world.renderer.toneMapping, 0 );

	const bare = makeWorld( { lights: 'none', toneMapping: false } );
	assert.equal( bare.lights, null );
	assert.equal( bare.renderer.toneMapping, 0 );

} );

test( 'remove() detaches and frees geometry, material and textures', () => {

	const world = makeWorld();
	const map = new Texture();
	const mesh = new Mesh( new BoxGeometry(), new MeshStandardMaterial( { map } ) );
	world.add( mesh );

	let disposed = 0;
	for ( const r of [ mesh.geometry, mesh.material, map ] ) r.addEventListener( 'dispose', () => disposed ++ );

	const calls = world.remove( mesh );
	assert.equal( mesh.parent, null );
	assert.equal( calls, 3 );
	assert.equal( disposed, 3 );

} );

test( 'on() rejects unknown events and pick() finds the registered ancestor', () => {

	const world = makeWorld();
	assert.throws( () => world.on( world.scene, 'hover', () => {} ), /unknown event/ );

	const parent = new Mesh( new BoxGeometry(), new MeshBasicMaterial() );
	const child = new Mesh( new BoxGeometry( 0.5, 0.5, 0.5 ), new MeshBasicMaterial() );
	parent.add( child );
	world.add( parent );
	world.on( parent, 'click', () => {} );

	const result = world.pick( 0, 0 );
	assert.ok( result );
	assert.equal( result.object, parent );
	assert.equal( world.pick( 0.99, 0.99 ), null, 'misses empty space' );

} );

test( 'pointer events fire click, enter and leave once each', () => {

	const world = makeWorld();
	const mesh = new Mesh( new BoxGeometry(), new MeshBasicMaterial() );
	world.add( mesh );

	const log = [];
	world.on( mesh, 'click', () => log.push( 'click' ) );
	world.on( mesh, 'pointerenter', () => log.push( 'enter' ) );
	const off = world.on( mesh, 'pointerleave', () => log.push( 'leave' ) );

	world._resize.start = world._loop.start = () => {};
	world.start();
	const fire = ( type, x, y ) => world.renderer.listeners[ type ]( { type, clientX: x, clientY: y } );

	fire( 'pointermove', 50, 50 );
	fire( 'pointermove', 51, 50 ); // still inside: no duplicate enter
	assert.equal( world.renderer.domElement.style.cursor, 'pointer' );
	fire( 'click', 50, 50 );
	fire( 'pointermove', 1, 1 );
	off();
	fire( 'pointermove', 50, 50 );
	fire( 'pointerleave', 0, 0 );

	assert.deepEqual( log, [ 'enter', 'click', 'leave', 'enter' ] );
	world.stop();
	assert.equal( Object.keys( world.renderer.listeners ).length, 0, 'listeners removed on stop' );

} );

test( 'warns once when lit materials have no light', () => {

	const warnings = [];
	const original = console.warn;
	console.warn = ( msg ) => warnings.push( msg );

	try {

		const world = makeWorld( { lights: 'none', environment: 'none' } );
		world.add( new Mesh( new BoxGeometry(), new MeshStandardMaterial() ) );
		world._tick( 0.016, 0.016 );
		world._tick( 0.016, 0.032 );
		assert.equal( warnings.length, 1 );
		assert.match( warnings[ 0 ], /render black/ );

		const lit = makeWorld( { environment: 'none' } );
		lit.add( new Mesh( new BoxGeometry(), new MeshStandardMaterial() ) );
		lit._tick( 0.016, 0.016 );
		assert.equal( warnings.length, 1, 'no warning when lit' );

	} finally {

		console.warn = original;

	}

} );
