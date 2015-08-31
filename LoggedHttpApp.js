var HttpApp = require( 'App/HttpApp' );
var Config = require( 'App/Config' );
var LoggedHttpAppRequest = require( './LoggedHttpAppRequest' );
var DeferredRecord = require( './DeferredRecord' );
var DeferredSession = require( './DeferredSession' );
var DeferredLog = require( './DeferredLog' );
var FileLog = require( './FileLog' );
var ILogSession = require( './ILogSession' );
var ILogEngine = require( './ILogEngine' );
var Os = require( 'os' );

function LoggedHttpApp ( appRequest, host, port ) {
	this._config = new Config();
	this._log = new DeferredLog( FileLog, (function() { return [ this._config.get( 'storage.log' ) ]; }).bind( this ) );
	this._logSession = this._log.openSession( null, [ 'SESSION_APP_RUN' ] );
	this._logEnv = this._logSession.openRecord( [ 'RECORD_SERVER_ENV', 'DATA_JSON' ] );
	this._consoleBackup = { stdout: {}, stderr: {} };

	var _this = this;
	this._logSession.once( 'Session.Opened', function ( err, session ) {
		LoggedHttpApp.logServerEnv( _this._logEnv );
		_this._logEnv.close();
		_this._logEnv = null;
	} );

	// defer all log streams - open them on the first write
	// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected if there is no domain
	this._logStreams = {
		Stdout: this._logSession.openRecord( [ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ] ),
		Stderr: this._logSession.openRecord( [ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ] ),
	};

	// hijack stdout/stderr so all console.log() and similar can be intercepted
	if ( process.stdout ) {
		this._writeHook( 'stdout', 'Stdout' )
		this._endHook( 'stdout', 'Stdout' )
	}
	if ( process.stderr ) {
		this._writeHook( 'stderr', 'Stderr' )
		this._endHook( 'stderr', 'Stderr' )
	}

	HttpApp.call( this, appRequest || LoggedHttpAppRequest, host, port )
}

LoggedHttpApp.extend( HttpApp, {

	_writeHook: function ( streamName, appRqStreamName ) {
		var app = this;
		var stream = process[ streamName ];
		var originalCall = stream.write;

		this._consoleBackup[ streamName ].write = originalCall;
		
		stream.write = function ( data, encoding, callback ) {

			// call the originall .write() or .end()
			var ret = originalCall.apply( stream, arguments );

			// call .write() or .end() on the log file
			var domain = process.domain;
			var fileStream = null;
			if ( domain && (fileStream = domain.HttpAppRequest.LogStreams[ appRqStreamName ]) ) {
				fileStream.write( data );
			}
			else if ( fileStream = app._logStreams[ appRqStreamName ] ) {
				fileStream.write( data );
			}

			return ret;
		};
	},

	_endHook: function ( streamName, appRqStreamName ) {
		var app = this;
		var stream = process[ streamName ];
		var originalCall = stream.end;

		this._consoleBackup[ streamName ].end = originalCall;
		
		stream.end = function ( data, encoding, callback ) {

			// call the originall .write() or .end()
			var ret = originalCall.apply( stream, arguments );
			
			// call .write() or .end() on the log file
			var domain = process.domain;
			var fileStream = null;
			if ( domain && (fileStream = domain.HttpAppRequest.LogStreams[ appRqStreamName ]) ) {
				//bp: node's end will call write, so just close. if all ok close should happen after the write. britle code though
				fileStream.close();
			}
			else if ( fileStream = app._logStreams[ appRqStreamName ] ) {
				//bp: node's end will call write, so just close. if all ok close should happen after the write. britle code though
				fileStream.close();
			}

			return ret;
		};
	},

	// if we dont have this and construct new instance it will mess up. need to .close() though
	_recoverConsoleFunctions: function ( streamName ) {
		var backup = this._consoleBackup[ streamName ];
		for ( var callName in backup ) {
			process[ streamName ][ callName ] = backup[ callName ];
		}
	},

	getLog: function () {
		return this._log;
	},

	getLogSession: function ( callback ) {
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
	},

	getConfig: function () {
		return this._config;
	},

	// cleanup and then wait for all loggers to finish
	onClose: function ( acallback ) {
		var _this = this;

		function callback () {
			dontLogAnythingAnymore();
			acallback();
		}

		function dontLogAnythingAnymore () {

			var logStreams = _this._logStreams;
			for ( var name in logStreams ) {
				logStreams[ name ].close();
			}

			for ( var streamName in _this._consoleBackup ) {
				_this._recoverConsoleFunctions( streamName );
			}
		}

		// close the server and when this is done
		HttpApp.prototype.onClose.call( this, function () {

			//if we haven't written anything yet don't attempt to open files in the middle of the closing process
			if ( _this._log.isEmpty() === false ) {
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
			_this._logSession = null;

			// wait for all loggers. they will not finish before we close our stdout and stderr
			// so make sure we try to finalize and close everything after the .end() call
			for ( var i = requests.length - 1; i >= 0; --i ) {
				var request = requests[ i ];
				request.LogSession.once( 'Session.Closed', endLogger );
				request.dispose();
			}

		} );
	}

} );

LoggedHttpApp.defineStatic( {

	logServerEnv: function ( dest ) {
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
			props = dest.getProps();
			dest.write( ILogEngine.normalizeData( env, props ) );
		}
	}

} );

module.exports = LoggedHttpApp;