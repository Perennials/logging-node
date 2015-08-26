var HttpApp = require( 'App/HttpApp' );
var Config = require( 'App/Config' );
var LoggedHttpAppRequest = require( './LoggedHttpAppRequest' );
var DeferredLogStream = require( './DeferredLogStream' );
var FileLog = require( './FileLog' );

//todo: maybe we can have functions for explicitly opening the log streams in case we need fine grained control

function LoggedHttpApp ( appRequest, host, port ) {
	this._config = new Config();
	this._log = null;
	this._firstWrite = false;
	this._consoleBackup = { stdout: {}, stderr: {} };

	var _this = this;
	
	function makeLogStreamCallback( logStreamName ) {
		return function ( stream ) {
			_this._logStreams[ logStreamName ] = stream;
			stream.once( 'close', function () {
				// don't attempt to continue logging if the streams are closed
				_this._logStreams[ logStreamName ] = null;
			} );
		};
	}

	var onFirstWrite = this._onFirstConsoleWrite.bind( this );

	// defer all log streams - open them on the first write
	// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected if there is no domain
	this._logStreams = {
		Stdout: new DeferredLogStream(
			[ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ],
			makeLogStreamCallback( 'Stdout' ),
			onFirstWrite
		),
		Stderr: new DeferredLogStream(
			[ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ],
			makeLogStreamCallback( 'Stderr' ),
			onFirstWrite
		),
	};

	// hijack stdout/stderr so all console.log() and similar can be intercepted
	if ( process.stdout ) {
		this._hookStreamCopierFn( 'stdout', 'write', 'Stdout' )
		this._hookStreamCopierFn( 'stdout', 'end', 'Stdout' )
	}
	if ( process.stderr ) {
		this._hookStreamCopierFn( 'stderr', 'write', 'Stderr' )
		this._hookStreamCopierFn( 'stderr', 'end', 'Stderr' )
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
			_this._logStreams = {
				Stdout: null,
				Stderr: null
			};
			if ( _this._onLogReady instanceof Function ) {
				process.nextTick( function () {
					_this._onLogReady( err, null );
				} );
			}
		}

		new FileLog( this.getConfig().get( 'storage.log' ), function ( err, log ) {
			if ( err ) {
				cancelLogging( err );
				return;
			}
			
			//todo: consider instance identifier in the session names
			log.startSession( null, [ 'SESSION_APP_RUN' ], function ( err, id ) {
				if ( err ) {
					cancelLogging( err );
					return;
				}

				_this._log = log;

				for ( var steamName in _this._logStreams ) {
					_this._logStreams[ steamName ].assignLog( log );
				}

				if ( _this._onLogReady instanceof Function ) {
					process.nextTick( function () {
						_this._onLogReady( null, log );
					} );
				}
			} );
		} );
	},

	_hookStreamCopierFn: function ( streamName, streamCallName, appRqStreamName ) {

		var app = this;
		var stream = process[ streamName ];
		var originalCall = stream[ streamCallName ];

		this._consoleBackup[ streamName ][ streamCallName ] = originalCall;
		
		stream[ streamCallName ] = function () {

			// call the originall .write() or .end()
			var ret = originalCall.apply( stream, arguments );

			// call .write() or .end() on the log file
			var domain = process.domain;
			var fileStream = null;
			if ( domain && (fileStream = domain.HttpAppRequest.LogStreams[ appRqStreamName ]) ) {
				fileStream[ streamCallName ].apply( fileStream, arguments );
			}
			else if ( fileStream = app._logStreams[ appRqStreamName ] ) {
				fileStream[ streamCallName ].apply( fileStream, arguments );
			}

			return ret;
		};
	},

	_recoverConsoleFunctions: function ( streamName ) {
		var backup = this._consoleBackup[ streamName ];
		for ( var callName in backup ) {
			process[ streamName ][ callName ] = backup[ callName ];
		}
	},

	getLog: function ( callback ) {
		var _this = this;
		if ( this._log || this._firstWrite === false ) {
			process.nextTick( function () {
				callback( null, _this.log );
			} );
		}
		else {
			this._onLogReady = callback;
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
			
			if ( _this._log ) {
				++activeLoggers;
				_this._log.waitRecords( function () {
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
					if ( request.Log === null ) {
						if ( --activeLoggers === 0 ) {
							process.nextTick( callback );
						}
						continue;
					}
					request.dispose();
					request.Log.waitRecords( function () {
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