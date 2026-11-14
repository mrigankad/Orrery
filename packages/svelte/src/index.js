import { World } from '@orreryjs/core';

/**
 * Svelte bindings for Orrery. No compiler needed: an action creates the World
 * on an element, and small helpers return cleanups that fit `$effect`.
 *
 * ```svelte
 * <script>
 *   import { orrery, track, frame, listen } from '@orreryjs/svelte';
 *   let world = $state( null );
 *   const cube = new Mesh( new BoxGeometry(), new MeshStandardMaterial() );
 *   $effect( () => world && track( world, cube ) );
 *   $effect( () => world && frame( world, ( dt ) => { cube.rotation.y += dt; } ) );
 * </script>
 *
 * <div use:orrery={ { onCreated: ( w ) => ( world = w ) } } style="height: 400px"></div>
 * ```
 */

/**
 * Svelte action: creates and starts a World inside `node`, disposes it when
 * the element is removed.
 *
 * @param {HTMLElement} node
 * @param {{options?: Object, onCreated?: function(World): void}} [params]
 */
function orrery( node, params = {} ) {

	let world = null;
	let destroyed = false;
	let onCreated = params.onCreated;

	const position = getComputedStyle( node ).position;
	if ( ! position || position === 'static' ) node.style.position = 'relative';

	World.create( { ...params.options, container: node } ).then( ( w ) => {

		if ( destroyed ) { w.dispose(); return; }
		world = w;
		w.start();
		onCreated?.( w );

	} );

	return {

		update( next = {} ) { onCreated = next.onCreated; },

		destroy() {

			destroyed = true;
			world?.dispose();
			world = null;

		}

	};

}

/**
 * Adds an object to the World and returns a cleanup that removes it, freeing
 * its GPU memory unless `dispose: false`.
 *
 * @return {Function}
 */
function track( world, object, { parent = null, dispose = true } = {} ) {

	( parent ?? world.scene ).add( object );
	return () => world.remove( object, { dispose } );

}

/** Runs `fn(dt, elapsed)` every frame; returns the unsubscribe. */
function frame( world, fn ) {

	return world.onUpdate( fn );

}

/** Subscribes to a pointer event on an object; returns the unsubscribe. */
function listen( world, object, type, handler ) {

	return world.on( object, type, handler );

}

/**
 * Loads an asset and calls `onDone(data)` (or `onError`). Returns a cleanup
 * that ignores the result if it arrives after the component is gone.
 *
 * @return {Function}
 */
function load( world, url, onDone, onError = ( e ) => console.error( e ) ) {

	let live = true;
	world.load( url ).then( ( d ) => live && onDone( d ), ( e ) => live && onError( e ) );
	return () => { live = false; };

}

export { orrery, track, frame, listen, load };
