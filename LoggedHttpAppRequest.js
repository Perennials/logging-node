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
	this.LogSession = new WriteBuffer();

	function makeLogStreamCallback( logStreamName ) {
		return function ( stream ) {
			_this.LogStreams[ logStreamName ] = stream;
		};
	}

	// defer all log streams - open them on the first write
	// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected to the current domain
	this.LogStreams = {
		Stdout: new DeferredRecord( [ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ], makeLogStreamCallback( 'Stdout' ) ),
		Stderr: new DeferredRecord( [ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ], makeLogStreamCallback( 'Stderr' ) ),
		Request: new DeferredRecord( [ 'RECORD_SERVER_REQUEST', 'DATA_TEXT' ], makeLogStreamCallback( 'Request' ) ),
		Response: new DeferredRecord( [ 'RECORD_SERVER_RESPONSE', 'DATA_TEXT' ], makeLogStreamCallback( 'Response' ) )
	};
	

	function cancelLogging () {
		_this.LogSession = null;
		_this.LogStreams = {
			Stdout: null,
			Stderr: null,
			Request: null,
			Response: null
		};
		_this._requestHook.unhook();
		_this._requestResponse.unhook();
	}

	// open all log streams but don't make the request wait for us, defer and buffer
	this._log = new FileLog( app.getConfig().get( 'storage.log' ), function ( err, log ) {
		if ( err ) {
			cancelLogging();
			return;
		}

		log.openSession( req.headers[ 'freedom2-debug-logsession-parent' ], [ 'SESSION_SERVER_REQUEST' ], function ( err, session ) {
			if ( err ) {
				cancelLogging();
				return;
			}

			// flush the buffered writes
			_this.LogSession.flush( session );
			_this.LogSession = session;

			for ( var steamName in _this.LogStreams ) {
				_this.LogStreams[ steamName ].assignSession( session );
			}
		} );
	} );

	// log the server environment
	LoggedHttpApp = LoggedHttpApp || require( './LoggedHttpApp' );
	LoggedHttpApp.logServerEnv( this.LogSession );
	// log req
	this._requestHook = new IncomingMessageLogger( req, _this.LogStreams.Request );
	// log res
	this._responseHook = new ServerResponseLogger( res, _this.LogStreams.Response );

	HttpAppRequest.call( this, app, req, res );
	this.Domain.HttpAppRequest = this;

}

LoggedHttpAppRequest.extend( HttpAppRequest, {

	onError: function ( err ) {
		if ( this.LogSession ) {
			this.LogSession.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ] );
		}
		HttpAppRequest.prototype.onError.call( this, err );
	},

	dispose: function () {
		
		var _this = this;
		for ( var steamName in this.LogStreams ) {
			var stream = this.LogStreams[ steamName ];
			if ( stream !== null ) {
				stream.close( function () {
					_this.LogStreams[ steamName ] = null;
				} );
			}
		}

		if ( this.LogSession ) {
			this.LogSession.close();
		}

		HttpAppRequest.prototype.dispose.call( this );
	}

} );

module.exports = LoggedHttpAppRequest;