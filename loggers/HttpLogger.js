"use strict";

var Http = require( 'http' );
var ILogEngine = require( '../model/ILogEngine' );
var IncomingMessageLogger = require( './IncomingMessageLogger' );
var WritableLogger = require( './WritableLogger' );

var _nodeHttpRequest = Http.request.bind( Http );

// this a bit global functionality
function HttpLogger ( appLogSession ) {
	this._appLogSession = appLogSession;

	Http.request = this._newHttpRequest.bind( this );
}

HttpLogger.define( {

	_newHttpRequest: function ( options, callback ) {

		//todo: this should be in human readable format. means not compressed and not chunked
		//      i.e. need to hook the ServerResponse not the underlying socket

		var LogRecord = options.LogRecord;
		delete options.LogRecord;
		var request = _nodeHttpRequest( options, callback );

		if ( LogRecord === false ) {
			return request;
		}

		if ( !(LogRecord instanceof Object) ) {
			LogRecord = {};
		}

		var logSession = this._appLogSession;
		var domain = process.domain;
		if ( (domain = process.domain) ) {
			logSession = domain.HttpAppRequest.LogSession;
		}


		LogRecord.RequestProps = ILogEngine.labelsToProps( LogRecord.RequestProps, {
			RecordType: ILogEngine.RECORD_HTTP_REQUEST.Value,
			DataType: ILogEngine.DATA_TEXT.Value
		} );

		// the end hook here is taking care to close() the record
		new WritableLogger( request, logSession.openRecord( LogRecord.RequestProps ) );

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
	}
	
	
} );

module.exports = HttpLogger;