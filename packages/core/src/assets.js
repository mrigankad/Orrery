import { LoadingManager, REVISION, SRGBColorSpace } from 'three';

/**
 * Where decoder files are fetched from when no path is given. They are pinned
 * to the installed three revision so decoder and loader always match.
 */
const CDN = `https://cdn.jsdelivr.net/npm/three@0.${ REVISION }.0/examples/jsm/libs/`;

const KIND_BY_EXT = {
	glb: 'gltf', gltf: 'gltf',
	hdr: 'hdr',
	ktx2: 'ktx2',
	png: 'texture', jpg: 'texture', jpeg: 'texture', webp: 'texture', avif: 'texture', gif: 'texture'
};

/**
 * Returns the asset kind for a URL from its extension, ignoring query strings
 * and hashes. Throws for extensions Orrery does not know how to load.
 *
 * @param {string} url
 * @return {('gltf'|'hdr'|'ktx2'|'texture')}
 */
function assetKind( url ) {

	const clean = String( url ).split( /[?#]/ )[ 0 ];
	const ext = clean.slice( clean.lastIndexOf( '.' ) + 1 ).toLowerCase();
	const kind = KIND_BY_EXT[ ext ];

	if ( ! kind ) {

		throw new Error( `Orrery: don't know how to load ".${ ext }" (${ url }). Supported: ${ Object.keys( KIND_BY_EXT ).join( ', ' ) }.` );

	}

	return kind;

}

/**
 * Creates a `load(url)` function that picks the right three.js loader from the
 * file extension and wires up Draco, KTX2 (Basis) and Meshopt for glTF with no
 * setup. Results are cached by URL, and progress across every load is reported
 * through one callback.
 *
 * ```js
 * const assets = createAssetLoader( { renderer } );
 * assets.onProgress( ( { loaded, total } ) => bar.style.width = `${ loaded / total * 100 }%` );
 * const gltf = await assets.load( 'robot.glb' );       // Draco / KTX2 / Meshopt ready
 * const env  = await assets.load( 'studio.hdr' );      // equirectangular HDR texture
 * const tex  = await assets.load( 'albedo.jpg' );      // sRGB colour texture
 * ```
 *
 * @param {Object} [options]
 * @param {Object} [options.renderer] - Needed for KTX2 format detection.
 * @param {string} [options.decoderPath] - Base URL that holds `draco/gltf/` and
 * `basis/`. Defaults to jsDelivr pinned to the installed three revision.
 * @param {Object} [options.loaders] - Override loader classes (for tests).
 * @return {{load: function(string): Promise<any>, onProgress: function(Function): Function, cache: Map, dispose: Function}}
 */
function createAssetLoader( options = {} ) {

	const { renderer = null, decoderPath = CDN, loaders: overrides = {} } = options;

	const listeners = new Set();
	const cache = new Map();
	const state = { loaded: 0, total: 0, url: '' };

	const manager = new LoadingManager();
	manager.onStart = ( url, loaded, total ) => emit( url, loaded, total );
	manager.onProgress = ( url, loaded, total ) => emit( url, loaded, total );

	function emit( url, loaded, total ) {

		state.url = url;
		state.loaded = loaded;
		state.total = total;
		for ( const fn of [ ...listeners ] ) fn( { ...state, done: loaded >= total } );

	}

	let gltfLoaderPromise = null;
	let ktx2Promise = null;

	async function getClass( name, path ) {

		if ( overrides[ name ] ) return overrides[ name ];
		const mod = await import( /* @vite-ignore */ path );
		return mod[ name ];

	}

	function getKTX2() {

		return ktx2Promise ??= ( async () => {

			const KTX2Loader = await getClass( 'KTX2Loader', 'three/addons/loaders/KTX2Loader.js' );
			const ktx2 = new KTX2Loader( manager ).setTranscoderPath( decoderPath + 'basis/' );
			if ( renderer && typeof ktx2.detectSupport === 'function' ) ktx2.detectSupport( renderer );
			return ktx2;

		} )();

	}

	function getGLTF() {

		return gltfLoaderPromise ??= ( async () => {

			const GLTFLoader = await getClass( 'GLTFLoader', 'three/addons/loaders/GLTFLoader.js' );
			const DRACOLoader = await getClass( 'DRACOLoader', 'three/addons/loaders/DRACOLoader.js' );
			const gltf = new GLTFLoader( manager );
			gltf.setDRACOLoader( new DRACOLoader( manager ).setDecoderPath( decoderPath + 'draco/gltf/' ) );
			if ( renderer ) gltf.setKTX2Loader( await getKTX2() );

			const meshopt = overrides.MeshoptDecoder ?? ( await import( 'three/addons/libs/meshopt_decoder.module.js' ) ).MeshoptDecoder;
			if ( meshopt ) gltf.setMeshoptDecoder( meshopt );
			return gltf;

		} )();

	}

	async function loadUncached( url ) {

		switch ( assetKind( url ) ) {

			case 'gltf': return ( await getGLTF() ).loadAsync( url );
			case 'ktx2': return ( await getKTX2() ).loadAsync( url );

			case 'hdr': {

				const HDRLoader = await getClass( 'HDRLoader', 'three/addons/loaders/HDRLoader.js' );
				return new HDRLoader( manager ).loadAsync( url );

			}

			case 'texture': {

				const TextureLoader = overrides.TextureLoader ?? ( await import( 'three' ) ).TextureLoader;
				const texture = await new TextureLoader( manager ).loadAsync( url );
				texture.colorSpace = SRGBColorSpace;
				return texture;

			}

		}

	}

	return {

		/**
		 * Loads (or returns the cached promise for) an asset.
		 *
		 * @param {string} url
		 * @return {Promise<any>}
		 */
		load( url ) {

			if ( cache.has( url ) ) return cache.get( url );

			const promise = loadUncached( url );
			promise.catch( () => { if ( cache.get( url ) === promise ) cache.delete( url ); } );
			cache.set( url, promise );
			return promise;

		},

		/**
		 * Subscribes to aggregate progress: `{ url, loaded, total, done }`.
		 *
		 * @param {Function} fn
		 * @return {Function} Unsubscribe.
		 */
		onProgress( fn ) {

			listeners.add( fn );
			return () => listeners.delete( fn );

		},

		manager,
		cache,

		/** Clears the cache and releases decoder workers. */
		async dispose() {

			cache.clear();
			if ( ktx2Promise ) ( await ktx2Promise ).dispose?.();
			if ( gltfLoaderPromise ) ( await gltfLoaderPromise ).dracoLoader?.dispose?.();
			gltfLoaderPromise = ktx2Promise = null;

		}

	};

}

export { createAssetLoader, assetKind };
