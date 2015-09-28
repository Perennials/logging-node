"use strict";

var PerennialApp = require( '../PerennialApp' );

Unitest( 'PerennialApp configs', function ( test ) {

	var app = new PerennialApp();
	app.loadConfig( __dirname );

	test.eq( app.getConfig().get( 'base' ), 'overloaded cfg_env cfg_cli' );

} );