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
var _rqId = 0;

// this a bit global functionality
function HttpLogger ( app, unchunk ) {
	this._app = app;
	this._unchunk = unchunk;

	Http.request = this._newHttpRequest.bind( this );
	Https.request = this._newHttpsRequest.bind( this );
	Http.ClientRequest.prototype.onSocket = this._onSocket;
}

HttpLogger.define( {

	//bp: depends on node internals. this is for node v4
	// make sure we got the socket before everyone else so we can intercept the headers
	_onSocket: function ( socket ) {

		// no way to assign the logsession to the socket via http.request() before any writes happen, so use globals
		// this will be called before http.request() returns
		if ( _lastClientRq !== null ) {
			_lastClientRq.LogSession.emit( 'Http.Request.Start', this, _lastClientRq.LogRecord.RequestProps );

			// the end hook here is taking care to close() the record
			new WritableLogger( socket, _lastClientRq.LogSession.openRecord( _lastClientRq.LogRecord.RequestProps ), _lastClientRq.UnchunkHttp );
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
		var unchunk = null;
		var logSession = null;
		var reqId = (++_rqId).toString();

		if ( LogRecord !== false ) {
			
			if ( !(LogRecord instanceof Object) ) {
				LogRecord = {};
			}
			unchunk = LogRecord.UnchunkHttp;
			logSession = this._app.getLogSession();
			if ( unchunk === undefined ) {
				unchunk = this._app.getInitOptions().UnchunkHttp;
			}
			
			var domain = process.domain;
			if ( (domain = process.domain) ) {
				logSession = domain.HttpAppRequest.getLogSession();
				if ( unchunk === undefined ) {
					unchunk = domain.HttpAppRequest.getInitOptions().UnchunkHttp;
				}
			}


			LogRecord.RequestProps = ILogEngine.labelsToProps( LogRecord.RequestProps, {
				RecordType: ILogEngine.RECORD_HTTP_REQUEST.Value,
				DataType: ILogEngine.DATA_TEXT.Value,
				Name: reqId
			} );
			
			_lastClientRq = { LogRecord: LogRecord, LogSession: logSession, UnchunkHttp: unchunk };
		}

		var request = originalCall( options, callback );

		if ( LogRecord === false ) {
			return request;
		}

		request.on( 'response', function ( response ) {


			LogRecord.ResponseProps = ILogEngine.labelsToProps( LogRecord.ResponseProps, {
				RecordType: ILogEngine.RECORD_HTTP_RESPONSE.Value,
				DataType: ILogEngine.DATA_TEXT.Value,
				Name: reqId
			} );
			
			logSession.emit( 'Http.Response.Start', request, LogRecord.RequestProps, response, LogRecord.ResponseProps );
			
			let fonce = false;
			let once = function () {
				if ( fonce ) {
					return;
				}
				fonce = true;
				logSession.emit( 'Http.Response.End', request, LogRecord.RequestProps, response, LogRecord.ResponseProps );
			}

			request.on( 'error', function ( err ) {
				logSession.emit( 'Http.Response.Error', request, LogRecord.RequestProps, response, LogRecord.ResponseProps, err );
			} );
			response.on( 'end', once );
			response.on( 'close', once );

			// the end hook here is taking care to close() the record
			new IncomingMessageLogger( response, logSession.openRecord( LogRecord.ResponseProps ), unchunk );

		} );

		let fonce = false;
		let once = function () {
			if ( fonce ) {
				return;
			}
			fonce = true;
			logSession.emit( 'Http.Request.End', request, LogRecord.RequestProps );
		}

		request.on( 'error', function ( err ) {
			logSession.emit( 'Http.Request.Error', request, LogRecord.RequestProps, err );
		} );
		request.on( 'finish', once );
		request.on( 'close', once );

		return request;
	},

	unhook: function () {
		Http.request = _nodeHttpRequest;
		Https.request = _nodeHttpsRequest;
		Http.ClientRequest.prototype.onSocket = _nodeClientRequestOnSocket;
	}
	
	
} );

module.exports = HttpLogger;
