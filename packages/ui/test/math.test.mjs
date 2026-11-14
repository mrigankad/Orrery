import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, PerspectiveCamera, SphereGeometry, BoxGeometry, Vector3 } from 'three';
import { toScreen, fadeFor, anchorTransform, worldSphere, anchorPoint, screenRadius } from '../src/math.js';

function camera() {

	const c = new PerspectiveCamera( 60, 2, 0.1, 100 );
	c.position.set( 0, 0, 10 );
	c.lookAt( 0, 0, 0 );
	c.updateMatrixWorld();
	return c;

}

test( 'toScreen maps the view centre to the viewport centre and hides points behind the camera', () => {

	const cam = camera();
	const centre = toScreen( new Vector3( 0, 0, 0 ), cam, 800, 400 );
	assert.equal( Math.round( centre.x ), 400 );
	assert.equal( Math.round( centre.y ), 200 );
	assert.equal( centre.visible, true );

	const right = toScreen( new Vector3( 1, 1, 0 ), cam, 800, 400 );
	assert.ok( right.x > 400 && right.y < 200, 'right and up moves right and up on screen' );

	assert.equal( toScreen( new Vector3( 0, 0, 20 ), cam, 800, 400 ).visible, false );

} );

test( 'fadeFor is 1 near, 0 far, linear between, and never fades without far', () => {

	assert.equal( fadeFor( 5 ), 1 );
	assert.equal( fadeFor( 5, 10, 20 ), 1 );
	assert.equal( fadeFor( 15, 10, 20 ), 0.5 );
	assert.equal( fadeFor( 25, 10, 20 ), 0 );

} );

test( 'anchorTransform places labels on the requested side', () => {

	assert.equal( anchorTransform( 'top', 4 ), 'translate(-50%, calc(-100% - 4px))' );
	assert.equal( anchorTransform( 'right', 8 ), 'translate(8px, -50%)' );
	assert.equal( anchorTransform( 'center' ), 'translate(-50%, -50%)' );

} );

test( 'worldSphere covers children with world transforms; anchorPoint sits on its top edge', () => {

	const g = new Group();
	g.position.set( 5, 0, 0 );
	const ball = new Mesh( new SphereGeometry( 1 ) );
	ball.scale.setScalar( 2 );
	g.add( ball );

	const s = worldSphere( g );
	assert.deepEqual( s.center.toArray().map( Math.round ), [ 5, 0, 0 ] );
	assert.ok( Math.abs( s.radius - 2 ) < 1e-6 );

	const top = anchorPoint( g, 'top', camera() );
	assert.deepEqual( top.toArray().map( ( v ) => Math.round( v * 100 ) / 100 ), [ 5, 2, 0 ] );

	const lone = new Group(); lone.position.set( 1, 2, 3 );
	assert.equal( worldSphere( lone ).radius, 0, 'objects without geometry use their position' );

} );

test( 'screenRadius grows as objects come closer', () => {

	const cam = camera();
	const far = screenRadius( worldSphere( new Mesh( new BoxGeometry() ) ), cam, 400 );
	cam.position.z = 5;
	const near = screenRadius( worldSphere( new Mesh( new BoxGeometry() ) ), cam, 400 );
	assert.ok( near > far * 1.9 );

} );
