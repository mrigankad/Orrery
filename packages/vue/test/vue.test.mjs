import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM( '<!doctype html><div id="root"></div>', { pretendToBeVisual: true } );
Object.assign( globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement, getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: dom.window.requestAnimationFrame, cancelAnimationFrame: dom.window.cancelAnimationFrame } );
const fakeRenderer = () => ( { domElement: document.createElement( 'canvas' ), setSize() {}, setPixelRatio() {}, render() {}, dispose() { this.disposed = true; } } );
const wait = ( ms = 30 ) => new Promise( ( r ) => setTimeout( r, ms ) );

const { createApp, defineComponent, h, nextTick, ref } = await import( 'vue' );
const { BoxGeometry, Mesh, MeshBasicMaterial } = await import( 'three' );
const { OrreryCanvas, useWorld, useFrame, useObject, useEvent } = await import( '../src/index.js' );

test( 'OrreryCanvas provides a World; composables add, animate, listen and clean up', async () => {

	let world = null, frames = 0, clicks = 0, freed = 0;
	const geo = new BoxGeometry();
	geo.addEventListener( 'dispose', () => freed ++ );
	const cube = new Mesh( geo, new MeshBasicMaterial() );
	const other = new Mesh( new BoxGeometry(), new MeshBasicMaterial() );
	const current = ref( cube );
	const show = ref( true );

	const Child = defineComponent( { setup() {

		world = useWorld();
		useObject( current );
		useFrame( () => { frames ++; } );
		useEvent( current, 'click', () => { clicks ++; } );
		return () => null;

	} } );

	const App = defineComponent( { setup: () => () => h( OrreryCanvas, { options: { createRenderer: fakeRenderer, warnings: false } }, { default: () => ( show.value ? h( Child ) : null ) } ) } );
	const app = createApp( App );
	app.mount( '#root' );
	await wait(); await nextTick();

	assert.ok( world, 'World provided' );
	assert.equal( cube.parent, world.scene );
	world._tick( 1 / 60, 0 );
	assert.ok( frames >= 1 );
	world.emit( cube, 'click' );
	assert.equal( clicks, 1 );

	current.value = other;
	await nextTick();
	assert.equal( cube.parent, null, 'old object removed' );
	assert.equal( freed, 1, 'and freed' );
	assert.equal( other.parent, world.scene );
	world.emit( other, 'click' );
	assert.equal( clicks, 2, 'event followed the ref' );

	show.value = false;
	await nextTick();
	assert.equal( other.parent, null );
	const renderer = world.renderer;
	app.unmount();
	assert.equal( renderer.disposed, true, 'World disposed with the canvas' );

} );

test( 'useWorld outside OrreryCanvas explains itself', () => {

	const app = createApp( defineComponent( { setup() { useWorld(); return () => null; } } ) );
	let message = '';
	app.config.errorHandler = ( e ) => { message = e.message; };
	app.config.warnHandler = () => {};
	app.mount( document.createElement( 'div' ) );
	assert.match( message, /inside <OrreryCanvas>/ );

} );
