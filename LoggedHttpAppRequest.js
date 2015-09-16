"use strict";

var HttpAppRequest = require( 'App/HttpAppRequest' );
var IncomingMessageLogger  = require( './loggers/IncomingMessageLogger' );
var WritableLogger  = require( './loggers/WritableLogger' );
var ConsoleLogger  = require( './loggers/ConsoleLogger' );
var LoggedHttpApp = null;

class LoggedHttpAppRequest extends HttpAppRequest {

	constructor ( app, req, res ) {
		
		super( app, req, res );

		this.Domain.HttpAppRequest = this;

		var _this = this;

		var props = [ 'SESSION_SERVER_REQUEST' ];
		var props2 = this.determineSessionProps();
		if ( props2 instanceof Array ) {
			props = props2.concat( props );
		}
		else if ( props2 instanceof Object ) {
			props.push( props2 );
		}

		this._logPolicy = this.determineLogPolicy();
		if ( this._logPolicy == 'LOG_NOTHING' ) {
			this.LogSession = null;
			this.LogStreams = { Stdout: null, Stderr: null };
			return;
		}

		this.LogSession = app.getLog().openSession( props );
		this.LogSession.setFlushArbiter( this.flushArbiter.bind( this ) );

		// log the server environment
		LoggedHttpApp = LoggedHttpApp || require( './LoggedHttpApp' );
		LoggedHttpApp.logServerEnv( this.LogSession );
		
		// log req
		new IncomingMessageLogger( req, this.LogSession.openRecord( [ 'RECORD_SERVER_REQUEST', 'DATA_TEXT' ] ) );

		// log res
		new WritableLogger( res.connection, this.LogSession.openRecord( [ 'RECORD_SERVER_RESPONSE', 'DATA_TEXT' ] ) );

		// defer all log streams - open them on the first write
		// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected to the current domain
		this.LogStreams = {
			Stdout: this.LogSession.openRecord( [ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ] ),
			Stderr: this.LogSession.openRecord( [ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ] ),
		};	


	}

	flushArbiter ( record ) {
		return true;
	}

	determineSessionProps () {
		return null;
	}

	determineLogPolicy () {
		// for debugging this can be 'LOG_NOTHING' to disable all logging
		return 'LOG_ALL';
	}

	onError ( err ) {
		var logSession = this.LogSession;
		if ( logSession ) {
			logSession.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ] );
		}
		super.onError( err );
	}

	dispose () {

		if ( this.Domain ) {

			for ( var steamName in this.LogStreams ) {
				this.LogStreams[ steamName ].close();
			}

			var logSession = this.LogSession;
			if ( logSession ) {
				logSession.close();
			}

			super.dispose();
		}

	}

} 

module.exports = LoggedHttpAppRequest;
