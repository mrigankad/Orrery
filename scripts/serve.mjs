// Tiny static server for the examples: node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath( new URL( '..', import.meta.url ) );
const port = Number( process.argv[ 2 ] ) || 5173;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm' };

createServer( async ( req, res ) => {
	let path = decodeURIComponent( new URL( req.url, 'http://x' ).pathname );
	if ( path.endsWith( '/' ) ) path += 'index.html';
	const file = normalize( join( root, path ) );
	if ( ! file.startsWith( normalize( root ) ) ) { res.writeHead( 403 ).end(); return; }
	try {
		const body = await readFile( file );
		res.writeHead( 200, { 'content-type': types[ extname( file ) ] || 'application/octet-stream' } ).end( body );
	} catch { res.writeHead( 404 ).end( 'Not found' ); }
} ).listen( port, '127.0.0.1', () => console.log( `Orrery examples on http://127.0.0.1:${ port }/` ) );
