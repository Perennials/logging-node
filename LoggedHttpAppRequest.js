"use strict";

var HttpAppRequest = require( 'App/HttpAppRequest' );
var FileLog = require( './FileLog' );
var DeferredRecord = require( './DeferredRecord' );
var IncomingMessageLogger  = require( './loggers/IncomingMessageLogger' );
var WritableLogger  = require( './loggers/WritableLogger' );
var ConsoleLogger  = require( './loggers/ConsoleLogger' );
var LoggedHttpApp = null;

function LoggedHttpAppRequest ( app, req, res ) {
	
	var _this = this;

	this.LogSession = app.getLog().openSession( req.headers[ 'freedom2-debug-logsession' ], [ 'SESSION_SERVER_REQUEST' ] );

	// log the server environment
	LoggedHttpApp = LoggedHttpApp || require( './LoggedHttpApp' );
	LoggedHttpApp.logServerEnv( this.LogSession );
	
	// log req
	new IncomingMessageLogger( req, this.LogSession.openRecord( [ 'RECORD_SERVER_REQUEST', 'DATA_TEXT' ] ) );

	// log res
	new WritableLogger( res, this.LogSession.openRecord( [ 'RECORD_SERVER_RESPONSE', 'DATA_TEXT' ] ) );

	// defer all log streams - open them on the first write
	// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected to the current domain
	this.LogStreams = {
		Stdout: this.LogSession.openRecord( [ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ] ),
		Stderr: this.LogSession.openRecord( [ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ] ),
	};	

	HttpAppRequest.call( this, app, req, res );
	this.Domain.HttpAppRequest = this;

}

LoggedHttpAppRequest.extend( HttpAppRequest, {

	onError: function ( err ) {
		this.LogSession.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ] );
		HttpAppRequest.prototype.onError.call( this, err );
	},

	dispose: function () {

		for ( var steamName in this.LogStreams ) {
			this.LogStreams[ steamName ].close();
		}

		this.LogSession.close();
	
		HttpAppRequest.prototype.dispose.call( this );
	}

} );

module.exports = LoggedHttpAppRequest;