"use strict";

var Events = require( 'events' );

// this a bit global functionality
class ConsoleLogger extends Events.EventEmitter {
	
	constructor ( appLogSession ) {

		super();

		this._appLogSession = appLogSession;
		this._consoleBackup = { stdout: {}, stderr: {} };
		this._stderrEvent = true;

		// defer all log streams - open them on the first write
		// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected if there is no domain
		this._logStreams = {
			Stdout: appLogSession.openRecord( [ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ] ),
			Stderr: appLogSession.openRecord( [ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ] ),
		};

		if ( process.stdout ) {
			this._writeHook( 'stdout' )
			this._endHook( 'stdout' )
		}
		
		if ( process.stderr ) {
			this._writeHook( 'stderr' )
			this._endHook( 'stderr' )
		}

	}

	_writeHook ( streamName ) {
		var appRqStreamName = streamName[ 0 ].toUpperCase() + streamName.slice( 1 );

		var _this = this;
		var stream = process[ streamName ];
		var originalCall = stream.write;

		this._consoleBackup[ streamName ].write = originalCall;
		
		stream.write = function ( data, encoding, callback ) {

			// call the originall .write() or .end()
			var ret = originalCall.apply( stream, arguments );
			if ( data == "Ops." ) {
				debugger;
			}
			// call .write() or .end() on the log file
			var domain = process.domain;
			var fileStream = null;
			if ( domain && (fileStream = domain.HttpAppRequest.LogStreams[ appRqStreamName ]) ) {
				fileStream.write( data );
			}
			else if ( fileStream = _this._logStreams[ appRqStreamName ] ) {
				if ( _this._stderrEvent && appRqStreamName == 'Stderr' ) {
					_this._stderrEvent = false;
					_this.emit( 'Stderr.Open' );
				}
				fileStream.write( data );
			}

			return ret;
		};
	}

	_endHook ( streamName ) {
		var appRqStreamName = streamName[ 0 ].toUpperCase() + streamName.slice( 1 );
		
		var _this = this;
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
			else if ( fileStream = _this._logStreams[ appRqStreamName ] ) {
				//bp: node's end will call write, so just close. if all ok close should happen after the write. britle code though
				fileStream.close();
			}

			return ret;
		};
	}

	// if we dont have this and construct new instance it will mess up. need to .close() though
	_recoverConsoleFunctions ( streamName ) {
		var backup = this._consoleBackup[ streamName ];
		for ( var callName in backup ) {
			process[ streamName ][ callName ] = backup[ callName ];
		}
	}

	unhook () {
		var logStreams = this._logStreams;
		for ( var name in logStreams ) {
			logStreams[ name ].close();
		}

		for ( var streamName in this._consoleBackup ) {
			this._recoverConsoleFunctions( streamName );
		}
	}
	
	
}

module.exports = ConsoleLogger;