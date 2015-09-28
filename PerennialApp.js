"use strict";

var LoggedHttpApp = require( './LoggedHttpApp' );
var Config = require( 'App/Config' );
var Fs = require( 'fs' );

class PerennialApp extends LoggedHttpApp {
	
	constructor ( appRequest, host, port, options ) {
		
		if ( arguments.length == 2 ) {
			port = host;
			host = appRequest;
			appRequest = PerennialAppRequest;
		}
		
		super( appRequest, host, port, options );


		var cfg = (this._config = new Config());

		var envs = process.env;
		for ( var key in envs ) {
			if ( key.startsWith( 'cfg.' ) ) {
				cfg.set( key.slice( 4 ), envs[ key ] );
			}
		}
		
		var argv = this.getArgv();
		for ( var key in argv ) {
			if ( key.startsWith( 'cfg.' ) ) {
				cfg.set( key.slice( 4 ), argv[ key ] );
			}
		}
		
	}

	loadConfig ( dir ) {
		
		// load default config
		var cfgFn = dir + '/config.js';
		var config = this._config;
		if ( Fs.existsSync( cfgFn ) ) {
			config = new Config( require( cfgFn ), config );
		}

		// local dev support
		var cfgFn = dir + '/config.local.js';
		if ( Fs.existsSync( cfgFn ) ) {
			config = new Config( require( cfgFn ), config );
		}

		// docker support
		var cfgFn = dir + '/config/local.js';
		if ( Fs.existsSync( cfgFn ) ) {
			config = new Config( require( cfgFn ), config );
		}

		return this._config = config;
	}

	getConfig () {
		return this._config;
	}

	initLogging ( options ) {
		super.initLogging( options );
		if ( this._consoleLogger ) {
			this._consoleLogger.on( 'Stderr.Open', this._onStderrOpen.bind( this ) );
		}
	}

	flushArbiter ( record ) {
		return this._logPolicy == 'LOG_ALL';
	}

	flushDeferredLogs () {
		this._logSession.flushDeferredLogs();
	}

	_onStderrOpen () {

		if ( this._logPolicy == 'LOG_ALL_ON_ERROR' ) {
			
			this.setLogPolicy( 'LOG_ALL' );
			this.flushDeferredLogs();

		}
	}

}

module.exports = PerennialApp;