"use strict";

// a class that collects all its .write()s for later
function WriteBuffer () {
	this._buffer = [];
}

WriteBuffer.define( {

	write: function () {
		this._buffer.push( arguments );
	},

	flush: function ( session ) {
		var buffer = this._buffer;
		// apply all writes
		for ( var i = 0, iend = buffer.length; i < iend; ++i ) {
			session.write.apply( session, buffer[ i ] );
		}
		this._buffer = [];
	}
} );

module.exports = WriteBuffer;