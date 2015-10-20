"use strict";

require( 'Unitest' ).enable();

if ( process.argv[2] == 'nocolor' ) {
	Unitest.noColor();
}

require( './Helpers.js' );
require( './ILogEngine.js' );
require( './FileLog.js' );
require( './LoggedHttpApp.js' );