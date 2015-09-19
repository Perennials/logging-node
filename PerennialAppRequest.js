"use strict";

var LoggedHttpAppRequest = require( './LoggedHttpAppRequest' );

class PerennialAppRequest extends LoggedHttpAppRequest {
	
	initLogging ( options ) {


		// fill our parent session from the headers, if there is no override
		var parentSession = this._request.headers[ 'freedom2-debug-logsession' ];
		if ( parentSession !== undefined ) {
			
			options = Object.isObject( options ) ? options : {};
			var sessionProps = options.SessionProps;
			if ( sessionProps instanceof Array ) {
				sessionProps.unshift( { ParentSession: parentSession } );
			}
			else if ( sessionProps instanceof Object && !String.isString( sessionProps.ParentSession ) ) {
				sessionProps.ParentSession = parentSession;
			}
			else {
				options.SessionProps = { ParentSession: parentSession };
			}
		}

		super.initLogging( options );

	}

	flushArbiter ( record ) {
		return this._logPolicy == 'LOG_ALL';
	}

	flushDeferredLogs () {
		this._logSession.flushDeferredLogs();
	}

	onError ( err ) {
		if ( this._logPolicy == 'LOG_ALL_ON_ERROR' ) {
			
			this.setLogPolicy( 'LOG_ALL' );
			this.flushDeferredLogs();

		}
		return super.onError( err );
	}
}

module.exports = PerennialAppRequest;
