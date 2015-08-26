"use strict";

var BufferedStream = require( './BufferedStream' );

// this class will defer opening a log stream until the first write
// if it doesn't have an ILogEngine associated with it, it will buffer the writes
// all buffered content will be flushed once a log is assigned
function DeferredLogStream ( props, onFlush, onFirstWrite ) {
	this._props = props;
	this._onFlush = onFlush;
	this._onFirstWrite = onFirstWrite;
	this._log = null;
	this._stream = null;
}

DeferredLogStream.define( {

	write: function () {
		var stream = this._stream;
		if ( stream === null ) {
			stream = new BufferedStream();
			this._stream = stream;
			if ( this._onFirstWrite instanceof Function ) {
				this._onFirstWrite();
			}
			if ( this._log !== null ) {
				this._openLogStream();
				
			}
		}
		return stream.write.apply( stream, arguments );
	},

	end: function () {
		var stream = this._stream;
		return stream.end.apply( stream, arguments );
	},

	close: function () {
		this._stream = null;
	},

	assignLog: function ( log ) {
		this._log = log;
		// if we have a buffered stream, open a real log stream
		if ( this._stream !== null ) {
			this._openLogStream();
		}
	},

	_openLogStream: function () {
		var _this = this;
		this._log.openStream( this._props, function ( err, stream ) {
			if ( err ) {
				return;
			}
			// first time we open a real log stream, flush the buffer
			_this._stream.flush( stream );
			_this._stream = stream;

			if ( _this._onFlush instanceof Function ) {
				_this._onFlush( stream );
			}
		} );
	}
} );

module.exports = DeferredLogStream;