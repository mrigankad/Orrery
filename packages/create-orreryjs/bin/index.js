#!/usr/bin/env node
import { scaffold } from '../src/scaffold.js';

const args = process.argv.slice( 2 );
const name = args.find( ( a ) => ! a.startsWith( '-' ) ) ?? 'my-orrery';

try {

	const { dir } = scaffold( name, { cwd: process.cwd(), force: args.includes( '--force' ) } );
	console.log( `\n  Created ${ name } in ${ dir }\n\n  cd ${ name }\n  npm install\n  npm run dev\n` );

} catch ( error ) {

	console.error( `\n  ${ error.message }\n` );
	process.exitCode = 1;

}
