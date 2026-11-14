import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffold, packageName } from '../src/scaffold.js';

test( 'packageName makes valid npm names', () => {

	assert.equal( packageName( 'My World' ), 'my-world' );
	assert.equal( packageName( '.hidden' ), 'hidden' );
	assert.equal( packageName( 'apps/Cool App!' ), 'cool-app-' );

} );

test( 'scaffold writes a Vite project and refuses to overwrite', () => {

	const cwd = mkdtempSync( join( tmpdir(), 'create-orrery-' ) );
	try {

		const { dir, pkg } = scaffold( 'My World', { cwd } );
		for ( const f of [ 'index.html', 'src/main.js', 'package.json', 'vite.config.js', '.gitignore', 'README.md' ] ) assert.ok( existsSync( join( dir, f ) ), f );
		assert.equal( pkg.name, 'my-world' );
		assert.ok( pkg.dependencies.orreryjs && pkg.dependencies.three && pkg.devDependencies.vite );
		assert.match( readFileSync( join( dir, 'index.html' ), 'utf8' ), /<title>My World<\/title>/ );
		assert.match( readFileSync( join( dir, 'src/main.js' ), 'utf8' ), /World\.create/ );

		mkdirSync( join( cwd, 'taken' ) );
		writeFileSync( join( cwd, 'taken', 'x' ), '' );
		assert.throws( () => scaffold( 'taken', { cwd } ), /already exists/ );
		assert.doesNotThrow( () => scaffold( 'taken', { cwd, force: true } ) );

	} finally {

		rmSync( cwd, { recursive: true, force: true } );

	}

} );
