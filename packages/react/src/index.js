import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react';
import { World } from 'orreryjs';

const WorldContext = createContext( null );

/**
 * Creates an Orrery World inside a div and renders its children once the
 * World is ready. Children use the hooks below to add objects.
 *
 * ```jsx
 * <OrreryCanvas options={ { adaptive: true } } style={ { height: 400 } }>
 *   <Spinner />
 * </OrreryCanvas>
 * ```
 *
 * @param {Object} props
 * @param {Object} [props.options] - Passed to `World.create`.
 * @param {function(World): void} [props.onCreated]
 * @param {Object} [props.style]
 * @param {string} [props.className]
 * @param {*} [props.fallback=null] - Rendered while the World is created.
 */
function OrreryCanvas( { options, onCreated, style, className, fallback = null, children } ) {

	const ref = useRef( null );
	const [ world, setWorld ] = useState( null );
	const optionsRef = useRef( options );
	const onCreatedRef = useRef( onCreated );
	onCreatedRef.current = onCreated;

	useEffect( () => {

		let cancelled = false;
		let created = null;

		World.create( { ...optionsRef.current, container: ref.current } ).then( ( w ) => {

			if ( cancelled ) { w.dispose(); return; }
			created = w;
			w.start();
			onCreatedRef.current?.( w );
			setWorld( w );

		} );

		return () => {

			cancelled = true;
			created?.dispose();
			setWorld( null );

		};

	}, [] );

	return createElement(
		'div',
		{ ref, className, style: { position: 'relative', width: '100%', height: '100%', ...style } },
		world ? createElement( WorldContext.Provider, { value: world }, children ) : fallback
	);

}

/** The World from the nearest OrreryCanvas. */
function useWorld() {

	const world = useContext( WorldContext );
	if ( ! world ) throw new Error( 'Orrery: useWorld() must be used inside <OrreryCanvas>.' );
	return world;

}

/**
 * Runs `fn(dt, elapsed)` every frame. The latest `fn` is always used, so it
 * can read fresh props without re-subscribing.
 */
function useFrame( fn ) {

	const world = useWorld();
	const fnRef = useRef( fn );
	fnRef.current = fn;
	useEffect( () => world.onUpdate( ( dt, elapsed ) => fnRef.current( dt, elapsed ) ), [ world ] );

}

/**
 * Adds an object to the World (or to `parent`) while the component is
 * mounted, and removes it on unmount. By default removal also frees its GPU
 * memory; pass `{ dispose: false }` for objects you reuse.
 *
 * @param {Object|null} object
 * @param {{parent?: Object, dispose?: boolean}} [options]
 */
function useObject( object, { parent = null, dispose = true } = {} ) {

	const world = useWorld();

	useEffect( () => {

		if ( ! object ) return undefined;
		( parent ?? world.scene ).add( object );
		return () => world.remove( object, { dispose } );

	}, [ world, object, parent, dispose ] );

	return object;

}

/**
 * Subscribes to a pointer event on an object for the component's lifetime.
 */
function useEvent( object, type, handler ) {

	const world = useWorld();
	const ref = useRef( handler );
	ref.current = handler;
	useEffect( () => ( object ? world.on( object, type, ( hit ) => ref.current( hit ) ) : undefined ), [ world, object, type ] );

}

/**
 * Loads an asset with `world.load(url)`. Returns `{ data, error, loading }`.
 */
function useLoad( url ) {

	const world = useWorld();
	const [ state, setState ] = useState( { data: null, error: null, loading: !! url } );

	useEffect( () => {

		if ( ! url ) return undefined;
		let live = true;
		setState( { data: null, error: null, loading: true } );
		world.load( url ).then(
			( data ) => live && setState( { data, error: null, loading: false } ),
			( error ) => live && setState( { data: null, error, loading: false } )
		);
		return () => { live = false; };

	}, [ world, url ] );

	return state;

}

export { OrreryCanvas, WorldContext, useWorld, useFrame, useObject, useEvent, useLoad };
