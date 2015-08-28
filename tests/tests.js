"use strict";

require( 'Unitest' ).enable();

if ( process.argv[2] == 'nocolor' ) {
	Unitest.noColor();
}

require( './ILogEngine.js' );
require( './FileLog.js' );
require( './LoggedHttpApp.js' );