"use strict";

var Http = require( 'http' );
var Https = require( 'https' );
var ILogEngine = require( '../model/ILogEngine' );
var IncomingMessageLogger = require( './IncomingMessageLogger' );
var WritableLogger = require( './WritableLogger' );

var _nodeHttpRequest = Http.request.bind( Http );
var _nodeHttpsRequest = Https.request.bind( Https );
var _nodeClientRequestOnSocket = Http.ClientRequest.prototype.onSocket;
var _lastClientRq = null;

// this a bit global functionality
function HttpLogger ( appLogSession ) {
	this._appLogSession = appLogSession;

	Http.request = this._newHttpRequest.bind( this );
	Https.request = this._newHttpsRequest.bind( this );
	Http.ClientRequest.prototype.onSocket = this._onSocket;
}

HttpLogger.define( {

	//bp: depends on node internals. this is for node v4
	// make sure we got the socket before everyone else so we can intercept the headers
	_onSocket: function ( socket ) {

		if ( _lastClientRq !== null ) {
			// the end hook here is taking care to close() the record
			new WritableLogger( socket, _lastClientRq.LogSession.openRecord( _lastClientRq.LogRecord.RequestProps ) );
			_lastClientRq = null;
		}
		return _nodeClientRequestOnSocket.call( this, socket );
	},

	_newHttpRequest: function ( options, callback ) {
		return this._newRequest( options, callback, _nodeHttpRequest );
	},
	
	_newHttpsRequest: function ( options, callback ) {
		return this._newRequest( options, callback, _nodeHttpsRequest );
	},

	_newRequest: function ( options, callback, originalCall ) {

		//todo: this should be in human readable format. means not compressed and not chunked
		//      i.e. need to hook the ServerResponse not the underlying socket

		if ( _lastClientRq !== null ) {
			throw Error( 'Unexpected flow. Please file a bug.' );
		}

		var LogRecord = options.LogRecord;
		delete options.LogRecord;
		var logSession = null;

		if ( LogRecord !== false ) {
			
			if ( !(LogRecord instanceof Object) ) {
				LogRecord = {};
			}
			logSession = this._appLogSession;
			var domain = process.domain;
			if ( (domain = process.domain) ) {
				logSession = domain.HttpAppRequest.LogSession;
			}

			LogRecord.RequestProps = ILogEngine.labelsToProps( LogRecord.RequestProps, {
				RecordType: ILogEngine.RECORD_HTTP_REQUEST.Value,
				DataType: ILogEngine.DATA_TEXT.Value
			} );
			
			_lastClientRq = { LogRecord: LogRecord, LogSession: logSession };
		}

		var request = originalCall( options, callback );

		if ( LogRecord === false ) {
			return request;
		}

		request.on( 'response', function ( response ) {
			
			LogRecord.ResponseProps = ILogEngine.labelsToProps( LogRecord.ResponseProps, {
				RecordType: ILogEngine.RECORD_HTTP_RESPONSE.Value,
				DataType: ILogEngine.DATA_TEXT.Value
			} );

			// the end hook here is taking care to close() the record
			new IncomingMessageLogger( response, logSession.openRecord( LogRecord.ResponseProps ) );

		} );

		return request;
	},

	unhook: function () {
		Http.request = _nodeHttpRequest;
		Https.request = _nodeHttpsRequest;
		Http.ClientRequest.prototype.onSocket = _nodeClientRequestOnSocket;
	}
	
	
} );

module.exports = HttpLogger;