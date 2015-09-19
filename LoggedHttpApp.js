"use strict";

var HttpApp = require( 'App/HttpApp' );
var Config = require( 'App/Config' );
var LoggedHttpAppRequest = require( './LoggedHttpAppRequest' );
var DeferredRecord = require( './DeferredRecord' );
var DeferredSession = require( './DeferredSession' );
var DeferredLog = require( './DeferredLog' );
var FileLog = require( './FileLog' );
var ILogSession = require( './model/ILogSession' );
var ILogEngine = require( './model/ILogEngine' );
var Os = require( 'os' );
var ConsoleLogger = require( './loggers/ConsoleLogger' );
var HttpLogger = require( './loggers/HttpLogger' );

class LoggedHttpApp extends HttpApp {

	constructor ( appRequest, host, port, loggingOptions ) {
		
		super( appRequest || LoggedHttpAppRequest, host, port )
		
		this._logPolicy = 'LOG_ALL';
		this._log = null;
		this._logSession = null;
		this._logEnv = null;
		this._consoleLogger = null;
		this._httpLogger = null;

		if ( Object.isObject( loggingOptions ) ) {
			this.initLogging( loggingOptions );
		}

	}

	setLogPolicy ( policy ) {
		this._logPolicy = policy;
		return this;
	}

	getLogPolicy () {
		return this._logPolicy;
	}

	initLogging ( options ) {

		options = Object.isObject( options ) ? options : {};

		if ( String.isString( options.LogPolicy ) ) {
			this.setLogPolicy( options.LogPolicy );
		}

		var props = [ 'SESSION_APP_RUN' ];
		var sessionProps = options.SessionProps;
		if ( sessionProps instanceof Array ) {
			props = sessionProps.concat( props );
		}
		else if ( sessionProps instanceof Object ) {
			props.push( sessionProps );
		}

		this._log = new DeferredLog( FileLog, options.StorageDir );
		this._logSession = this._log.openSession( props );
		this._logSession.setFlushArbiter( this.flushArbiter.bind( this ) );

		if ( options.EnvLogging !== false ) {
			
			this._logEnv = this._logSession.openRecord( [ 'RECORD_SERVER_ENV', 'DATA_JSON' ] );

			var _this = this;
			this._logSession.once( 'Deferred.Flush', function ( err, session ) {
				LoggedHttpApp.logServerEnv( _this._logEnv );
				_this._logEnv.close();
				_this._logEnv = null;
			} );
		
		}

		if ( options.LogConsole !== false ) {
			// hijack stdout/stderr so all console.log() and similar can be intercepted
			this._consoleLogger = new ConsoleLogger( this._logSession );
		}

		if ( options.LogHttp !== false ) {
			// hijack the http module
			this._httpLogger = new HttpLogger( this._logSession, options.UnchunkHttp );
		}


	}

	flushArbiter ( record ) {
		return true;
	}

	getLog () {
		return this._log;
	}

	getLogSession () {
		return this._logSession;
	}

	// cleanup and then wait for all loggers to finish
	onClose ( acallback ) {
		var _this = this;

		function callback () {
			dontLogAnythingAnymore();
			if ( acallback instanceof Function ) {
				acallback();
			}
		}

		function dontLogAnythingAnymore () {

			if ( _this._consoleLogger ) {
				_this._consoleLogger.unhook();
				_this._consoleLogger = null;
			}
			
			if ( _this._httpLogger ) {
				_this._httpLogger.unhook();
				_this._httpLogger = null;
			}

		}

		// close the server and when this is done
		super.onClose( function () {

			//if we haven't written anything yet don't attempt to open files in the middle of the closing process
			var log = _this._log;
			if ( log === null || log.isEmpty() === true ) {
				dontLogAnythingAnymore();
			}

			// if we don't have a callback just dispose everything, nothing to wait
			if ( !(callback instanceof Function) ) {
				_this._requests.map( 'dispose' );
				return;
			}

			var requests = _this._requests;
			var activeLoggers = requests.length;
			function endLogger () {
				if ( --activeLoggers === 0 ) {
					process.nextTick( callback );
				}
			}
			
			var logSession = _this._logSession;
			if ( logSession ) {
				++activeLoggers;
				logSession.close( endLogger );
			}

			// wait for all loggers. they will not finish before we close our stdout and stderr
			// so make sure we try to finalize and close everything after the .end() call
			for ( var i = requests.length - 1; i >= 0; --i ) {
				var request = requests[ i ];
				request.getLogSession().once( 'Session.Closed', endLogger );
				request.dispose();
			}

			if ( activeLoggers === 0 ) {
				process.nextTick( callback );
			}

		} );
	}

	static logServerEnv ( dest ) {
		// log the server environment
		var env = {
			process: {
				cwd: process.cwd(),
				execPath: process.execPath,
				argv: process.argv,
				execArgv: process.execArgv,
				env: process.env,
				title: process.title,
				pid: process.pid,
				gid: process.getgid(),
				uid: process.getuid(),
				groups: process.getgroups(),
				umask: process.umask()
			},
			node: {
				version: process.version,
				versions: process.versions,
				config: process.config,
			},
			os: {
				type: Os.type(),
				platform: Os.platform(),
				arch: Os.arch(),
				release: Os.release(),
				tmpdir: Os.tmpdir(),
				endianness: Os.endianness(),
				hostname: Os.hostname(),
				totalmem: Os.totalmem(),
				cpus: Os.cpus(),
				networkInterfaces: Os.networkInterfaces()
			}
		};

		if ( dest instanceof ILogSession ) {
			dest.write( env, [ 'RECORD_SERVER_ENV', 'DATA_JSON' ] );
		}
		else {
			var props = dest.getProps();
			dest.write( ILogEngine.normalizeData( env, props ) );
		}
	}

}

module.exports = LoggedHttpApp;