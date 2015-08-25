"use strict";

// a fake stream class that collects all its .write()s and .end() calls for later
function BufferedStream () {
	this._buffer = [];
	this._ended = false;
}

BufferedStream.define( {

	write: function () {
		this._buffer.push( arguments );
	},

	end: function () {
		this._ended = true;
		this._buffer.push( arguments );
	},

	flush: function ( stream ) {
		var buffer = this._buffer;
		var iend = buffer.length;
		if ( this._ended ) {
			--iend;
		}
		// apply all writes
		for ( var i = 0; i < iend; ++i ) {
			stream.write.apply( stream, buffer[ i ] );
		}
		// apply the end call
		if ( this._ended ) {
			stream.end.apply( stream, buffer[ iend ] );
		}

		this._buffer = [];
		this._ended = false;
	}
} );

module.exports = BufferedStream;