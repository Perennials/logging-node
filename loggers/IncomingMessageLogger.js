"use strict";

function IncomingMessageLogger ( src, dest ) {
	this._src = src;
	this._dest = dest;

	// write the headers
	var headers = null;
	if ( src.method ) {
		headers = [ src.method.toUpperCase() + ' ' + src.url + ' HTTP/' + src.httpVersion ];;	
	}
	else {
		headers = [ 'HTTP/' + src.httpVersion + ' ' + src.statusCode + ' ' + src.statusMessage ];
	}
	var rawHeaders = src.rawHeaders;
	for ( var i = 0, iend = rawHeaders.length; i < iend; i += 2 ) {
		headers.push( rawHeaders[ i ] + ': ' + rawHeaders[ i + 1 ] );
	}
	headers.push( '\r\n' );
	dest.write( headers.join( '\r\n' ) );

	this._onSrcData = function ( chunk ) {
		dest.write( chunk );
	};

	this._onSrcEnd = function () {
		//todo: trailers are not logged
		dest.close();
	};

	// mirror the incoming request
	src.on( 'data', this._onSrcData );
	src.on( 'end', this._onSrcEnd );

}

IncomingMessageLogger.define( {

	unhook: function () {
		this._src.removeListener( 'data', this._onSrcData );
		this._src.removeListener( 'end', this._onEndData );
		this._src = null;
		this._dest = null;
	}

} );

module.exports = IncomingMessageLogger;