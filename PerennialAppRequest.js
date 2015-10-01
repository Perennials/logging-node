"use strict";

var LoggedHttpAppRequest = require( './LoggedHttpAppRequest' );
var FileSession = require( './FileSession' );

class PerennialAppRequest extends LoggedHttpAppRequest {
	
	initLogging ( options ) {

		var config = this.getApp().getConfig();
		var dirFormat = config.render( '{app.name}{app.version_flat}-{app.instance}-' + FileSession.DirectoryFormat );

		options = Object.isObject( options ) ? options : {};
		var sessionProps = options.SessionProps;
		if ( sessionProps instanceof Array ) {
			sessionProps.unshift( { DirectoryFormat: dirFormat } );
		}
		else if ( sessionProps instanceof Object ) {
			if ( !String.isString( sessionProps.DirectoryFormat ) ) {
				sessionProps.DirectoryFormat = dirFormat;
			}
		}
		else {
			options.SessionProps = { DirectoryFormat: dirFormat };
		}

		// fill our parent session from the headers, if there is no override
		var parentSession = this._request.headers[ 'freedom2-debug-logsession' ];
		if ( parentSession !== undefined ) {
			
			var sessionProps = options.SessionProps;
			if ( sessionProps instanceof Array ) {
				sessionProps.unshift( { ParentSession: parentSession } );
			}
			else if ( sessionProps instanceof Object ) {
				if ( !String.isString( sessionProps.ParentSession ) ) {
					sessionProps.ParentSession = parentSession;
				}
			}
			else {
				options.SessionProps = { ParentSession: parentSession };
			}
		}

		super.initLogging( options );

		if ( this._logSession ) {
			var _this = this;
			this._logSession.on( 'Deferred.Flush', function ( err, session ) {
				if ( session.getId() !== null ) {
					var res = _this.getResponse();
					if ( !res.headersSent ) {
						res.setHeader( 'freedom2-debug-logsession', session.getId() );
					}
				}
			} );
		}


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
