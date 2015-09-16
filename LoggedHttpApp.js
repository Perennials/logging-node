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

	constructor ( appRequest, host, port ) {
		
		super( appRequest || LoggedHttpAppRequest, host, port )
		
		this._storageDir = null;

		this._logPolicy = this.determineLogPolicy();
		if ( this._logPolicy == 'LOG_NOTHING' ) {
			this._log = null;
			this._logSession = null;
			this._consoleLogger = null;
			this._httpLogger = null;
			return;
		}

		var props = [ 'SESSION_APP_RUN' ];
		var props2 = this.determineSessionProps();
		if ( props2 instanceof Array ) {
			props = props2.concat( props );
		}
		else if ( props2 instanceof Object ) {
			props.push( props2 );
		}

		this._log = new DeferredLog( FileLog, (function() { return [ this.getStorageDir() ]; }).bind( this ) );
		this._logSession = this._log.openSession( props );
		this._logSession.setFlushArbiter( this.flushArbiter.bind( this ) );
		this._logEnv = this._logSession.openRecord( [ 'RECORD_SERVER_ENV', 'DATA_JSON' ] );

		var _this = this;
		this._logSession.once( 'Deferred.Flush', function ( err, session ) {
			LoggedHttpApp.logServerEnv( _this._logEnv );
			_this._logEnv.close();
			_this._logEnv = null;
		} );

		// hijack stdout/stderr so all console.log() and similar can be intercepted
		this._consoleLogger = new ConsoleLogger( this._logSession );
		// hijack the http module
		this._httpLogger = new HttpLogger( this._logSession );

	}

	determineSessionProps () {
		return null;
	}

	determineLogPolicy () {
		// for debugging this can be 'LOG_NOTHING' to disable all logging
		return 'LOG_ALL';
	}

	flushArbiter ( record ) {
		return true;
	}

	getLog () {
		return this._log;
	}

	getStorageDir () {
		return this._storageDir;
	}

	setStorageDir ( dir ) {
		this._storageDir = dir;
		return this;
	}
	

	getLogSession ( callback ) {
		var session = this._logSession;
		if ( !session.isEmpty() && session.getLogSession() === null ) {
			session.once( 'Deferred.Flush', function ( err, session ) {
				process.nextTick( callback, err, session );
			} )
		}
		else {
			process.nextTick( callback, null, this._logSession );
		}
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
				request.LogSession.once( 'Session.Closed', endLogger );
				request.dispose();
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