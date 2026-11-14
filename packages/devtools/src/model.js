/**
 * Pure, DOM-free helpers behind the devtools panel. Kept separate so they can
 * be unit tested in Node.
 */

/**
 * Summarises recent frame times.
 *
 * @param {number[]} samples - Frame durations in milliseconds, oldest first.
 * @param {number} [budgetMs=16.7] - Frame budget.
 * @return {{fps: number, avgMs: number, worstMs: number, slow: number}}
 */
function frameStats( samples, budgetMs = 1000 / 60 ) {

	if ( samples.length === 0 ) return { fps: 0, avgMs: 0, worstMs: 0, slow: 0 };

	let sum = 0, worst = 0, slow = 0;
	for ( const ms of samples ) {

		sum += ms;
		if ( ms > worst ) worst = ms;
		if ( ms > budgetMs * 1.5 ) slow ++;

	}

	const avgMs = sum / samples.length;
	return { fps: Math.round( 1000 / avgMs ), avgMs, worstMs: worst, slow };

}

/**
 * Reads draw calls and triangles from either renderer's info object.
 *
 * @param {Object} renderer
 * @return {{drawCalls: number, triangles: number, geometries: number, textures: number}}
 */
function renderStats( renderer ) {

	const info = renderer?.info ?? {};
	const r = info.render ?? {};
	const m = info.memory ?? {};
	return {
		drawCalls: r.drawCalls ?? r.calls ?? 0,
		triangles: r.triangles ?? 0,
		geometries: m.geometries ?? 0,
		textures: m.textures ?? 0
	};

}

/**
 * Counts unique geometries referenced by the scene graph.
 *
 * @param {Object} scene
 * @return {number}
 */
function sceneGeometries( scene ) {

	const seen = new Set();
	scene.traverse( ( node ) => { if ( node.geometry ) seen.add( node.geometry ); } );
	return seen.size;

}

/**
 * Geometries the GPU still holds that nothing in the scene uses: the classic
 * three.js leak after `scene.remove(obj)` without `dispose()`.
 *
 * Returns 0 until the renderer has had a frame to settle; callers should treat
 * a value that stays above 0 as a leak.
 *
 * @param {Object} scene
 * @param {Object} renderer
 * @param {number} [allowance=0] - Geometries used outside the scene (e.g. PMREM).
 * @return {number}
 */
function orphanGeometries( scene, renderer, allowance = 0 ) {

	return Math.max( 0, renderStats( renderer ).geometries - sceneGeometries( scene ) - allowance );

}

/**
 * Display name for an object: its name, or its type for unnamed objects.
 *
 * @param {Object} object
 * @return {string}
 */
function labelFor( object ) {

	return object.name || object.type || 'Object3D';

}

/**
 * Flattens the scene into visible rows for the tree view.
 *
 * @param {Object} root
 * @param {Set<string>} expanded - uuids of expanded nodes (root is always open).
 * @param {function(Object): number} [eventCount] - Events registered on an object.
 * @return {Array<{object: Object, depth: number, label: string, type: string, childCount: number, open: boolean, events: number}>}
 */
function treeRows( root, expanded, eventCount = () => 0 ) {

	const rows = [];

	const visit = ( object, depth ) => {

		const open = depth === 0 || expanded.has( object.uuid );
		rows.push( {
			object,
			depth,
			label: labelFor( object ),
			type: object.type,
			childCount: object.children.length,
			open,
			events: eventCount( object )
		} );
		if ( open ) for ( const child of object.children ) visit( child, depth + 1 );

	};

	visit( root, 0 );
	return rows;

}

/**
 * Total number of objects under (and including) root.
 *
 * @param {Object} root
 * @return {number}
 */
function countObjects( root ) {

	let n = 0;
	root.traverse( () => n ++ );
	return n;

}

/**
 * A cheap structural fingerprint so the tree only re-renders when the graph
 * actually changes.
 *
 * @param {Object} root
 * @return {string}
 */
function structureKey( root ) {

	let key = '';
	root.traverse( ( o ) => { key += o.id + ':' + o.children.length + ( o.visible ? '' : 'h' ) + ','; } );
	return key;

}

/**
 * Compact number for the HUD: 950, 10.3k, 1.2M.
 *
 * @param {number} n
 * @return {string}
 */
function compact( n ) {

	if ( n >= 1e6 ) return ( n / 1e6 ).toFixed( 1 ).replace( /\.0$/, '' ) + 'M';
	if ( n >= 1e3 ) return ( n / 1e3 ).toFixed( 1 ).replace( /\.0$/, '' ) + 'k';
	return String( n );

}

/**
 * Tracks geometries that left the scene without being disposed: the classic
 * three.js leak after `scene.remove(obj)`. Works on any renderer because it
 * follows the geometry objects themselves, not the renderer's counters.
 *
 * @param {Object} [options]
 * @param {number} [options.graceMs=1000] - How long a geometry may be out of
 * the scene before it counts (covers re-parenting and pooling).
 * @return {{update: function(Object, number): Object[], tracked: Map}}
 */
function createLeakTracker( { graceMs = 1000 } = {} ) {

	const tracked = new Map(); // geometry -> { missingSince: number | null }

	function update( scene, now ) {

		const present = new Set();
		scene.traverse( ( node ) => { if ( node.geometry ) present.add( node.geometry ); } );

		for ( const geometry of present ) {

			const entry = tracked.get( geometry );
			if ( entry ) { entry.missingSince = null; continue; }

			tracked.set( geometry, { missingSince: null } );
			geometry.addEventListener?.( 'dispose', function onDispose() {

				tracked.delete( geometry );
				geometry.removeEventListener( 'dispose', onDispose );

			} );

		}

		const leaked = [];
		for ( const [ geometry, entry ] of tracked ) {

			if ( present.has( geometry ) ) continue;
			entry.missingSince ??= now;
			if ( now - entry.missingSince >= graceMs ) leaked.push( geometry );

		}

		return leaked;

	}

	return { update, tracked };

}

export { createLeakTracker, frameStats, renderStats, sceneGeometries, orphanGeometries, labelFor, treeRows, countObjects, structureKey, compact };
