"use strict";

var Domain = require( 'domain' );
var Array_slice = Array.prototype.slice;


// a class that collects all its .write()s for later
class CallBuffer {
	
	constructor () {
		this._buffer = [];
	}

	isFlushed () {
		return this._buffer.length === 0;
	}

	push () {
		this._buffer.push( arguments[ 0 ], Array_slice.call( arguments, 1 ), process.domain );
	}

	unshift () {
		this._buffer.unshift( arguments[ 0 ], Array_slice.call( arguments, 1 ), process.domain );	
	}

	flush ( session ) {
		var buffer = this._buffer;
		var originalDomain = process.domain;
		// apply all writes
		for ( var i = 0, iend = buffer.length; i < iend; i += 3 ) {
			var domain = buffer[ i + 2 ];
			if ( domain && process.domain !== domain ) {
				domain.enter();
			}
			session[ buffer[ i ] ].apply( session, buffer[ i + 1 ] );
		}
		while ( process.domain && process.domain !== originalDomain ) {
			process.domain.exit();
		}
		this._buffer = [];
	}
}

module.exports = CallBuffer;