"use strict";

var HttpAppRequest = require( 'App/HttpAppRequest' );
var FileLog = require( './FileLog' );
var DeferredRecord = require( './DeferredRecord' );
var IncomingMessageLogger  = require( './loggers/IncomingMessageLogger' );
var WritableLogger  = require( './loggers/WritableLogger' );
var ConsoleLogger  = require( './loggers/ConsoleLogger' );
var LoggedHttpApp = null;

class LoggedHttpAppRequest extends HttpAppRequest {

	constructor ( app, req, res ) {
		
		super( app, req, res );

		this.Domain.HttpAppRequest = this;
		
		var _this = this;

		this.LogSession = app.getLog().openSession( req.headers[ 'freedom2-debug-logsession' ], [ 'SESSION_SERVER_REQUEST' ] );

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

	onError ( err ) {
		this.LogSession.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ] );
		super.onError( err );
	}

	dispose () {

		for ( var steamName in this.LogStreams ) {
			this.LogStreams[ steamName ].close();
		}

		this.LogSession.close();
	
		super.dispose();
	}

} 

module.exports = LoggedHttpAppRequest;