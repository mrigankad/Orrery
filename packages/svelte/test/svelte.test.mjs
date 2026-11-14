import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM( '<!doctype html><div id="root"></div>', { pretendToBeVisual: true } );
Object.assign( globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: dom.window.requestAnimationFrame, cancelAnimationFrame: dom.window.cancelAnimationFrame } );
const fakeRenderer = () => ( { domElement: document.createElement( 'canvas' ), setSize() {}, setPixelRatio() {}, render() {}, dispose() { this.disposed = true; } } );
const wait = ( ms = 30 ) => new Promise( ( r ) => setTimeout( r, ms ) );

const { BoxGeometry, Mesh, MeshBasicMaterial } = await import( 'three' );
const { World } = await import( '@orreryjs/core' );
const { orrery, track, frame, listen, load } = await import( '../src/index.js' );

test( 'the orrery action creates, starts and disposes a World on its element', async () => {

	const node = document.createElement( 'div' );
	document.body.appendChild( node );
	let world = null;
	const action = orrery( node, { options: { createRenderer: fakeRenderer, warnings: false }, onCreated: ( w ) => ( world = w ) } );
	await wait();

	assert.ok( world );
	assert.equal( node.querySelector( 'canvas' ), world.renderer.domElement );
	assert.equal( world._loop.running, true );
	assert.equal( node.style.position, 'relative' );

	const renderer = world.renderer;
	action.destroy();
	assert.equal( renderer.disposed, true );

} );

test( 'track, frame and listen return cleanups that undo themselves', () => {

	const world = new World( { container: null, createRenderer: fakeRenderer, warnings: false } );
	const geo = new BoxGeometry();
	let freed = 0;
	geo.addEventListener( 'dispose', () => freed ++ );
	const cube = new Mesh( geo, new MeshBasicMaterial() );

	const untrack = track( world, cube );
	let frames = 0, clicks = 0;
	const unframe = frame( world, () => frames ++ );
	const unlisten = listen( world, cube, 'click', () => clicks ++ );

	world._tick( 1 / 60, 0 );
	world.emit( cube, 'click' );
	assert.deepEqual( [ cube.parent === world.scene, frames, clicks ], [ true, 1, 1 ] );

	unframe(); unlisten();
	world._tick( 1 / 60, 0 );
	world.emit( cube, 'click' );
	assert.deepEqual( [ frames, clicks ], [ 1, 1 ], 'unsubscribed' );

	untrack();
	assert.equal( cube.parent, null );
	assert.equal( freed, 1 );

	const kept = new Mesh( new BoxGeometry(), new MeshBasicMaterial() );
	track( world, kept, { dispose: false } )();
	assert.equal( kept.parent, null );

} );

test( 'load ignores results that arrive after cleanup', async () => {

	let resolve;
	const world = { load: () => new Promise( ( r ) => { resolve = r; } ) };
	const got = [];
	const cancel = load( world, 'a.glb', ( d ) => got.push( d ) );
	cancel();
	resolve( 'late' );
	await wait( 5 );
	assert.deepEqual( got, [] );

} );
