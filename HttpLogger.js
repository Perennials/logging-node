"use strict";

var Http = require( 'http' );
var ILogEngine = require( './ILogEngine' );
var DeferredRecord = require( './DeferredRecord' );

// just a bunch of static functions
function HttpLogger () {

}

HttpLogger.defineStatic( {

	_nodeHttpRequest: Http.request.bind( Http ),

	_newHttpRequest: function ( options, callback ) {

		//todo: this should be in human readable format. means not compressed and not chunked
		//      i.e. need to hook the ServerResponse not the underlying socket

		var LogRecord = options.LogRecord;
		delete options.LogRecord;
		var request = HttpLogger._nodeHttpRequest( options, callback );

		if ( LogRecord === false ) {
			return request;
		}

		if ( !(LogRecord instanceof Object) ) {
			LogRecord = {};
		}


		LogRecord.RequestProps = ILogEngine.labelsToProps( LogRecord.RequestProps, { DataType: ILogEngine.RECORD_HTTP_REQUEST.Value } );
		console.log(LogRecord)

		// defer so we get buffering in case the log file is not open yet when we get first data in
		var requestLog = new DeferredRecord( LogRecord );

		//two cases: 1. we have a request context and the log should go there
		//              1.1 the session can still be in process of opening
		//           2. no request context, the log should go to the APP_RUN session
		//           	2.1 this session is opened on first write and this write can come from here
		//
		// in both cases there could be many deferred records which should be assigned a session once we have one
		
		//requestLog.assignSession( log );

		request.on( 'socket', function ( socket ) {

			socket.on( 'data', function ( chunk ) {
				requestLog.write( chunk );
			} );

			socket.on( 'end', function () {
				requestLog.close();
			} );

		} );

		request.on( 'response', function ( response ) {
			
			LogRecord.ResponseProps = ILogEngine.labelsToProps( LogRecord.ResponseProps, { DataType: ILogEngine.RECORD_HTTP_RESPONSE.Value } );

			// defer so we get buffering in case the log file is not open yet when we get first data in
			var responseLog = new DeferredRecord( LogRecord );
			// responseLog.assignLog( log );

			HttpLogger.mirrorIncomingMessage( response, responseLog );

			response.on( 'end', function () {
				responseLog.close();
			} )
		} );
	},

	hookNodeHttpModule: function () {
		node.request = HttpLogger._newHttpRequest;
	},

	unhookNodeHttpModule: function () {
		Http.request = HttpLogger._nodeHttpRequest;
	},
	
	
} );

module.exports = HttpLogger;