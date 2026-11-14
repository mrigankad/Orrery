/**
 * `orreryjs doctor`: checks a project for the problems that most often break
 * three.js apps after an upgrade. Node only (uses the file system).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Addon files three.js renamed or removed, with what to use instead. */
const RENAMED = {
	'loaders/RGBELoader.js': 'loaders/HDRLoader.js (class HDRLoader)'
};

const SOURCE_EXT = /\.(m?[jt]sx?|vue|svelte|html)$/;
const SKIP_DIRS = new Set( [ 'node_modules', '.git', 'dist', 'build', '.next', '.svelte-kit', 'coverage' ] );
const MIN_THREE = 184;

const readJSON = ( file ) => { try { return JSON.parse( readFileSync( file, 'utf8' ) ); } catch { return null; } };

/** "0.184.0" -> 184 */
function threeRevision( version ) {

	const m = /^\D*0\.(\d+)/.exec( String( version ?? '' ) );
	return m ? Number( m[ 1 ] ) : null;

}

/** Every package.json for `name` anywhere under node_modules (nested copies too). */
function findPackageCopies( root, name, limit = 4000 ) {

	const found = [];
	let visited = 0;

	const walk = ( dir, depth ) => {

		if ( depth > 6 || visited ++ > limit ) return;
		const nm = join( dir, 'node_modules' );
		if ( ! existsSync( nm ) ) return;

		const candidate = join( nm, ...name.split( '/' ), 'package.json' );
		if ( existsSync( candidate ) ) found.push( candidate );

		for ( const entry of safeList( nm ) ) {

			if ( entry.startsWith( '.' ) ) continue;
			if ( entry.startsWith( '@' ) ) {

				for ( const scoped of safeList( join( nm, entry ) ) ) walk( join( nm, entry, scoped ), depth + 1 );

			} else {

				walk( join( nm, entry ), depth + 1 );

			}

		}

	};

	walk( root, 0 );
	return found;

}

function safeList( dir ) {

	try { return readdirSync( dir ); } catch { return []; }

}

/** Source files under root, skipping dependencies and build output. */
function sourceFiles( root, limit = 5000 ) {

	const out = [];
	const walk = ( dir ) => {

		for ( const entry of safeList( dir ) ) {

			if ( out.length >= limit ) return;
			if ( SKIP_DIRS.has( entry ) || entry.startsWith( '.' ) ) continue;
			const full = join( dir, entry );
			let st;
			try { st = statSync( full ); } catch { continue; }
			if ( st.isDirectory() ) walk( full );
			else if ( SOURCE_EXT.test( entry ) && st.size < 2e6 ) out.push( full );

		}

	};

	walk( root );
	return out;

}

/** Addon import paths (three's addons or examples/jsm folders) in a source string. */
function addonImports( code ) {

	const paths = new Set();
	for ( const [ , , path ] of code.matchAll( /['"`]three\/(addons|examples\/jsm)\/([^'"`]+)['"`]/g ) ) paths.add( path );
	return [ ...paths ];

}

/**
 * Runs every check against a project directory.
 *
 * @param {string} root - Project root (where package.json is).
 * @return {{ok: boolean, checks: Array<{id: string, status: 'pass'|'warn'|'fail', title: string, detail?: string, fix?: string}>}}
 */
function runDoctor( root ) {

	const checks = [];
	const add = ( id, status, title, detail, fix ) => checks.push( { id, status, title, ...( detail && { detail } ), ...( fix && { fix } ) } );

	const pkg = readJSON( join( root, 'package.json' ) );
	if ( ! pkg ) add( 'package', 'warn', 'No package.json found', `Looked in ${ root }.` );

	// 1. three installed and supported
	const threePkg = readJSON( join( root, 'node_modules', 'three', 'package.json' ) );
	const rev = threeRevision( threePkg?.version );

	if ( ! threePkg ) add( 'three', 'fail', 'three is not installed', null, 'npm i three' );
	else if ( rev < MIN_THREE ) add( 'three', 'fail', `three ${ threePkg.version } is older than Orrery supports`, `Orrery needs r${ MIN_THREE } or newer.`, 'npm i three@latest' );
	else add( 'three', 'pass', `three ${ threePkg.version } (r${ rev })` );

	// 2. one copy of three
	const copies = findPackageCopies( root, 'three' ).map( ( f ) => ( { file: f, version: readJSON( f )?.version } ) );
	if ( copies.length > 1 ) {

		add( 'duplicates', 'fail', `${ copies.length } copies of three are installed`,
			copies.map( ( c ) => `${ c.version }  ${ relative( root, c.file ).replace( /package\.json$/, '' ) }` ).join( '\n' ),
			'Two copies break instanceof checks and double the bundle. Align versions, then npm dedupe.' );

	} else if ( copies.length === 1 ) {

		add( 'duplicates', 'pass', 'One copy of three' );

	}

	// 3. addon imports still exist
	if ( threePkg ) {

		const jsm = join( root, 'node_modules', 'three', 'examples', 'jsm' );
		const missing = [];
		let scanned = 0;

		for ( const file of sourceFiles( root ) ) {

			let code;
			try { code = readFileSync( file, 'utf8' ); } catch { continue; }
			if ( code.includes( 'orreryjs-doctor-ignore-file' ) ) continue;
			for ( const path of addonImports( code ) ) {

				scanned ++;
				if ( ! existsSync( join( jsm, path ) ) ) missing.push( { file: relative( root, file ), path } );

			}

		}

		if ( missing.length ) {

			add( 'addons', 'fail', `${ missing.length } addon import${ missing.length > 1 ? 's no longer exist' : ' no longer exists' } in three r${ rev }`,
				missing.map( ( m ) => `${ m.file }: three/addons/${ m.path }${ RENAMED[ m.path ] ? `  ->  use ${ RENAMED[ m.path ] }` : '' }` ).join( '\n' ),
				'three renames and removes addons between releases. Update these imports.' );

		} else {

			add( 'addons', 'pass', scanned ? `All ${ scanned } addon imports resolve` : 'No addon imports to check' );

		}

	}

	// 4. @types/three matches three
	const types = readJSON( join( root, 'node_modules', '@types', 'three', 'package.json' ) );
	if ( types && rev ) {

		const typesRev = threeRevision( types.version );
		if ( typesRev !== rev ) add( 'types', 'warn', `@types/three r${ typesRev } does not match three r${ rev }`, null, `npm i -D @types/three@0.${ rev }` );
		else add( 'types', 'pass', `@types/three matches (r${ typesRev })` );

	}

	// 5. Orrery packages aligned
	const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
	const orrery = Object.keys( deps ).filter( ( n ) => n === '@orreryjs/core' || n.startsWith( '@orreryjs/' ) );
	const installed = orrery.map( ( n ) => ( { name: n, version: readJSON( join( root, 'node_modules', ...n.split( '/' ), 'package.json' ) )?.version } ) ).filter( ( p ) => p.version );
	const minors = new Set( installed.map( ( p ) => p.version.split( '.' ).slice( 0, 2 ).join( '.' ) ) );

	if ( minors.size > 1 ) add( 'orrery', 'warn', 'Orrery packages are on different versions', installed.map( ( p ) => `${ p.name }@${ p.version }` ).join( '\n' ), 'Install the same minor version of every Orrery package.' );
	else if ( installed.length ) add( 'orrery', 'pass', `${ installed.length } Orrery package${ installed.length > 1 ? 's' : '' } aligned` );

	return { ok: ! checks.some( ( c ) => c.status === 'fail' ), checks };

}

/**
 * Formats a doctor report for a terminal.
 *
 * @param {{ok: boolean, checks: Array}} report
 * @param {{color?: boolean}} [options]
 * @return {string}
 */
function formatReport( report, { color = false } = {} ) {

	const paint = ( code, s ) => ( color ? `\x1b[${ code }m${ s }\x1b[0m` : s );
	const mark = { pass: paint( 32, 'ok  ' ), warn: paint( 33, 'warn' ), fail: paint( 31, 'fail' ) };
	const lines = [ '', paint( 1, 'orreryjs doctor' ), '' ];

	for ( const c of report.checks ) {

		lines.push( `  ${ mark[ c.status ] }  ${ c.title }` );
		if ( c.detail ) for ( const d of c.detail.split( '\n' ) ) lines.push( `          ${ d }` );
		if ( c.fix ) lines.push( `          ${ paint( 2, 'fix: ' + c.fix ) }` );

	}

	const fails = report.checks.filter( ( c ) => c.status === 'fail' ).length;
	const warns = report.checks.filter( ( c ) => c.status === 'warn' ).length;
	lines.push( '', report.ok ? paint( 32, `  All clear${ warns ? ` (${ warns } warning${ warns > 1 ? 's' : '' })` : '' }.` ) : paint( 31, `  ${ fails } problem${ fails > 1 ? 's' : '' } found.` ), '' );
	return lines.join( '\n' );

}

export { runDoctor, formatReport, addonImports, threeRevision, findPackageCopies };
