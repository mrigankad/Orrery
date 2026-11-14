import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = fileURLToPath( new URL( '../template', import.meta.url ) );

/** Versions the starter installs, kept in one place so releases bump them together. */
const VERSIONS = { '@orreryjs/core': '^0.1.0', '@orreryjs/devtools': '^0.1.0', three: '^0.184.0', vite: '^6.0.0' };

/**
 * Turns a folder name into a valid npm package name.
 *
 * @param {string} name
 * @return {string}
 */
function packageName( name ) {

	return basename( name ).trim().toLowerCase().replace( /\s+/g, '-' ).replace( /^[._]+/, '' ).replace( /[^a-z0-9\-~._]/g, '-' ) || 'my-orrery';

}

/**
 * Writes a new Orrery + Vite project into `cwd/name`.
 *
 * @param {string} name - Folder to create.
 * @param {{cwd?: string, force?: boolean, versions?: Object}} [options]
 * @return {{dir: string, pkg: Object}}
 */
function scaffold( name, { cwd = process.cwd(), force = false, versions = {} } = {} ) {

	const dir = resolve( cwd, name );
	if ( existsSync( dir ) && readdirSync( dir ).length && ! force ) {

		throw new Error( `${ dir } already exists and is not empty. Pick another name or pass --force.` );

	}

	cpSync( TEMPLATE, dir, { recursive: true } );
	writeFileSync( join( dir, '.gitignore' ), 'node_modules\ndist\n' );

	const title = basename( name );
	const indexPath = join( dir, 'index.html' );
	writeFileSync( indexPath, readFileSync( indexPath, 'utf8' ).replaceAll( '__NAME__', title ) );
	writeFileSync( join( dir, 'README.md' ), `# ${ title }\n\nMade with [Orrery](https://github.com/mrigankad/Orrery), batteries for three.js.\n\n    npm install\n    npm run dev\n\nEdit src/main.js. Docs: https://mrigankad.github.io/Orrery/docs/\n` );

	const v = { ...VERSIONS, ...versions };
	const pkg = {
		name: packageName( name ),
		private: true,
		version: '0.0.0',
		type: 'module',
		scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview', doctor: 'orreryjs doctor' },
		dependencies: { '@orreryjs/core': v[ '@orreryjs/core' ], '@orreryjs/devtools': v[ '@orreryjs/devtools' ], three: v.three },
		devDependencies: { vite: v.vite }
	};

	writeFileSync( join( dir, 'package.json' ), JSON.stringify( pkg, null, 2 ) + '\n' );
	writeFileSync( join( dir, 'vite.config.js' ), 'export default { build: { target: \'es2022\', chunkSizeWarningLimit: 1500 } };\n' );
	return { dir, pkg };

}

export { scaffold, packageName, VERSIONS };
