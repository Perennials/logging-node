"use strict";

// a class that collects all its .write()s for later
class CallBuffer {
	
	constructor () {
		this._buffer = [];
	}

	isFlushed () {
		return this._buffer.length === 0;
	}

	push () {
		this._buffer.push( arguments[ 0 ], Array.prototype.slice.call( arguments, 1 ) );
	}

	unshift () {
		this._buffer.unshift( arguments[ 0 ], Array.prototype.slice.call( arguments, 1 ) );	
	}

	flush ( session ) {
		var buffer = this._buffer;
		// apply all writes
		for ( var i = 0, iend = buffer.length; i < iend; i += 2 ) {
			session[ buffer[ i ] ].apply( session, buffer[ i + 1 ] );
		}
		this._buffer = [];
	}
}

module.exports = CallBuffer;