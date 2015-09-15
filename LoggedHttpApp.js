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
		this._log = new DeferredLog( FileLog, (function() { return [ this.getStorageDir() ]; }).bind( this ) );
		this._logSession = this._log.openSession( null, [ 'SESSION_APP_RUN' ] );
		this._logEnv = this._logSession.openRecord( [ 'RECORD_SERVER_ENV', 'DATA_JSON' ] );

		var _this = this;
		this._logSession.once( 'Session.Opened', function ( err, session ) {
			LoggedHttpApp.logServerEnv( _this._logEnv );
			_this._logEnv.close();
			_this._logEnv = null;
		} );

		// hijack stdout/stderr so all console.log() and similar can be intercepted
		this._consoleLogger = new ConsoleLogger( this._logSession );
		// hijack the http module
		this._httpLogger = new HttpLogger( this._logSession );

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
		var _this = this;
		var session = this._logSession;
		if ( !session.isEmpty() && session.getLogSession() === null ) {
			session.once( 'Session.Opened', function ( err, session ) {
				process.nextTick( function () {
					callback( err, session );
				} );
			} )
		}
		else {
			process.nextTick( function () {
				callback( null, _this._logSession );
			} );
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

			_this._consoleLogger.unhook();
			_this._httpLogger.unhook();

		}

		// close the server and when this is done
		super.onClose( function () {

			//if we haven't written anything yet don't attempt to open files in the middle of the closing process
			if ( _this._log.isEmpty() === true ) {
				dontLogAnythingAnymore();
			}

			// if we don't have a callback just dispose everything, nothing to wait
			if ( !(callback instanceof Function) ) {
				_this._requests.map( 'dispose' );
				return;
			}

			var requests = _this._requests;
			var activeLoggers = requests.length + 1; //plus one for _this._logSession
			function endLogger () {
				if ( --activeLoggers === 0 ) {
					process.nextTick( callback );
				}
			}
			
			_this._logSession.close( endLogger );

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