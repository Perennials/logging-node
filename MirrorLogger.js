"use strict";

var Http = require( 'http' );

// this will mirror one stream to another. works with http.IncomingMessage and http.ServerResponse
function MirrorLogger ( streamIn, streamOut ) {
}

function _hookStreamCopierFn ( streamIn, streamOut, streamCallName ) {

	var originalCall = streamIn[ streamCallName ];
	var streamOutCall = streamOut[ streamCallName ];

	streamIn[ streamCallName ] = function () {

		// call the original .write() or .end()
		originalCall.apply( streamIn, arguments );
		
		// call the log .write() or .end()
		streamOutCall.apply( streamOut, arguments );

	};
}

MirrorLogger.defineStatic( {

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
		_hookStreamCopierFn( streamIn.connection, streamOut, 'write' );
		_hookStreamCopierFn( streamIn.connection, streamOut, 'end' );
	}
} );

module.exports = MirrorLogger;