"use strict";

var LoggedHttpApp = require( './LoggedHttpApp' );

class PerennialApp extends LoggedHttpApp {
	
	constructor ( appRequest, host, port ) {
		
		if ( arguments.length == 2 ) {
			port = host;
			host = appRequest;
			appRequest = PerennialAppRequest;
		}
		
		super( appRequest, host, port );
	}

	setLogPolicy ( policy ) {
		this._logPolicy = policy;
		return this;
	}

	flushArbiter ( record ) {
		return this._logPolicy == 'LOG_ALL';
	}

	flushDeferredLogs () {
		this._logSession.flushDeferredLogs();
	}

}

module.exports = PerennialApp;