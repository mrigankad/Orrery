import { InstancedMesh, Matrix4 } from 'three';

/**
 * Folds meshes under `root` that share the same geometry and material into
 * one InstancedMesh each, turning N draw calls into 1.
 *
 * Instance transforms are baked relative to `root` at call time, so `root`
 * itself can keep moving (a rotating asteroid belt stays one draw call) but
 * the individual meshes stop being separate objects. Meshes are skipped when
 * they have children, are skinned or morphed, use multi-materials, are already
 * instanced, carry `userData.noInstance`, or are excluded by `options.skip`.
 *
 * @param {Object} root - Object3D whose descendants are considered.
 * @param {Object} [options]
 * @param {number} [options.minCount=8] - Smallest group worth instancing.
 * @param {function(Object): boolean} [options.skip] - Return true to keep a mesh as is.
 * @return {{groups: number, meshes: number, drawCallsSaved: number, instanced: InstancedMesh[]}}
 */
function instanceMeshes( root, options = {} ) {

	const { minCount = 8, skip = () => false } = options;

	root.updateWorldMatrix( true, true );
	const toRoot = new Matrix4().copy( root.matrixWorld ).invert();

	const buckets = new Map();
	root.traverse( ( node ) => {

		if ( node === root || ! node.isMesh || node.isInstancedMesh || node.isSkinnedMesh ) return;
		if ( node.children.length || Array.isArray( node.material ) || node.morphTargetInfluences ) return;
		if ( node.userData.noInstance || skip( node ) ) return;

		const key = node.geometry.uuid + '|' + node.material.uuid;
		let bucket = buckets.get( key );
		if ( ! bucket ) buckets.set( key, bucket = [] );
		bucket.push( node );

	} );

	const report = { groups: 0, meshes: 0, drawCallsSaved: 0, instanced: [] };
	const local = new Matrix4();

	for ( const meshes of buckets.values() ) {

		if ( meshes.length < minCount ) continue;

		const first = meshes[ 0 ];
		const instanced = new InstancedMesh( first.geometry, first.material, meshes.length );
		instanced.name = `${ first.name || first.geometry.type } ×${ meshes.length }`;
		instanced.castShadow = first.castShadow;
		instanced.receiveShadow = first.receiveShadow;

		meshes.forEach( ( mesh, i ) => {

			local.multiplyMatrices( toRoot, mesh.matrixWorld );
			instanced.setMatrixAt( i, local );
			if ( mesh.parent ) mesh.parent.remove( mesh );

		} );

		instanced.instanceMatrix.needsUpdate = true;
		instanced.computeBoundingSphere();
		instanced.userData.instancedFrom = meshes.length;
		root.add( instanced );

		report.groups ++;
		report.meshes += meshes.length;
		report.drawCallsSaved += meshes.length - 1;
		report.instanced.push( instanced );

	}

	return report;

}

export { instanceMeshes };
