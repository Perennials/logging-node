"use strict";

//NOT WORKING PROPERLY

var WritableLogger = require( './WritableLogger' );
var CallBuffer = require( '../CallBuffer' );

function ClientRequestLogger ( src, dest ) {

	this._buffer = new CallBuffer();

	var _this = this;
	src.on( 'socket', function ( socket ) {
		var buffer = _this._buffer;
		_this._buffer = null;
		
		//hack: depends on node's internal implementation
		//write the headers first
		var headers = [ socket._httpMessage.method.toUpperCase() + ' ' + socket._httpMessage.path + ' HTTP/1.1' ];
		var headerso = socket._httpMessage._headers;
		for ( var key in headerso ) {
			headers.push( key + ': ' + headerso[ key ] );
		}
		headers.push( '\r\n' );
		buffer.unshift( '_writeHook', headers.join( '\r\n' ) );
		buffer.flush( _this );
	} );
	
	WritableLogger.call( this, src, dest );
}

ClientRequestLogger.extend( WritableLogger, {

	_writeHook: function () {
		var buffer = this._buffer;
		if ( buffer ) {
			buffer.push.apply( buffer, [ '_writeHook' ].concat( Array.prototype.slice( arguments, 0 ) ) );
		}
		else {
			return WritableLogger.prototype._writeHook.apply( this, arguments );
		}
	},

	_endHook: function () {
		var buffer = this._buffer;
		if ( buffer ) {
			buffer.push.apply( buffer, [ '_endHook' ].concat( Array.prototype.slice( arguments, 0 ) ) );
		}
		else {
			return WritableLogger.prototype._endHook.apply( this, arguments );
		}

	}

} );

module.exports = ClientRequestLogger;