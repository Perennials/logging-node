"use strict";

//todo: this should be in human readable format. means not compressed and not chunked
//      i.e. need to hook the ServerResponse not the underlying socket

function ServerResponseLogger ( src, dest ) {
	this._src = src;
	this._dest = dest;
	this._srcWrite = src.write;
	this._srcEnd = src.end;
	src.write = this._writeHook.bind( this );
	src.end = this._endHook.bind( this );

}

ServerResponseLogger.define( {

	unhook: function () {
		this._src.write = this._srcWrite;
		this._src.end = this._srcEnd;
		this._src = null;
		this._dest = null;
	},

	_writeHook: function ( data, encoding, callback ) {

		var src = this._src;
		this._srcWrite.apply( src, arguments );
		this._dest.write( data );
	},

	_endHook: function ( data, encoding, callback ) {

		var src = this._src;
		this._srcEnd.apply( src, arguments );
		//bp: node's end will call write, so just close. if all ok close should happen after the write. britle code though
		this._dest.close();

	}

} );

module.exports = ServerResponseLogger;