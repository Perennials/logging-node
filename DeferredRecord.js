"use strict";

var ILogRecord = require( './model/ILogRecord' );
var CallBuffer = require( './CallBuffer' );
var ProxyEvents = require( './DeferredHelpers' ).ProxyEvents;

// this class will defer opening a log stream until the first write
// if it doesn't have an ILogSession associated with it, it will buffer the writes
// all buffered content will be flushed once a session is assigned
function DeferredRecord ( session, props, callback ) {

	ILogRecord.call( this, session, props, callback );

	this._record = null;
	this._buffer = null;
	this._queueClose = false;
	this._closed = false;
	this._openingSession = false;

	if ( callback instanceof Function ) {
		var _this = this;
		process.nextTick( function () {
			callback( null, _this );
		} );
	}
}

DeferredRecord.extend( ILogRecord, {

	//nothing is written yet
	isEmpty: function () {
		return this._buffer === null && this._record === null;
	},

	getLogRecord: function () {
		return this._record;
	},

	getId: function () {
		var obj = this._record;
		if ( obj ) {
			return obj.getId();
		}
		return null;
	},
	
	getUri: function () {
		var obj = this._record;
		if ( obj ) {
			return obj.getUri();
		}
		return null;
	},

	write: function ( data, callback ) {
		var obj = this._record;
		if ( obj ) {
			return obj.write( data, callback );
		}

		var buffer = this._buffer;
		if ( buffer === null ) {
			buffer = new CallBuffer();
			this._buffer = buffer;
		}

		var ret = buffer.push( 'write', data, callback );
		var session = this._session;
		if ( session.getLogSession() !== null ) {
			this.assignSession( session );
		}
		this.emit( 'Deferred.Open', this );

		return ret;
	},

	close: function ( callback ) {

		if ( this._closed ) {
			if ( callback instanceof Function ) {
				process.nextTick( function () {
					callback( null, _this );
				} );
			}
			return;
		}

		// don't close before we have flushed
		if ( this._buffer ) {
			this._buffer.push( 'close', callback );
			return;
		}


		this._closed = true;
		var obj = this._record;
		var ret = null;
		if ( obj ) {
			ret = obj.close( callback );
		}
		else {
			this.emit( 'Record.Closed', null, this );
		}

		this._record = null;
		this._buffer = null;
		this._queueClose = false;
		return ret;
	},

	assignSession: function ( session ) {

		//todo: remove after testing
		if ( this._record ) {
			throw new Error( 'UNEXPECTED_FLOW' );
		}

		this._session = session;
		
		// if we have a buffered stream, open a real log stream
		if ( this._buffer === null ) {
			return;
		}

		if ( this._openingSession ) {
			return;
		}

		this._openingSession = true;

		var _this = this;
		this._session.openRecord( this._props, function ( err, record ) {

			_this._openingSession = false;
			
			if ( err ) {
				// if this fails buffer will remain not null and record will be null and the next write() will lead to assignSession again
				return;
			}
			// first time we open a real log record, flush the buffer
			_this._buffer.flush( record );
			_this._record = record;
			_this._buffer = null;

			ProxyEvents( [
				'Record.Opened',
				'Record.Open.Error',
				'Record.Closed',
				'Record.Idle'
			], record, _this );

			_this.emit( 'Deferred.Flush' );
			_this.emit( 'Record.Opened', err, _this );

		} );
	},

	wait: function ( callback ) {
		var obj = this._log;
		if ( obj ) {
			return obj.wait( callback );
		}
		else {
			if ( callback instanceof Function ) {
				process.nextTick( callback );
			}
		}
	}

} ).implement( ILogRecord );

module.exports = DeferredRecord;