"use strict";

var HttpAppRequest = require( 'App/HttpAppRequest' );
var FileLog = require( './FileLog' );
var WriteBuffer = require( './WriteBuffer' );
var DeferredRecord = require( './DeferredRecord' );
var IncomingMessageLogger  = require( './IncomingMessageLogger' );
var ServerResponseLogger  = require( './ServerResponseLogger' );
var LoggedHttpApp = null;

function LoggedHttpAppRequest ( app, req, res ) {
	
	var _this = this;

	// WriteBuffer is buffering write calls so it will work for FileSession too
	this.LogSession = app.getLog().openSession( req.headers[ 'freedom2-debug-logsession' ], [ 'SESSION_SERVER_REQUEST' ] );

	// log the server environment
	LoggedHttpApp = LoggedHttpApp || require( './LoggedHttpApp' );
	LoggedHttpApp.logServerEnv( this.LogSession );
	// log req
	var reqLog = this.LogSession.openRecord( [ 'RECORD_SERVER_REQUEST', 'DATA_TEXT' ] );
	this._requestHook = new IncomingMessageLogger( req, reqLog );

	//todo: this causes a nasty loop on writing to the record
	// log res
	// var resLog = this.LogSession.openRecord( [ 'RECORD_SERVER_RESPONSE', 'DATA_TEXT' ] );
	// this._responseHook = new ServerResponseLogger( res, resLog );

	// defer all log streams - open them on the first write
	// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected to the current domain
	this.LogStreams = {
		Stdout: this.LogSession.openRecord( [ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ] ),
		Stderr: this.LogSession.openRecord( [ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ] ),
		Request: reqLog,
		// Response: resLog
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