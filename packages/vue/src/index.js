import { defineComponent, h, inject, isRef, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef, toRaw, unref, watch } from 'vue';
import { World } from '@orreryjs/core';

// ref( mesh ) wraps three.js objects in a deep reactive Proxy, but raycasts
// and the scene graph hold the raw object. Always hand the raw one to Orrery.
const raw = ( value ) => ( value ? toRaw( unref( value ) ) : value );

const WORLD = Symbol( 'orrery-world' );

/**
 * Creates an Orrery World inside a div and renders its default slot once the
 * World is ready. Children use the composables below.
 *
 * ```vue
 * <OrreryCanvas :options="{ adaptive: true }" style="height: 400px"><Spinner /></OrreryCanvas>
 * ```
 */
const OrreryCanvas = defineComponent( {

	name: 'OrreryCanvas',
	props: { options: { type: Object, default: () => ( {} ) } },
	emits: [ 'created' ],

	setup( props, { slots, emit } ) {

		const el = ref( null );
		const world = shallowRef( null );
		let cancelled = false;
		provide( WORLD, world );

		onMounted( async () => {

			const w = await World.create( { ...props.options, container: el.value } );
			if ( cancelled ) { w.dispose(); return; }
			w.start();
			world.value = w;
			emit( 'created', w );

		} );

		onBeforeUnmount( () => {

			cancelled = true;
			world.value?.dispose();
			world.value = null;

		} );

		return () => h( 'div', { ref: el, style: { position: 'relative', width: '100%', height: '100%' } },
			world.value ? slots.default?.() : slots.fallback?.() );

	}

} );

/** The World from the nearest OrreryCanvas. */
function useWorld() {

	const world = inject( WORLD, null );
	if ( ! world || ! world.value ) throw new Error( 'Orrery: useWorld() must be used inside <OrreryCanvas>.' );
	return world.value;

}

/** Runs `fn(dt, elapsed)` every frame while the component is mounted. */
function useFrame( fn ) {

	const world = useWorld();
	const off = world.onUpdate( ( dt, elapsed ) => fn( dt, elapsed ) );
	onBeforeUnmount( off );

}

/**
 * Adds an object (or a ref to one) to the World while the component is
 * mounted and removes it on unmount, freeing its GPU memory unless
 * `dispose: false`. Swapping the ref's value swaps the object in the scene.
 */
function useObject( object, { parent = null, dispose = true } = {} ) {

	const world = useWorld();
	let current = null;

	const attach = ( value ) => {

		const next = raw( value );
		if ( current === next ) return;
		if ( current ) world.remove( current, { dispose } );
		current = next ?? null;
		if ( current ) ( raw( parent ) ?? world.scene ).add( current );

	};

	if ( isRef( object ) ) watch( object, attach, { immediate: true } );
	else attach( object );

	onBeforeUnmount( () => attach( null ) );
	return object;

}

/** Subscribes to a pointer event on an object for the component's lifetime. */
function useEvent( object, type, handler ) {

	const world = useWorld();
	let off = null;
	const bind = ( value ) => {

		const target = raw( value );
		off?.();
		off = target ? world.on( target, type, ( hit ) => handler( hit ) ) : null;

	};

	if ( isRef( object ) ) watch( object, bind, { immediate: true } );
	else bind( object );

	onBeforeUnmount( () => off?.() );

}

/** Loads an asset with world.load(url). Returns reactive `{ data, error, loading }`; `url` may be a ref. */
function useLoad( url ) {

	const world = useWorld();
	const state = reactive( { data: null, error: null, loading: false } );
	let token = 0;

	const run = ( u ) => {

		const mine = ++ token;
		if ( ! u ) { Object.assign( state, { data: null, error: null, loading: false } ); return; }
		state.loading = true;
		world.load( u ).then(
			( data ) => { if ( mine === token ) Object.assign( state, { data, error: null, loading: false } ); },
			( error ) => { if ( mine === token ) Object.assign( state, { data: null, error, loading: false } ); }
		);

	};

	if ( isRef( url ) ) watch( url, run, { immediate: true } );
	else run( url );

	onBeforeUnmount( () => { token ++; } );
	return state;

}

export { OrreryCanvas, useWorld, useFrame, useObject, useEvent, useLoad };
