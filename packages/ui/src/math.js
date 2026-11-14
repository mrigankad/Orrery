import { Sphere, Vector3 } from 'three';

const _v = new Vector3();
const _sphere = new Sphere();

/**
 * Projects a world-space point to CSS pixels inside a viewport.
 *
 * @param {Vector3} point - World position (not modified).
 * @param {Object} camera
 * @param {number} width - Viewport width in CSS pixels.
 * @param {number} height - Viewport height in CSS pixels.
 * @return {{x: number, y: number, visible: boolean, depth: number}}
 */
function toScreen( point, camera, width, height ) {

	_v.copy( point ).project( camera );
	const inFront = _v.z > - 1 && _v.z < 1;
	return {
		x: ( _v.x + 1 ) / 2 * width,
		y: ( 1 - _v.y ) / 2 * height,
		depth: _v.z,
		visible: inFront
	};

}

/**
 * Opacity for a label at a distance: 1 up to `near`, 0 beyond `far`, linear
 * in between. With no `far`, labels never fade.
 *
 * @param {number} distance
 * @param {number} [near=0]
 * @param {number} [far=Infinity]
 * @return {number}
 */
function fadeFor( distance, near = 0, far = Infinity ) {

	if ( ! Number.isFinite( far ) || distance <= near ) return 1;
	if ( distance >= far ) return 0;
	return 1 - ( distance - near ) / ( far - near );

}

/**
 * CSS transform that places an element relative to its anchor point.
 *
 * @param {('top'|'bottom'|'left'|'right'|'center')} anchor - Which side of the
 * object the label sits on.
 * @param {number} gap - Pixels between the anchor point and the label.
 * @return {string}
 */
function anchorTransform( anchor, gap = 0 ) {

	switch ( anchor ) {

		case 'top': return `translate(-50%, calc(-100% - ${ gap }px))`;
		case 'bottom': return `translate(-50%, ${ gap }px)`;
		case 'left': return `translate(calc(-100% - ${ gap }px), -50%)`;
		case 'right': return `translate(${ gap }px, -50%)`;
		default: return 'translate(-50%, -50%)';

	}

}

/**
 * World-space bounding sphere of an object (meshes and their children).
 *
 * @param {Object} object
 * @param {Sphere} [target]
 * @return {Sphere}
 */
function worldSphere( object, target = new Sphere() ) {

	object.updateWorldMatrix( true, true );
	let found = false;

	object.traverse( ( node ) => {

		const g = node.geometry;
		if ( ! g ) return;
		if ( ! g.boundingSphere ) g.computeBoundingSphere();
		_sphere.copy( g.boundingSphere ).applyMatrix4( node.matrixWorld );
		if ( ! found ) { target.copy( _sphere ); found = true; } else target.union( _sphere );

	} );

	if ( ! found ) target.set( object.getWorldPosition( new Vector3() ), 0 );
	return target;

}

/**
 * Where a label's anchor point sits in world space: the top, bottom, left or
 * right of the object's bounding sphere (left/right relative to the camera),
 * or its centre.
 *
 * @param {Object} object
 * @param {string} anchor
 * @param {Object} camera
 * @param {Vector3} [target]
 * @return {Vector3}
 */
function anchorPoint( object, anchor, camera, target = new Vector3() ) {

	const s = worldSphere( object, _sphereB );
	target.copy( s.center );

	if ( anchor === 'top' || anchor === 'bottom' ) {

		_up.set( 0, 1, 0 ).applyQuaternion( camera.quaternion );
		target.addScaledVector( _up, anchor === 'top' ? s.radius : - s.radius );

	} else if ( anchor === 'left' || anchor === 'right' ) {

		_right.set( 1, 0, 0 ).applyQuaternion( camera.quaternion );
		target.addScaledVector( _right, anchor === 'right' ? s.radius : - s.radius );

	}

	return target;

}

const _sphereB = new Sphere();
const _up = new Vector3();
const _right = new Vector3();

/**
 * Screen-space radius in CSS pixels of a world sphere seen by a perspective
 * camera (an approximation good enough for focus rings).
 *
 * @param {Sphere} sphere
 * @param {Object} camera
 * @param {number} height - Viewport height in CSS pixels.
 * @return {number}
 */
function screenRadius( sphere, camera, height ) {

	const distance = Math.max( 1e-6, camera.position.distanceTo( sphere.center ) );
	if ( camera.isOrthographicCamera ) return sphere.radius * camera.zoom * height / ( camera.top - camera.bottom );
	const fov = camera.fov * Math.PI / 180;
	return ( sphere.radius / ( Math.tan( fov / 2 ) * distance ) ) * ( height / 2 );

}

export { toScreen, fadeFor, anchorTransform, worldSphere, anchorPoint, screenRadius };
