"use strict";

var LoggedHttpAppRequest = require( './LoggedHttpAppRequest' );

class PerennialAppRequest extends LoggedHttpAppRequest {
	
	constructor ( app, req, res ) {
		super( app, req, res );
	}

	setLogPolicy ( policy ) {
		this._logPolicy = policy;
		return this;
	}

	determineParentSession () {
		return this.Request.headers[ 'freedom2-debug-logsession' ];
	}

	flushArbiter ( record ) {
		return this._logPolicy == 'LOG_ALL';
	}

	flushDeferredLogs () {
		this.LogSession.flushDeferredLogs();
	}

	onError ( err ) {
		if ( this._logPolicy == 'LOG_ALL_ON_ERROR' ) {
			
			this.setLogPolicy( 'LOG_ALL' );
			this.flushDeferredLogs();

			this.App.setLogPolicy( 'LOG_ALL' );
			this.App.flushDeferredLogs();
		}
		super.onError( err );
	}
}

module.exports = PerennialAppRequest;