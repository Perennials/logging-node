"use strict";

var WriteBuffer = require( './WriteBuffer' );

// this class will defer opening a log stream until the first write
// if it doesn't have an ILogSession associated with it, it will buffer the writes
// all buffered content will be flushed once a session is assigned
function DeferredRecord ( props, onFlush, onFirstWrite ) {
	this._props = props;
	this._onFlush = onFlush;
	this._onFirstWrite = onFirstWrite;
	this._session = null;
	this._record = null;
	this._queueClose = false;
}

DeferredRecord.define( {

	write: function () {
		var stream = this._record;
		if ( stream === null ) {
			stream = new WriteBuffer();
			this._record = stream;
			if ( this._onFirstWrite instanceof Function ) {
				this._onFirstWrite();
			}
			if ( this._session !== null ) {
				this._openRecord();
				
			}
		}
		return stream.write.apply( stream, arguments );
	},

	close: function () {
		// don't close before we have flushed

		var stream = this._record;

		if ( stream instanceof WriteBuffer  ) {
			this._queueClose = true;
			return;	
		}
		else if ( stream ) {
			stream.close();
		}
		this._record = null;
		this._queueClose = false;
	},

	assignSession: function ( session ) {
		this._session = session;
		// if we have a buffered stream, open a real log stream
		if ( this._record !== null ) {
			this._openRecord();
		}
	},

	_openRecord: function () {
		var _this = this;
		this._session.openRecord( this._props, function ( err, record ) {
			if ( err ) {
				return;
			}
			// first time we open a real log record, flush the buffer
			_this._record.flush( record );
			_this._record = record;

			if ( _this._onFlush instanceof Function ) {
				process.nextTick( function () {
					_this._onFlush( record );
				} );
			}

			if ( _this._queueClose ) {
				process.nextTick( function () {
					_this.close();
				} );
			}
		} );
	}
} );

module.exports = DeferredRecord;