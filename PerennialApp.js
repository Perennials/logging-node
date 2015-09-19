"use strict";

var LoggedHttpApp = require( './LoggedHttpApp' );

class PerennialApp extends LoggedHttpApp {
	
	constructor ( appRequest, host, port, options ) {
		
		if ( arguments.length == 2 ) {
			port = host;
			host = appRequest;
			appRequest = PerennialAppRequest;
		}
		
		super( appRequest, host, port, options );
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