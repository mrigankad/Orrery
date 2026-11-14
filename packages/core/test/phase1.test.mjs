import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Texture } from 'three';
import { createAssetLoader, assetKind } from '../src/assets.js';
import { World } from '../src/World.js';

const here = dirname( fileURLToPath( import.meta.url ) );

test( 'every three/addons path Orrery imports exists in the installed three', () => {

	// Guards against upstream renames like RGBELoader -> HDRLoader in r184.
	const require = createRequire( import.meta.url );
	const threeRoot = dirname( dirname( require.resolve( 'three' ) ) );
	const srcDir = join( here, '..', 'src' );
	const missing = [];

	for ( const file of readdirSync( srcDir ) ) {

		const code = readFileSync( join( srcDir, file ), 'utf8' );
		for ( const [ , path ] of code.matchAll( /'three\/addons\/([^']+)'/g ) ) {

			if ( ! existsSync( join( threeRoot, 'examples', 'jsm', path ) ) ) missing.push( `${ file }: ${ path }` );

		}

	}

	assert.deepEqual( missing, [] );

} );

test( 'assetKind maps extensions and rejects unknown ones', () => {

	assert.equal( assetKind( 'models/robot.GLB?v=2' ), 'gltf' );
	assert.equal( assetKind( 'scene.gltf#node' ), 'gltf' );
	assert.equal( assetKind( 'sky.hdr' ), 'hdr' );
	assert.equal( assetKind( 'albedo.ktx2' ), 'ktx2' );
	assert.equal( assetKind( 'albedo.webp' ), 'texture' );
	assert.throws( () => assetKind( 'thing.fbx' ), /don't know how to load "\.fbx"/ );

} );

function fakeLoaders( log ) {

	class Base {

		constructor( manager ) { this.manager = manager; }
		loadAsync( url ) {

			log.push( [ this.constructor.name, url ] );
			this.manager.itemStart( url );
			this.manager.itemEnd( url );
			return Promise.resolve( this.constructor.name === 'TextureLoader' ? new Texture() : { url, by: this.constructor.name } );

		}

	}

	class DRACOLoader extends Base { setDecoderPath( p ) { this.path = p; return this; } dispose() { log.push( [ 'draco.dispose' ] ); } }
	class KTX2Loader extends Base { setTranscoderPath( p ) { this.path = p; return this; } detectSupport() { log.push( [ 'ktx2.detect' ] ); return this; } dispose() {} }
	class GLTFLoader extends Base {

		setDRACOLoader( d ) { this.dracoLoader = d; log.push( [ 'draco', d.path ] ); }
		setKTX2Loader( k ) { log.push( [ 'ktx2', k.path ] ); }
		setMeshoptDecoder( m ) { log.push( [ 'meshopt', !! m ] ); }

	}
	class HDRLoader extends Base {}
	class TextureLoader extends Base {}

	return { DRACOLoader, KTX2Loader, GLTFLoader, HDRLoader, TextureLoader, MeshoptDecoder: {} };

}

test( 'load() routes by extension, wires decoders once, caches and reports progress', async () => {

	const log = [];
	const assets = createAssetLoader( { renderer: {}, decoderPath: 'https://cdn/x/', loaders: fakeLoaders( log ) } );
	const progress = [];
	assets.onProgress( ( p ) => progress.push( p ) );

	const [ a, b ] = await Promise.all( [ assets.load( 'a.glb' ), assets.load( 'a.glb' ) ] );
	assert.equal( a, b, 'same URL shares one promise' );
	await assets.load( 'b.gltf' );

	const hdr = await assets.load( 'sky.hdr' );
	assert.equal( hdr.by, 'HDRLoader' );

	const tex = await assets.load( 'albedo.png' );
	assert.equal( tex.colorSpace, 'srgb' );

	assert.deepEqual( log.filter( ( e ) => e[ 0 ] === 'draco' ), [ [ 'draco', 'https://cdn/x/draco/gltf/' ] ], 'draco wired once' );
	assert.deepEqual( log.filter( ( e ) => e[ 0 ] === 'ktx2' ), [ [ 'ktx2', 'https://cdn/x/basis/' ] ] );
	assert.ok( log.some( ( e ) => e[ 0 ] === 'meshopt' && e[ 1 ] ) );
	assert.equal( log.filter( ( e ) => e[ 0 ] === 'GLTFLoader' ).length, 2, 'a.glb fetched once, b.gltf once' );

	assert.ok( progress.length >= 4 );
	assert.equal( progress.at( - 1 ).done, true );

	await assets.dispose();
	assert.ok( log.some( ( e ) => e[ 0 ] === 'draco.dispose' ) );
	assert.equal( assets.cache.size, 0 );

} );

test( 'a failed load is evicted so it can be retried', async () => {

	const loaders = fakeLoaders( [] );
	let fail = true;
	loaders.HDRLoader = class { loadAsync() { return fail ? Promise.reject( new Error( '404' ) ) : Promise.resolve( 'ok' ); } };
	const assets = createAssetLoader( { loaders } );

	await assert.rejects( assets.load( 'sky.hdr' ), /404/ );
	fail = false;
	assert.equal( await assets.load( 'sky.hdr' ), 'ok' );

} );

test( 'World.create honours an injected renderer and reports its backend', async () => {

	const renderer = { isWebGPURenderer: true, backend: { isWebGLBackend: true }, domElement: null, setSize() {}, setPixelRatio() {}, render() {}, dispose() {} };
	const world = await World.create( { container: null, createRenderer: () => renderer } );
	assert.ok( world instanceof World );
	assert.equal( world.backend, 'webgl2' );
	assert.equal( typeof world.load, 'function' );

} );

test( 'onGpuLost fires once for a lost WebGPU device and late subscribers still hear it', async () => {

	let threeHandled = 0;
	const renderer = { isWebGPURenderer: true, backend: { isWebGPUBackend: true }, domElement: null, setSize() {}, setPixelRatio() {}, render() {}, dispose() {}, onDeviceLost() { threeHandled ++; } };
	const world = await World.create( { container: null, createRenderer: () => renderer, warnings: false } );

	const seen = [];
	world.onGpuLost( ( info ) => seen.push( info ) );
	renderer.onDeviceLost( { reason: 'unknown', message: 'DXGI_ERROR_DEVICE_HUNG' } );
	renderer.onDeviceLost( { reason: 'unknown', message: 'again' } );

	assert.equal( threeHandled, 2, "three's own handler still runs" );
	assert.equal( seen.length, 1 );
	assert.deepEqual( seen[ 0 ], { api: 'webgpu', reason: 'unknown', message: 'DXGI_ERROR_DEVICE_HUNG' } );

	const late = [];
	world.onGpuLost( ( info ) => late.push( info ) );
	assert.equal( late.length, 1 );

} );
