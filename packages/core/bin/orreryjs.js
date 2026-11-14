#!/usr/bin/env node
import { runDoctor, formatReport } from '../src/doctor.js';

const [ command = 'help', ...args ] = process.argv.slice( 2 );

if ( command === 'doctor' ) {

	const dir = args.find( ( a ) => ! a.startsWith( '-' ) ) ?? process.cwd();
	const report = runDoctor( dir );
	if ( args.includes( '--json' ) ) console.log( JSON.stringify( report, null, 2 ) );
	else console.log( formatReport( report, { color: process.stdout.isTTY && ! process.env.NO_COLOR } ) );
	process.exitCode = report.ok ? 0 : 1;

} else {

	console.log( `orreryjs <command>

  doctor [dir] [--json]   Check three.js version, duplicate copies, addon imports
                          that no longer exist, @types/three and Orrery versions.` );

}
