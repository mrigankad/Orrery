import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM( '<!doctype html><div id="root"></div>', { pretendToBeVisual: true } );
Object.assign( globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, requestAnimationFrame: dom.window.requestAnimationFrame, cancelAnimationFrame: dom.window.cancelAnimationFrame, IS_REACT_ACT_ENVIRONMENT: true } );

const React = await import( 'react' );
const { createRoot } = await import( 'react-dom/client' );
const { act } = await import( 'react' );
const { BoxGeometry, Mesh, MeshBasicMaterial } = await import( 'three' );
const { OrreryCanvas, useWorld, useFrame, useObject, useEvent } = await import( '../src/index.js' );

const h = React.createElement;
const fakeRenderer = () => ( { domElement: document.createElement( 'canvas' ), setSize() {}, setPixelRatio() {}, render() {}, dispose() { this.disposed = true; } } );
const flush = () => act( () => new Promise( ( r ) => setTimeout( r, 20 ) ) );

test( 'OrreryCanvas creates a World, hooks add objects, run frames and clean up', async () => {

	let worldSeen = null, frames = 0, clicked = 0;
	const geometry = new BoxGeometry();
	let disposed = 0;
	geometry.addEventListener( 'dispose', () => disposed ++ );
	const cube = new Mesh( geometry, new MeshBasicMaterial() );

	function Cube( { show } ) {

		const world = useWorld();
		worldSeen = world;
		useObject( show ? cube : null );
		useFrame( () => { frames ++; } );
		useEvent( cube, 'click', () => { clicked ++; } );
		return null;

	}

	const root = createRoot( document.getElementById( 'root' ) );
	await act( async () => root.render( h( OrreryCanvas, { options: { createRenderer: fakeRenderer, warnings: false }, fallback: h( 'p', null, 'loading' ) }, h( Cube, { show: true } ) ) ) );
	await flush();

	assert.ok( worldSeen, 'World provided to children' );
	assert.equal( cube.parent, worldSeen.scene, 'useObject added the cube' );
	assert.ok( document.querySelector( '#root canvas' ), 'canvas mounted inside the wrapper' );

	worldSeen._tick( 1 / 60, 0 );
	assert.ok( frames >= 1, 'useFrame runs' );

	worldSeen.emit( cube, 'click' );
	assert.equal( clicked, 1, 'useEvent subscribed' );

	await act( async () => root.render( h( OrreryCanvas, { options: { createRenderer: fakeRenderer, warnings: false } }, h( Cube, { show: false } ) ) ) );
	assert.equal( cube.parent, null, 'removed when the hook lets go' );
	assert.equal( disposed, 1, 'and its geometry was freed' );

	const renderer = worldSeen.renderer;
	await act( async () => root.unmount() );
	assert.equal( renderer.disposed, true, 'World disposed on unmount' );

} );

test( 'useWorld outside OrreryCanvas explains itself', async () => {

	function Lost() { useWorld(); return null; }
	const original = console.error;
	console.error = () => {};
	const root = createRoot( document.createElement( 'div' ) );
	try {

		await assert.rejects( async () => { await act( async () => root.render( h( Lost ) ) ); }, /inside <OrreryCanvas>/ );

	} finally { console.error = original; }

} );
