// orreryjs-doctor-ignore-file: these tests contain deliberately broken import strings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctor, formatReport, addonImports, threeRevision } from '../src/doctor.js';

function project( files ) {

	const root = mkdtempSync( join( tmpdir(), 'orrery-doctor-' ) );
	for ( const [ path, content ] of Object.entries( files ) ) {

		const full = join( root, path );
		mkdirSync( join( full, '..' ), { recursive: true } );
		writeFileSync( full, typeof content === 'string' ? content : JSON.stringify( content ) );

	}

	return root;

}

const status = ( report, id ) => report.checks.find( ( c ) => c.id === id )?.status;

test( 'addonImports and threeRevision parse what they should', () => {

	assert.deepEqual( addonImports( `import { A } from 'three/addons/loaders/A.js';\nimport('three/examples/jsm/libs/b.js')` ), [ 'loaders/A.js', 'libs/b.js' ] );
	assert.equal( threeRevision( '0.184.1' ), 184 );
	assert.equal( threeRevision( '^0.170.0' ), 170 );
	assert.equal( threeRevision( undefined ), null );

} );

test( 'a broken project: old three, a duplicate copy, a removed addon, mismatched types', () => {

	const root = project( {
		'package.json': { dependencies: { three: '0.183.0', '@orreryjs/core': '0.1.0', '@orreryjs/ui': '0.2.0' } },
		'node_modules/three/package.json': { name: 'three', version: '0.183.0' },
		'node_modules/three/examples/jsm/loaders/GLTFLoader.js': '',
		'node_modules/some-viewer/node_modules/three/package.json': { name: 'three', version: '0.160.0' },
		'node_modules/@types/three/package.json': { version: '0.180.0' },
		'node_modules/@orreryjs/core/package.json': { version: '0.1.0' },
		'node_modules/@orreryjs/ui/package.json': { version: '0.2.0' },
		'src/main.js': `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\nimport { RGBELoader } from 'three/addons/loaders/RGBELoader.js';`,
		'node_modules/ignored/index.js': `import 'three/addons/not/scanned.js'`,
		'src/fixtures.js': `// orreryjs-doctor-ignore-file
import 'three/addons/also/skipped.js'`
	} );

	try {

		const report = runDoctor( root );
		assert.equal( report.ok, false );
		assert.equal( status( report, 'three' ), 'fail' );
		assert.equal( status( report, 'duplicates' ), 'fail' );
		assert.equal( status( report, 'addons' ), 'fail' );
		assert.equal( status( report, 'types' ), 'warn' );
		assert.equal( status( report, 'orrery' ), 'warn' );

		const addons = report.checks.find( ( c ) => c.id === 'addons' );
		assert.match( addons.title, /^1 addon import no longer exists/ );
		assert.match( addons.detail, /RGBELoader\.js +-> +use loaders\/HDRLoader\.js/ );
		assert.doesNotMatch( addons.detail, /scanned/, 'node_modules is not scanned' );
		assert.doesNotMatch( addons.detail, /skipped/, 'files can opt out' );

		const text = formatReport( report );
		assert.match( text, /fail {2}3 copies|fail {2}2 copies/ );
		assert.match( text, /problems? found/ );

	} finally {

		rmSync( root, { recursive: true, force: true } );

	}

} );

test( 'a healthy project passes', () => {

	const root = project( {
		'package.json': { dependencies: { three: '0.184.0', '@orreryjs/core': '0.1.0' } },
		'node_modules/three/package.json': { name: 'three', version: '0.184.0' },
		'node_modules/three/examples/jsm/loaders/HDRLoader.js': '',
		'node_modules/@orreryjs/core/package.json': { version: '0.1.0' },
		'src/app.ts': `import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';`
	} );

	try {

		const report = runDoctor( root );
		assert.equal( report.ok, true, JSON.stringify( report.checks ) );
		assert.ok( report.checks.every( ( c ) => c.status === 'pass' ) );

	} finally {

		rmSync( root, { recursive: true, force: true } );

	}

} );
