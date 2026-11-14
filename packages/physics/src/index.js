import RAPIER from '@dimforge/rapier3d-compat';
import { Box3, Quaternion, Sphere, Vector3 } from 'three';

let ready = null;

/** Loads Rapier's WebAssembly once per page. */
function initRapier() {

	return ready ??= RAPIER.init( {} );

}

const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _parentQuat = new Quaternion();
const _box = new Box3();
const _sphere = new Sphere();
const _size = new Vector3();
const _center = new Vector3();

/**
 * Picks a collider shape for a geometry when `shape: 'auto'`.
 *
 * @param {Object} geometry
 * @param {string} type - Body type.
 * @return {('ball'|'cuboid'|'capsule'|'trimesh'|'convex')}
 */
function autoShape( geometry, type ) {

	switch ( geometry?.type ) {

		case 'SphereGeometry':
		case 'IcosahedronGeometry':
		case 'DodecahedronGeometry':
		case 'OctahedronGeometry':
			return 'ball';
		case 'BoxGeometry':
		case 'PlaneGeometry':
			return 'cuboid';
		case 'CapsuleGeometry':
			return 'capsule';
		default:
			// Static meshes can use exact triangles; moving ones need a convex hull.
			return type === 'fixed' ? 'trimesh' : 'convex';

	}

}

/**
 * Builds a Rapier collider description for a mesh, sized by its geometry and
 * world scale and offset so it lines up with off-centre geometry.
 *
 * @param {Object} object - A Mesh (or any Object3D with `geometry`).
 * @param {string} shape
 * @param {Vector3} scale - The object's world scale.
 * @return {Object} RAPIER.ColliderDesc
 */
function colliderFor( object, shape, scale ) {

	const geometry = object.geometry;
	if ( ! geometry ) throw new Error( `Orrery physics: "${ object.name || object.type }" has no geometry. Pass { shape } explicitly or add physics to a mesh.` );

	if ( ! geometry.boundingBox ) geometry.computeBoundingBox();
	if ( ! geometry.boundingSphere ) geometry.computeBoundingSphere();
	_box.copy( geometry.boundingBox );
	_sphere.copy( geometry.boundingSphere );
	_box.getSize( _size ).multiply( scale );
	_box.getCenter( _center ).multiply( scale );

	let desc;

	switch ( shape ) {

		case 'ball': {

			const r = _sphere.radius * Math.max( scale.x, scale.y, scale.z );
			_center.copy( _sphere.center ).multiply( scale );
			desc = RAPIER.ColliderDesc.ball( r );
			break;

		}

		case 'cuboid':
			desc = RAPIER.ColliderDesc.cuboid( Math.max( _size.x / 2, 0.005 ), Math.max( _size.y / 2, 0.005 ), Math.max( _size.z / 2, 0.005 ) );
			break;

		case 'capsule': {

			const radius = Math.max( _size.x, _size.z ) / 2;
			desc = RAPIER.ColliderDesc.capsule( Math.max( 0, _size.y / 2 - radius ), radius );
			break;

		}

		case 'trimesh':
		case 'convex': {

			const position = geometry.attributes.position;
			const vertices = new Float32Array( position.count * 3 );
			for ( let i = 0; i < position.count; i ++ ) {

				vertices[ i * 3 ] = position.getX( i ) * scale.x;
				vertices[ i * 3 + 1 ] = position.getY( i ) * scale.y;
				vertices[ i * 3 + 2 ] = position.getZ( i ) * scale.z;

			}

			_center.set( 0, 0, 0 );

			if ( shape === 'convex' ) {

				desc = RAPIER.ColliderDesc.convexHull( vertices );
				if ( ! desc ) throw new Error( `Orrery physics: could not build a convex hull for "${ object.name || geometry.type }".` );

			} else {

				const indices = geometry.index
					? new Uint32Array( geometry.index.array )
					: Uint32Array.from( { length: position.count }, ( _, i ) => i );
				desc = RAPIER.ColliderDesc.trimesh( vertices, indices );

			}

			break;

		}

		default:
			throw new Error( `Orrery physics: unknown shape "${ shape }". Use auto, ball, cuboid, capsule, convex or trimesh.` );

	}

	return desc.setTranslation( _center.x, _center.y, _center.z );

}

/**
 * Adds Rapier physics to an Orrery World. Rapier's WebAssembly is loaded on
 * first use. The simulation runs on a fixed timestep inside the world's frame
 * loop, and bodies are removed automatically when their object leaves the
 * scene (for example through `world.remove(obj)`).
 *
 * ```js
 * const physics = await addPhysics( world );
 * physics.add( floor, { type: 'fixed' } );
 * physics.add( crate );                              // dynamic box from its geometry
 * physics.onCollision( crate, ( other ) => console.log( 'hit', other.name ) );
 * physics.applyImpulse( crate, [ 0, 5, 0 ] );
 * ```
 *
 * @param {Object} world - An Orrery World (anything with `scene` and `onUpdate`).
 * @param {Object} [options]
 * @param {number[]} [options.gravity=[0, -9.81, 0]]
 * @param {number} [options.timestep=1/60] - Fixed simulation step in seconds.
 * @param {number} [options.maxSubsteps=5] - Cap on catch-up steps per frame.
 * @param {boolean} [options.autoStep=true] - Step inside world.onUpdate.
 * @return {Promise<Object>} The physics controller.
 */
async function addPhysics( world, options = {} ) {

	await initRapier();

	const {
		gravity = [ 0, - 9.81, 0 ],
		timestep = 1 / 60,
		maxSubsteps = 5,
		autoStep = true
	} = options;

	const sim = new RAPIER.World( { x: gravity[ 0 ], y: gravity[ 1 ], z: gravity[ 2 ] } );
	sim.timestep = timestep;
	const events = new RAPIER.EventQueue( true );

	let queriesDirty = false;          // colliders changed since the last step
	const entries = new Map();          // Object3D -> { body, collider, type }
	const byCollider = new Map();       // collider handle -> Object3D
	const listeners = new Map();        // Object3D -> Set<fn>
	let accumulator = 0;
	let paused = false;

	const isAttached = ( object ) => {

		let n = object;
		while ( n.parent ) n = n.parent;
		return n === world.scene;

	};

	function add( object, opts = {} ) {

		if ( entries.has( object ) ) return entries.get( object ).body;

		const {
			type = 'dynamic',
			shape = 'auto',
			mass,
			density = 1,
			restitution = 0.2,
			friction = 0.6,
			ccd = false,
			sensor = false,
			linearDamping = 0,
			angularDamping = 0.05
		} = opts;

		object.updateWorldMatrix( true, false );
		object.matrixWorld.decompose( _pos, _quat, _scale );

		const bodyDesc = (
			type === 'fixed' ? RAPIER.RigidBodyDesc.fixed()
				: type === 'kinematic' ? RAPIER.RigidBodyDesc.kinematicPositionBased()
					: type === 'dynamic' ? RAPIER.RigidBodyDesc.dynamic()
						: null
		);
		if ( ! bodyDesc ) throw new Error( `Orrery physics: unknown body type "${ type }". Use dynamic, fixed or kinematic.` );

		bodyDesc
			.setTranslation( _pos.x, _pos.y, _pos.z )
			.setRotation( { x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w } )
			.setLinearDamping( linearDamping )
			.setAngularDamping( angularDamping )
			.setCcdEnabled( ccd );

		const body = sim.createRigidBody( bodyDesc );

		const colliderDesc = colliderFor( object, shape === 'auto' ? autoShape( object.geometry, type ) : shape, _scale )
			.setRestitution( restitution )
			.setFriction( friction )
			.setSensor( sensor )
			.setActiveEvents( RAPIER.ActiveEvents.COLLISION_EVENTS );

		if ( mass !== undefined ) colliderDesc.setMass( mass ); else colliderDesc.setDensity( density );

		const collider = sim.createCollider( colliderDesc, body );
		entries.set( object, { body, collider, type } );
		byCollider.set( collider.handle, object );
		queriesDirty = true;
		return body;

	}

	function remove( object ) {

		const entry = entries.get( object );
		if ( ! entry ) return false;
		byCollider.delete( entry.collider.handle );
		sim.removeRigidBody( entry.body );
		entries.delete( object );
		listeners.delete( object );
		queriesDirty = true;
		return true;

	}

	function step( dt = timestep ) {

		// Bodies whose object left the scene go with it.
		for ( const object of entries.keys() ) if ( ! isAttached( object ) ) remove( object );

		// Kinematic bodies follow their objects.
		for ( const [ object, entry ] of entries ) {

			if ( entry.type !== 'kinematic' ) continue;
			object.updateWorldMatrix( true, false );
			object.matrixWorld.decompose( _pos, _quat, _scale );
			entry.body.setNextKinematicTranslation( { x: _pos.x, y: _pos.y, z: _pos.z } );
			entry.body.setNextKinematicRotation( { x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w } );

		}

		accumulator = Math.min( accumulator + dt, timestep * maxSubsteps );
		let steps = 0;

		while ( accumulator >= timestep - 1e-9 ) {

			sim.step( events );
			queriesDirty = false;
			accumulator -= timestep;
			steps ++;

		}

		if ( steps === 0 ) return 0;

		events.drainCollisionEvents( ( h1, h2, started ) => {

			const a = byCollider.get( h1 ), b = byCollider.get( h2 );
			if ( ! a || ! b ) return;
			for ( const fn of listeners.get( a ) ?? [] ) fn( b, started );
			for ( const fn of listeners.get( b ) ?? [] ) fn( a, started );

		} );

		// Dynamic bodies drive their objects, converting into the parent's space.
		for ( const [ object, entry ] of entries ) {

			if ( entry.type !== 'dynamic' ) continue;
			const t = entry.body.translation(), r = entry.body.rotation();
			_pos.set( t.x, t.y, t.z );
			_quat.set( r.x, r.y, r.z, r.w );

			const parent = object.parent;
			if ( parent && parent !== world.scene ) {

				parent.updateWorldMatrix( true, false );
				parent.worldToLocal( _pos );
				parent.getWorldQuaternion( _parentQuat ).invert();
				_quat.premultiply( _parentQuat );

			}

			object.position.copy( _pos );
			object.quaternion.copy( _quat );

		}

		return steps;

	}

	const vec = ( v ) => ( Array.isArray( v ) ? { x: v[ 0 ], y: v[ 1 ], z: v[ 2 ] } : { x: v.x, y: v.y, z: v.z } );
	const bodyOf = ( object ) => {

		const entry = entries.get( object );
		if ( ! entry ) throw new Error( `Orrery physics: "${ object.name || object.type }" has no body. Call physics.add(object) first.` );
		return entry.body;

	};

	const offUpdate = autoStep ? world.onUpdate( ( dt ) => { if ( ! paused ) step( dt ); } ) : null;

	return {

		RAPIER,
		world: sim,
		add,
		remove,
		step,

		/** @param {Object} object @return {boolean} */
		has: ( object ) => entries.has( object ),

		/** The Rapier rigid body for an object. */
		body: bodyOf,

		/** Number of bodies. */
		get size() { return entries.size; },

		get paused() { return paused; },
		set paused( v ) { paused = !! v; },

		applyImpulse( object, impulse ) { bodyOf( object ).applyImpulse( vec( impulse ), true ); },
		setVelocity( object, velocity ) { bodyOf( object ).setLinvel( vec( velocity ), true ); },
		velocity( object ) { const v = bodyOf( object ).linvel(); return new Vector3( v.x, v.y, v.z ); },

		/**
		 * Moves a body (and its object) to a world position, for respawns.
		 */
		teleport( object, position ) {

			const body = bodyOf( object );
			body.setTranslation( vec( position ), true );
			body.setLinvel( { x: 0, y: 0, z: 0 }, true );
			body.setAngvel( { x: 0, y: 0, z: 0 }, true );

		},

		/**
		 * Calls `fn(other, started)` when this object starts or stops touching another.
		 *
		 * @return {Function} Unsubscribe.
		 */
		onCollision( object, fn ) {

			let set = listeners.get( object );
			if ( ! set ) listeners.set( object, set = new Set() );
			set.add( fn );
			return () => set.delete( fn );

		},

		/**
		 * Casts a ray through the physics world.
		 *
		 * @return {?{object: Object, distance: number, point: Vector3}}
		 */
		raycast( origin, direction, maxDistance = 1000 ) {

			const d = vec( direction );
			const len = Math.hypot( d.x, d.y, d.z ) || 1;
			// Rapier only indexes new colliders during a step. A zero-length step
			// indexes them without moving anything; contact events it finds stay
			// in the queue and are delivered by the next real step.
			if ( queriesDirty ) {

				const dt = sim.timestep;
				sim.timestep = 0;
				sim.step( events );
				sim.timestep = dt;
				queriesDirty = false;

			}

			const ray = new RAPIER.Ray( vec( origin ), { x: d.x / len, y: d.y / len, z: d.z / len } );
			const hit = sim.castRay( ray, maxDistance, true );
			if ( ! hit ) return null;
			const object = byCollider.get( hit.collider.handle ) ?? null;
			const p = ray.pointAt( hit.timeOfImpact ?? hit.toi );
			return { object, distance: hit.timeOfImpact ?? hit.toi, point: new Vector3( p.x, p.y, p.z ) };

		},

		dispose() {

			offUpdate?.();
			entries.clear();
			byCollider.clear();
			listeners.clear();
			events.free();
			sim.free();

		}

	};

}

export { addPhysics, initRapier, autoShape };
