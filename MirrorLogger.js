"use strict";

var Http = require( 'http' );
var ILogEngine = require( './ILogEngine' );
var DeferredLogStream = require( './DeferredLogStream' );

// just a bunch of static functions
function MirrorLogger () {
}

MirrorLogger.defineStatic( {

	_nodeHttpRequest: Http.request.bind( Http ),

	_newHttpRequest: function ( options, callback ) {

		//todo: this should be in human readable format. means not compressed and not chunked
		//      i.e. need to hook the ServerResponse not the underlying socket

		var log = this;
		var LogRecord = options.LogRecord;
		delete options.LogRecord;
		var request = MirrorLogger._nodeHttpRequest( options, callback );

		if ( LogRecord === false ) {
			return request;
		}

		if ( !(LogRecord instanceof Object) ) {
			LogRecord = {};
		}


		LogRecord.RequestProps = ILogEngine.labelsToProps( LogRecord.RequestProps, { DataType: ILogEngine.RECORD_HTTP_REQUEST.Value } );
		console.log(LogRecord)

		// defer so we get buffering in case the log file is not open yet when we get first data in
		var requestLog = new DeferredLogStream( LogRecord );
		requestLog.assignLog( log );

		request.on( 'socket', function ( socket ) {

			socket.on( 'data', function ( chunk ) {
				requestLog.write( chunk );
			} );

			socket.on( 'end', function () {
				requestLog.end();
				requestLog.close();
			} );

		} );

		request.on( 'response', function ( response ) {
			
			LogRecord.ResponseProps = ILogEngine.labelsToProps( LogRecord.ResponseProps, { DataType: ILogEngine.RECORD_HTTP_RESPONSE.Value } );

			// defer so we get buffering in case the log file is not open yet when we get first data in
			var responseLog = new DeferredLogStream( LogRecord );
			responseLog.assignLog( log );

			MirrorLogger.mirrorIncomingMessage( response, responseLog );

			response.on( 'end', function () {
				responseLog.close();
			} )
		} );
	},
	
	_hookStreamCopierFn: function ( streamIn, streamOut, streamCallName ) {

		var originalCall = streamIn[ streamCallName ];
		var streamOutCall = streamOut[ streamCallName ];

		streamIn[ streamCallName ] = function () {

			// call the original .write() or .end()
			originalCall.apply( streamIn, arguments );
			
			// call the log .write() or .end()
			streamOutCall.apply( streamOut, arguments );

		};
	},

	hookNodeHttpModule: function ( log ) {
		node.request = MirrorLogger._newHttpRequest.bind( log );
	},

	unhookNodeHttpModule: function () {
		Http.request = MirrorLogger._nodeHttpRequest;
	},

	mirrorIncomingMessage: function ( streamIn, streamOut ) {

		// write the headers
		var headers = [ streamIn.method.toUpperCase() + ' ' + streamIn.url + ' HTTP/' + streamIn.httpVersion ];
		var rawHeaders = streamIn.rawHeaders;
		for ( var i = 0, iend = rawHeaders.length; i < iend; i += 2 ) {
			headers.push( rawHeaders[ i ] + ': ' + rawHeaders[ i + 1 ] );
		}
		headers.push( '\r\n' );
		streamOut.write( headers.join( '\r\n' ) );

		// mirror the incoming request
		streamIn.on( 'data', function ( chunk ) {
			streamOut.write( chunk );
		} );

		streamIn.on( 'end', function () {
			//todo: trailers are not logged
			streamOut.end();
		} );

	},

	mirrorServerResponse: function ( streamIn, streamOut ) {

		//todo: this should be in human readable format. means not compressed and not chunked
		//      i.e. need to hook the ServerResponse not the underlying socket
		MirrorLogger._hookStreamCopierFn( streamIn.connection, streamOut, 'write' );
		MirrorLogger._hookStreamCopierFn( streamIn.connection, streamOut, 'end' );
	}
} );

module.exports = MirrorLogger;