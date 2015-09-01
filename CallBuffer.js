"use strict";

// a class that collects all its .write()s for later
function CallBuffer () {
	this._buffer = [];
}

CallBuffer.define( {

	push: function () {
		this._buffer.push( arguments[ 0 ], Array.prototype.slice.call( arguments, 1 ) );
	},

	unshift: function () {
		this._buffer.unshift( arguments[ 0 ], Array.prototype.slice.call( arguments, 1 ) );	
	},

	flush: function ( session ) {
		var buffer = this._buffer;
		// apply all writes
		for ( var i = 0, iend = buffer.length; i < iend; i += 2 ) {
			session[ buffer[ i ] ].apply( session, buffer[ i + 1 ] );
		}
		this._buffer = [];
	}
} );

module.exports = CallBuffer;