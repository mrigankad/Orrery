// Points every workspace at one three.js version, for testing against new
// releases: node scripts/use-three.mjs latest   (then npm install)
//
// npm overrides cannot replace a dependency a workspace lists directly, so
// this rewrites the manifests instead. CI runs it on a throwaway checkout.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const wanted = process.argv[ 2 ] ?? 'latest';
const version = /^\d/.test( wanted ) ? wanted : execSync( `npm view three@${ wanted } version`, { encoding: 'utf8' } ).trim().split( '\n' ).pop().replace( /.*'(.+)'.*/, '$1' );
const root = new URL( '..', import.meta.url ).pathname.replace( /^\/([A-Za-z]:)/, '$1' );

const manifests = [ join( root, 'package.json' ), ...readdirSync( join( root, 'packages' ) ).map( ( d ) => join( root, 'packages', d, 'package.json' ) ).filter( existsSync ) ];
let changed = 0;

for ( const file of manifests ) {

	const pkg = JSON.parse( readFileSync( file, 'utf8' ) );
	let touched = false;
	for ( const field of [ 'dependencies', 'devDependencies' ] ) {

		for ( const name of [ 'three', '@types/three' ] ) {

			if ( pkg[ field ]?.[ name ] ) { pkg[ field ][ name ] = `^${ version }`; touched = true; }

		}

	}

	if ( touched ) { writeFileSync( file, JSON.stringify( pkg, null, 2 ) + '\n' ); changed ++; }

}

console.log( `three ${ version } set in ${ changed } manifest${ changed === 1 ? '' : 's' }. Now run npm install.` );
