"use strict";

var LoggedHttpApp = require( './LoggedHttpApp' );
var PerennialAppRequest = require( './PerennialAppRequest' );
var Config = require( 'App/Config' );
var Fs = require( 'fs' );
var FileSession = require( './FileSession' );

class PerennialApp extends LoggedHttpApp {
	
	constructor ( appRequest, options ) {
		
		super( appRequest || PerennialAppRequest, options );


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

		var config = this.getConfig();
		var dirFormat = config.render( '{app.name}{app.version_flat}-{app.instance}-' ) + FileSession.DirectoryFormat;

		options = Object.isObject( options ) ? options : {};
		var sessionProps = options.SessionProps;
		if ( sessionProps instanceof Array ) {
			sessionProps.unshift( { DirectoryFormat: dirFormat } );
		}
		else if ( sessionProps instanceof Object ) {
			if ( !String.isString( sessionProps.DirectoryFormat ) ) {
				sessionProps.DirectoryFormat = dirFormat;
			}
		}
		else {
			options.SessionProps = { DirectoryFormat: dirFormat };
		}

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