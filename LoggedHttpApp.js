var HttpApp = require( 'App/HttpApp' );
var Config = require( 'App/Config' );
var LoggedHttpAppRequest = require( './LoggedHttpAppRequest' );
var DeferredRecord = require( './DeferredRecord' );
var FileLog = require( './FileLog' );

function LoggedHttpApp ( appRequest, host, port ) {
	this._config = new Config();
	this._log = null;
	this._logSession = null;
	this._firstWrite = false;
	this._consoleBackup = { stdout: {}, stderr: {} };

	var _this = this;
	
	function makeLogStreamCallback( logStreamName ) {
		return function ( stream ) {
			_this._logStreams[ logStreamName ] = stream;
			stream.once( 'Record.Closed', function () {
				// don't attempt to continue logging if the streams are closed
				_this._logStreams[ logStreamName ] = null;
			} );
		};
	}

	var onFirstWrite = this._onFirstConsoleWrite.bind( this );

	// defer all log streams - open them on the first write
	// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected if there is no domain
	this._logStreams = {
		Stdout: new DeferredRecord(
			[ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ],
			makeLogStreamCallback( 'Stdout' ),
			onFirstWrite
		),
		Stderr: new DeferredRecord(
			[ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ],
			makeLogStreamCallback( 'Stderr' ),
			onFirstWrite
		),
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

	// open a log session on the first console write
	_onFirstConsoleWrite: function () {

		if ( this._firstWrite ) {
			return;
		}

		this._firstWrite = true;

		var _this = this;

		function cancelLogging ( err ) {
			_this._log = null;
			_this._logSession = null;
			_this._logStreams = {
				Stdout: null,
				Stderr: null
			};
			if ( _this._onLogSessionReady instanceof Function ) {
				process.nextTick( function () {
					_this._onLogSessionReady( err, null );
				} );
			}
		}

		var cfg = this.getConfig();
		this._log = new FileLog( cfg.get( 'storage.log' ), function ( err, log ) {
			if ( err ) {
				cancelLogging( err );
				return;
			}
			
			//todo: consider instance identifier in the session names
			log.openSession( null, [ 'SESSION_APP_RUN' ], function ( err, session ) {
				if ( err ) {
					cancelLogging( err );
					return;
				}

				_this._logSession = session;

				for ( var streamName in _this._logStreams ) {
					_this._logStreams[ streamName ].assignSession( session );
				}

				if ( _this._onLogSessionReady instanceof Function ) {
					process.nextTick( function () {
						_this._onLogSessionReady( null, session );
					} );
				}
			} );
		} );
	},

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

	getLogSession: function ( callback ) {
		var _this = this;
		if ( this._logSession || this._firstWrite === false ) {
			process.nextTick( function () {
				callback( null, _this._logSession );
			} );
		}
		else {
			this._onLogSessionReady = callback;
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
			_this._log = null;
			_this._logStreams = {
				Stdout: null,
				Stderr: null
			};
			for ( var streamName in _this._consoleBackup ) {
				_this._recoverConsoleFunctions( streamName );
			}
		}

		// close the server and when this is done
		HttpApp.prototype.onClose.call( this, function () {

			// if we haven't written anything yet don't attempt to open files in the middle of the closing process
			if ( this._firstWrite === false ) {
				dontLogAnythingAnymore();
			}

			// if we don't have a callback just dispose everything, nothing to wait
			if ( !(callback instanceof Function) ) {
				_this._requests.map( 'dispose' );
				return;
			}

			var activeLoggers = _this._requests.length;
			
			if ( _this._logSession ) {
				++activeLoggers;
				_this._logSession.wait( function () {
					if ( --activeLoggers === 0 ) {
						process.nextTick( callback );
					}
				} );
			}

			if ( activeLoggers === 0 ) {
				process.nextTick( callback );
			}
			else {
				// wait for all loggers. they will not finish before we close our stdout and stderr
				// so make sure we try to finalize and close everything after the .end() call
				for ( var i = activeLoggers - ( _this._log ? 2 : 1 ); i >= 0; --i ) {
					var request = _this._requests[ i ];
					if ( request.LogSession === null ) {
						if ( --activeLoggers === 0 ) {
							process.nextTick( callback );
						}
						continue;
					}
					request.dispose();
					request.LogSession.wait( function () {
						if ( --activeLoggers === 0 ) {
							process.nextTick( callback );
						}
					} );
				}
			}
		} );
	}

} );

module.exports = LoggedHttpApp;