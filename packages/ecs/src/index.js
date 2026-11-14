/**
 * A small entity-component-system for Orrery. Entities are your existing
 * Object3Ds, traits are plain data attached to them, queries are cached and
 * kept live, and systems run every frame inside the world loop.
 *
 * ```js
 * const ecs = createECS( world );
 * const Orbit = ecs.trait( { speed: 1 } );
 *
 * ecs.add( planet, Orbit( { speed: 0.4 } ) );
 * ecs.system( ( dt ) => {
 *   for ( const [ object, orbit ] of ecs.each( Orbit ) ) object.rotation.y += orbit.speed * dt;
 * } );
 * ```
 */

let traitIds = 0;

/**
 * Wraps a trait to match entities that do NOT have it: `ecs.query(Spin, Not(Frozen))`.
 *
 * @param {Function} trait
 * @return {{not: Function}}
 */
function Not( trait ) {

	return { not: trait };

}

/**
 * @param {Object} world - An Orrery World (anything with `scene` and `onUpdate`).
 * @param {Object} [options]
 * @param {number} [options.sweepEvery=15] - Frames between checks for entities
 * whose object left the scene.
 * @return {Object}
 */
function createECS( world, options = {} ) {

	const { sweepEvery = 15 } = options;

	const entities = new Map();         // Object3D -> Map<trait, data>
	const queries = new Map();          // key -> { all, none, list: Object3D[], set: Set }
	const addHooks = new Map();         // trait -> Set<fn>
	const removeHooks = new Map();
	const systems = [];
	let frame = 0;

	// ---- traits ---------------------------------------------------------------

	/**
	 * Defines a trait. Calling the returned function makes an instance with the
	 * defaults merged in; passing the trait itself uses the defaults.
	 *
	 * @param {Object|Function} [defaults={}] - Default data, or a factory for
	 * values that must not be shared (arrays, vectors).
	 * @param {string} [name]
	 * @return {Function}
	 */
	function trait( defaults = {}, name = `Trait${ traitIds + 1 }` ) {

		const id = ++ traitIds;
		const make = typeof defaults === 'function' ? defaults : () => ( { ...defaults } );
		const t = ( values = {} ) => ( { __trait: t, data: Object.assign( make(), values ) } );
		Object.defineProperty( t, 'name', { value: name } );
		t.id = id;
		t.create = make;
		return t;

	}

	const unpack = ( item ) => {

		if ( item && item.__trait ) return [ item.__trait, item.data ];
		if ( typeof item === 'function' && item.id && item.create ) return [ item, item.create() ];
		throw new Error( 'Orrery ecs: add() takes traits made with ecs.trait(), like add( mesh, Spin ) or add( mesh, Spin( { speed: 2 } ) ).' );

	};

	// ---- queries ----------------------------------------------------------------

	function matches( traits, q ) {

		for ( const t of q.all ) if ( ! traits.has( t ) ) return false;
		for ( const t of q.none ) if ( traits.has( t ) ) return false;
		return true;

	}

	function refresh( object ) {

		const traits = entities.get( object );

		for ( const q of queries.values() ) {

			const should = !! traits && matches( traits, q );
			const has = q.set.has( object );
			if ( should && ! has ) { q.set.add( object ); q.list.push( object ); }
			else if ( ! should && has ) { q.set.delete( object ); q.list.splice( q.list.indexOf( object ), 1 ); }

		}

	}

	/**
	 * Objects that have every given trait (and none wrapped in `Not`). The
	 * returned array is live and reused: it updates as traits change.
	 *
	 * @param {...(Function|{not: Function})} terms
	 * @return {Object[]}
	 */
	function query( ...terms ) {

		const all = terms.filter( ( t ) => typeof t === 'function' );
		const none = terms.filter( ( t ) => t && t.not ).map( ( t ) => t.not );
		const key = all.map( ( t ) => t.id ).sort().join( ',' ) + '|' + none.map( ( t ) => t.id ).sort().join( ',' );

		let q = queries.get( key );
		if ( ! q ) {

			q = { all, none, list: [], set: new Set() };
			queries.set( key, q );
			for ( const [ object, traits ] of entities ) if ( matches( traits, q ) ) { q.set.add( object ); q.list.push( object ); }

		}

		return q.list;

	}

	/**
	 * Iterates `[object, data]` pairs for one trait (plus extra filters).
	 *
	 * @param {Function} trait
	 * @param {...(Function|{not: Function})} more
	 */
	function* each( trait, ...more ) {

		for ( const object of [ ...query( trait, ...more ) ] ) {

			const data = entities.get( object )?.get( trait );
			if ( data ) yield [ object, data ];

		}

	}

	// ---- entities ---------------------------------------------------------------

	/**
	 * Attaches traits to an object. Adding a trait it already has replaces its data.
	 *
	 * @param {Object} object
	 * @param {...(Function|Object)} items - Traits or trait instances.
	 * @return {Object} The object.
	 */
	function add( object, ...items ) {

		let traits = entities.get( object );
		if ( ! traits ) entities.set( object, traits = new Map() );

		const added = [];
		for ( const item of items ) {

			const [ t, data ] = unpack( item );
			if ( ! traits.has( t ) ) added.push( t );
			traits.set( t, data );

		}

		refresh( object );
		for ( const t of added ) for ( const fn of addHooks.get( t ) ?? [] ) fn( object, traits.get( t ) );
		return object;

	}

	/**
	 * Removes traits from an object, or every trait when none are given.
	 *
	 * @param {Object} object
	 * @param {...Function} list
	 */
	function remove( object, ...list ) {

		const traits = entities.get( object );
		if ( ! traits ) return;

		const gone = list.length ? list.filter( ( t ) => traits.has( t ) ) : [ ...traits.keys() ];
		const removed = gone.map( ( t ) => [ t, traits.get( t ) ] );
		for ( const t of gone ) traits.delete( t );
		if ( traits.size === 0 ) entities.delete( object );

		refresh( object );
		for ( const [ t, data ] of removed ) for ( const fn of removeHooks.get( t ) ?? [] ) fn( object, data );

	}

	const hook = ( map ) => ( t, fn ) => {

		let set = map.get( t );
		if ( ! set ) map.set( t, set = new Set() );
		set.add( fn );
		return () => set.delete( fn );

	};

	// ---- systems ----------------------------------------------------------------

	/**
	 * Registers a function that runs every frame with `(dt, elapsed)`.
	 * Lower `order` runs first.
	 *
	 * @param {Function} fn
	 * @param {{order?: number, name?: string}} [opts]
	 * @return {Function} Unregister.
	 */
	function system( fn, { order = 0, name = fn.name || `system${ systems.length + 1 }` } = {} ) {

		const entry = { fn, order, name, ms: 0 };
		systems.push( entry );
		systems.sort( ( a, b ) => a.order - b.order );
		return () => { const i = systems.indexOf( entry ); if ( i !== - 1 ) systems.splice( i, 1 ); };

	}

	const isAttached = ( object ) => {

		let n = object;
		while ( n.parent ) n = n.parent;
		return n === world.scene;

	};

	function sweep() {

		for ( const object of [ ...entities.keys() ] ) if ( ! isAttached( object ) ) remove( object );

	}

	function update( dt, elapsed = 0 ) {

		if ( ++ frame % sweepEvery === 0 ) sweep();

		for ( const s of [ ...systems ] ) {

			const t0 = performance.now();
			s.fn( dt, elapsed );
			s.ms = s.ms * 0.9 + ( performance.now() - t0 ) * 0.1;

		}

	}

	const offUpdate = world.onUpdate?.( update );

	return {

		trait,
		add,
		remove,
		has: ( object, t ) => !! entities.get( object )?.has( t ),
		get: ( object, t ) => entities.get( object )?.get( t ),
		query,
		each,
		system,
		onAdd: hook( addHooks ),
		onRemove: hook( removeHooks ),
		update,
		sweep,

		/** Entity count. */
		get size() { return entities.size; },

		/** Per-system timing: `[{ name, ms }]`, smoothed. */
		get timings() { return systems.map( ( s ) => ( { name: s.name, ms: s.ms } ) ); },

		dispose() {

			offUpdate?.();
			entities.clear();
			queries.clear();
			systems.length = 0;

		}

	};

}

export { createECS, Not };
