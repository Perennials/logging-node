"use strict";

var Unchunker = require( './Unchunker' );

class WritableLogger {

	constructor ( src, dest, unchunk ) {
		if ( 0 && unchunk ) {
			dest = new Unchunker( dest );
		}
		this._src = src;
		this._dest = dest;
		this._srcWrite = src.write;
		this._srcEnd = src.end;
		src.write = this._writeHook.bind( this );
		src.end = this._endHook.bind( this );
		src.on( 'close', function () {
			dest.close();
		} );
	}

	unhook () {
		this._src.write = this._srcWrite;
		this._src.end = this._srcEnd;
		this._src = null;
		this._dest = null;
	}

	_writeHook ( data, encoding, callback ) {
		var src = this._src;
		this._srcWrite.apply( src, arguments );
		this._dest.write( data );
	}

	_endHook ( data, encoding, callback ) {

		var src = this._src;
		this._srcEnd.apply( src, arguments );
		//bp: node's end will call write, so just close. if all ok close should happen after the write. britle code though
		this._dest.close();

	}

}

module.exports = WritableLogger;
