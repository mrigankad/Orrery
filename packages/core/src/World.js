import {
	Color,
	NeutralToneMapping,
	PMREMGenerator,
	Raycaster,
	SRGBColorSpace,
	Vector2
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SceneApp } from './SceneApp.js';
import { addStudioLighting } from './lighting.js';
import { disposeObject } from './dispose.js';
import { createAssetLoader } from './assets.js';
import { createAdaptiveResolution } from './adaptive.js';
import { instanceMeshes } from './optimize.js';

const POINTER_TYPES = [ 'click', 'pointerenter', 'pointerleave', 'pointerdown', 'pointerup' ];

/**
 * World is the Orrery entry point: a SceneApp with opinionated defaults that
 * remove the most common three.js traps.
 *
 * - Lit by default (studio lights and a RoomEnvironment IBL), so PBR materials
 *   are never black on first render.
 * - Neutral tone mapping (whites stay white) and sRGB output.
 * - `world.remove(obj)` detaches and frees GPU memory in one call.
 * - Object pointer events: `world.on(mesh, 'click', fn)`, plus
 *   `pointerenter`, `pointerleave`, `pointerdown`, `pointerup`.
 * - Warns once when it renders lit materials with no light at all.
 *
 * ```js
 * import { World } from 'orreryjs';
 * const world = new World( { container: document.querySelector( '#app' ) } );
 * world.add( mesh );
 * world.on( mesh, 'click', () => mesh.scale.multiplyScalar( 1.1 ) );
 * world.start();
 * ```
 */
class World extends SceneApp {

	/**
	 * @param {Object} [config] - All SceneApp options, plus:
	 * @param {('studio'|'none')} [config.lights='studio'] - Default light rig.
	 * @param {('room'|'none')} [config.environment='room'] - Default IBL.
	 * @param {boolean} [config.toneMapping=true] - Khronos PBR Neutral tone mapping + sRGB output.
	 * @param {boolean} [config.warnings=true] - Console hints for common traps.
	 */
	/**
	 * Creates a World on the best renderer the browser has. With
	 * `renderer: 'auto'` (default) that is three's WebGPURenderer, which
	 * itself falls back to a WebGL 2 backend when WebGPU is missing.
	 *
	 * @param {Object} [config] - Same as the constructor, plus
	 * `renderer: 'auto' | 'webgl2' | 'webgl'`.
	 * @return {Promise<World>}
	 */
	static async create( config = {} ) {

		const { renderer = 'auto', antialias = true } = config;

		if ( renderer === 'webgl' || config.createRenderer ) return new World( config );

		const webgpu = await import( 'three/webgpu' );
		const makeRenderer = async ( forceWebGL ) => {

			const r = new webgpu.WebGPURenderer( { antialias, forceWebGL } );
			await r.init();
			return r;

		};

		const instance = await makeRenderer( renderer === 'webgl2' );
		const world = new World( { ...config, createRenderer: () => instance, PMREMGenerator: webgpu.PMREMGenerator } );
		world._makeRenderer = makeRenderer;
		return world;

	}

	constructor( config = {} ) {

		super( config );

		const {
			lights = 'studio',
			environment = 'room',
			toneMapping = true,
			warnings = true,
			adaptive = false
		} = config;

		this.warnings = warnings;

		/** Frames rendered since start. @type {number} */
		this.frame = 0;

		/**
		 * Adaptive resolution controller, or null when off. Enable with
		 * `adaptive: true` or `adaptive: { min, max, budgetMs }`.
		 */
		this.adaptive = adaptive ? createAdaptiveResolution( adaptive === true ? {} : adaptive ) : null;
		this._warned = new Set();
		this._handlers = new Map(); // Object3D -> { type: Set<fn> }
		this._hovered = null;

		if ( toneMapping && 'toneMapping' in this.renderer ) {

			this.renderer.toneMapping = NeutralToneMapping;
			this.renderer.outputColorSpace = SRGBColorSpace;

		}

		const PMREM = config.PMREMGenerator ?? ( this.renderer.isWebGLRenderer ? PMREMGenerator : null );
		const useRoom = environment === 'room' && PMREM !== null;

		// When the room IBL is on it already lights the scene, so the studio rig
		// is dimmed to add shape without blowing out the exposure.
		this.lights = lights === 'studio' ? addStudioLighting( this.scene, { intensity: useRoom ? 0.35 : 1 } ) : null;

		this._PMREM = useRoom ? PMREM : null;
		this._toneMapping = toneMapping;
		this.recover = config.recover ?? true;
		this._rendererCallbacks = new Set();
		if ( useRoom ) this._buildEnvironment();

		// GPU loss: WebGPU device lost, or WebGL context lost. Reported once
		// through world.onGpuLost() and world.gpuLost.
		this.gpuLost = null;
		this._lostCallbacks = new Set();
		this._installLossHandler();

		this._onContextLost = ( event ) => this._reportGpuLost( { api: 'webgl', reason: 'context-lost', message: event?.statusMessage ?? '' } );
		if ( this.renderer.isWebGLRenderer ) this.renderer.domElement?.addEventListener?.( 'webglcontextlost', this._onContextLost );

		this._raycaster = new Raycaster();
		this._pointer = new Vector2();
		this._onPointer = ( event ) => this._handlePointer( event );

	}

	/**
	 * Which GPU path is drawing: `'webgpu'`, `'webgl2'` (WebGPURenderer's
	 * fallback) or `'webgl'` (classic WebGLRenderer). `'unknown'` for mocks.
	 *
	 * @type {string}
	 */
	get backend() {

		const r = this.renderer;
		if ( r.isWebGLRenderer ) return 'webgl';
		if ( r.backend?.isWebGPUBackend ) return 'webgpu';
		if ( r.backend?.isWebGLBackend ) return 'webgl2';
		return 'unknown';

	}

	_installLossHandler() {

		const renderer = this.renderer;
		if ( typeof renderer.onDeviceLost !== 'function' ) return;
		const original = renderer.onDeviceLost;
		renderer.onDeviceLost = ( info ) => {

			original.call( renderer, info );
			if ( renderer === this.renderer ) this._reportGpuLost( { api: 'webgpu', reason: info?.reason ?? 'unknown', message: info?.message ?? '' } );

		};

	}

	/**
	 * Called once if the GPU device (WebGPU) or context (WebGL) is lost, for
	 * example after a driver reset. Receives `{ api, reason, message }`.
	 *
	 * @param {Function} fn
	 * @return {Function} Unsubscribe.
	 */
	onGpuLost( fn ) {

		this._lostCallbacks.add( fn );
		if ( this.gpuLost ) fn( this.gpuLost );
		return () => this._lostCallbacks.delete( fn );

	}

	_reportGpuLost( info ) {

		if ( this.gpuLost ) return;
		const canRecover = this.recover && info.api === 'webgpu' && typeof this._makeRenderer === 'function' && ! this.recovered;
		this.gpuLost = { ...info, recovering: canRecover };

		if ( this.warnings ) {

			console.warn( canRecover
				? `Orrery: the GPU device was lost (${ info.reason }). Switching to the WebGL 2 backend.`
				: `Orrery: the GPU ${ info.api === 'webgpu' ? 'device' : 'context' } was lost (${ info.reason }). Reload the page or recreate the World.` );

		}

		for ( const fn of [ ...this._lostCallbacks ] ) fn( this.gpuLost );
		if ( canRecover ) this._recoverRenderer().catch( ( error ) => console.error( 'Orrery: recovery failed.', error ) );

	}

	_buildEnvironment() {

		const pmrem = new this._PMREM( this.renderer );
		const room = new RoomEnvironment();
		this.scene.environment = pmrem.fromScene( room, 0.04 ).texture;
		this.scene.environmentIntensity = 0.6;
		room.dispose();
		pmrem.dispose();

	}

	/**
	 * Replaces a lost WebGPU renderer with WebGPURenderer's WebGL 2 backend and
	 * carries on. Scene objects are renderer-independent, so geometries,
	 * materials and textures upload again on the next frame.
	 */
	async _recoverRenderer() {

		const old = this.renderer;
		const wasRunning = this._loop.running;
		this.stop();

		const next = await this._makeRenderer( true );
		if ( old.getClearColor ) next.setClearColor( old.getClearColor( new Color() ), old.getClearAlpha() );
		next.toneMapping = old.toneMapping;
		next.outputColorSpace = old.outputColorSpace;

		const parent = old.domElement.parentNode;
		if ( parent ) parent.replaceChild( next.domElement, old.domElement );

		this.renderer = next;
		this._resize.renderer = next;
		this._resize.update();
		this._installLossHandler();
		if ( this._PMREM ) this._buildEnvironment();
		try { old.dispose(); } catch { /* the old device is gone */ }

		this.gpuLost = null;
		this.recovered = ( this.recovered ?? 0 ) + 1;
		for ( const fn of [ ...this._rendererCallbacks ] ) fn( next, old );
		if ( wasRunning ) this.start();

	}

	/**
	 * Called with `(renderer, previous)` when the World swaps its renderer, for
	 * example after recovering from a lost GPU device.
	 *
	 * @param {Function} fn
	 * @return {Function} Unsubscribe.
	 */
	onRendererChange( fn ) {

		this._rendererCallbacks.add( fn );
		return () => this._rendererCallbacks.delete( fn );

	}

	/**
	 * The world's asset loader (created on first use). See `createAssetLoader`.
	 *
	 * @type {Object}
	 */
	get assets() {

		return this._assets ??= createAssetLoader( { renderer: this.renderer } );

	}

	/**
	 * Loads any supported asset by extension: glTF/GLB (Draco, KTX2 and
	 * Meshopt ready), HDR, KTX2, or an image texture (sRGB). Cached by URL.
	 *
	 * @param {string} url
	 * @return {Promise<any>}
	 */
	load( url ) {

		return this.assets.load( url );

	}

	/**
	 * Adds objects to the scene.
	 *
	 * @param {...Object3D} objects
	 * @return {World}
	 */
	add( ...objects ) {

		this.scene.add( ...objects );
		return this;

	}

	/**
	 * Removes an object from its parent and frees its GPU resources
	 * (geometries, materials, textures) and its event handlers.
	 *
	 * @param {Object3D} object
	 * @param {Object} [options]
	 * @param {boolean} [options.dispose=true] - Free GPU memory.
	 * @return {number} Number of dispose() calls made.
	 */
	remove( object, { dispose = true } = {} ) {

		if ( object.parent ) object.parent.remove( object );

		object.traverse?.( ( node ) => this._handlers.delete( node ) );
		if ( this._hovered && ! this._isAttached( this._hovered ) ) this._hovered = null;

		return dispose ? disposeObject( object ) : 0;

	}

	/**
	 * Subscribes to a pointer event on an object (or any of its descendants).
	 *
	 * @param {Object3D} object
	 * @param {('click'|'pointerenter'|'pointerleave'|'pointerdown'|'pointerup')} type
	 * @param {function(Object):void} callback - Receives the raycast hit.
	 * @return {Function} Unsubscribe function.
	 */
	on( object, type, callback ) {

		if ( ! POINTER_TYPES.includes( type ) ) {

			throw new Error( `Orrery: unknown event "${ type }". Use one of ${ POINTER_TYPES.join( ', ' ) }.` );

		}

		let byType = this._handlers.get( object );
		if ( ! byType ) this._handlers.set( object, byType = {} );
		( byType[ type ] ??= new Set() ).add( callback );

		return () => byType[ type ]?.delete( callback );

	}

	start() {

		super.start();

		const el = this.renderer.domElement;
		if ( el && el.addEventListener ) {

			for ( const t of [ 'click', 'pointermove', 'pointerdown', 'pointerup', 'pointerleave' ] ) {

				el.addEventListener( t, this._onPointer );

			}

		}

		return this;

	}

	stop() {

		const el = this.renderer.domElement;
		if ( el && el.removeEventListener ) {

			for ( const t of [ 'click', 'pointermove', 'pointerdown', 'pointerup', 'pointerleave' ] ) {

				el.removeEventListener( t, this._onPointer );

			}

		}

		return super.stop();

	}

	/**
	 * Raycasts and returns the closest registered object and hit, or null.
	 *
	 * @param {number} ndcX - Normalised device x (-1..1).
	 * @param {number} ndcY - Normalised device y (-1..1).
	 * @return {?{object: Object3D, hit: Object}}
	 */
	pick( ndcX, ndcY ) {

		const targets = [ ...this._handlers.keys() ].filter( ( o ) => this._isAttached( o ) );
		if ( targets.length === 0 ) return null;

		this._pointer.set( ndcX, ndcY );
		this.camera.updateMatrixWorld();
		this._raycaster.setFromCamera( this._pointer, this.camera );

		for ( const hit of this._raycaster.intersectObjects( targets, true ) ) {

			for ( let node = hit.object; node; node = node.parent ) {

				if ( this._handlers.has( node ) ) return { object: node, hit };

			}

		}

		return null;

	}

	_isAttached( object ) {

		let node = object;
		while ( node.parent ) node = node.parent;
		return node === this.scene;

	}

	/**
	 * Fires a pointer event on an object as if it came from the pointer, for
	 * keyboard access and tests. `hit` is null when there is no raycast.
	 *
	 * @param {Object3D} object
	 * @param {string} type - One of the world.on() event types.
	 * @param {?Object} [hit=null]
	 */
	emit( object, type, hit = null ) {

		this._emit( object, type, hit );

	}

	/**
	 * Whether an object (or an ancestor) has a handler for an event type.
	 *
	 * @param {Object3D} object
	 * @param {string} [type='click']
	 * @return {boolean}
	 */
	hasListener( object, type = 'click' ) {

		for ( let n = object; n; n = n.parent ) if ( this._handlers.get( n )?.[ type ]?.size ) return true;
		return false;

	}

	_emit( object, type, hit ) {

		const set = object && this._handlers.get( object )?.[ type ];
		if ( set ) for ( const fn of [ ...set ] ) fn( hit );

	}

	_handlePointer( event ) {

		if ( event.type === 'pointerleave' ) {

			if ( this._hovered ) this._emit( this._hovered, 'pointerleave', null );
			this._hovered = null;
			this._setCursor( false );
			return;

		}

		const rect = this.renderer.domElement.getBoundingClientRect();
		const x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
		const y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;
		const result = this.pick( x, y );
		const target = result ? result.object : null;

		if ( event.type === 'pointermove' ) {

			if ( target !== this._hovered ) {

				if ( this._hovered ) this._emit( this._hovered, 'pointerleave', result?.hit ?? null );
				if ( target ) this._emit( target, 'pointerenter', result.hit );
				this._hovered = target;
				this._setCursor( !! target && !! this._handlers.get( target )?.click?.size );

			}

			return;

		}

		if ( target ) this._emit( target, event.type, result.hit );

	}

	_setCursor( pointer ) {

		const el = this.renderer.domElement;
		if ( el && el.style ) el.style.cursor = pointer ? 'pointer' : '';

	}

	/**
	 * The current resolution scale (1 = full device pixel ratio).
	 *
	 * @type {number}
	 */
	get resolutionScale() {

		return this._resize.scale;

	}

	/**
	 * Folds meshes that share geometry and material into InstancedMeshes.
	 * Meshes with pointer events are left alone so events keep working.
	 *
	 * @param {Object} [root=this.scene]
	 * @param {Object} [options] - See `instanceMeshes`.
	 * @return {{groups: number, meshes: number, drawCallsSaved: number}}
	 */
	optimize( root = this.scene, options = {} ) {

		const userSkip = options.skip ?? ( () => false );
		const hasEvents = ( m ) => { for ( let n = m; n; n = n.parent ) if ( this._handlers.has( n ) ) return true; return false; };
		return instanceMeshes( root, { ...options, skip: ( m ) => hasEvents( m ) || userSkip( m ) } );

	}

	_tick( delta, elapsed ) {

		if ( this.adaptive && ! ( typeof document !== 'undefined' && document.hidden ) ) {

			const next = this.adaptive.feed( delta * 1000 );
			if ( next !== null ) {

				this._resize.scale = next;
				this._resize.update();

			}

		}

		this.frame ++;
		super._tick( delta, elapsed );
		if ( this.warnings && ! this._warned.has( 'unlit' ) ) this._checkUnlit();

	}

	_checkUnlit() {

		let hasLight = !! this.scene.environment;
		let hasLitMaterial = false;

		this.scene.traverse( ( node ) => {

			if ( node.isLight && ! node.isAmbientLight ) hasLight = true;
			const mats = Array.isArray( node.material ) ? node.material : node.material ? [ node.material ] : [];
			for ( const m of mats ) if ( m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial ) hasLitMaterial = true;

		} );

		this._warned.add( 'unlit' );

		if ( hasLitMaterial && ! hasLight ) {

			console.warn( 'Orrery: the scene has lit materials but no lights or environment, so they will render black. Use new World() with the default lights, or add a light.' );

		}

	}

	dispose() {

		this.stop();
		disposeObject( this.scene );
		this.scene.environment?.dispose?.();
		this._handlers.clear();
		this._assets?.dispose();
		this.renderer.domElement?.removeEventListener?.( 'webglcontextlost', this._onContextLost );
		this._lostCallbacks.clear();
		super.dispose();

	}

}

export { World };
