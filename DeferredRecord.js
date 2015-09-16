"use strict";

var ILogRecord = require( './model/ILogRecord' );
var CallBuffer = require( './CallBuffer' );
var ProxyEvents = require( './DeferredHelpers' ).ProxyEvents;

// this class will defer opening a log stream until the first write
// if it doesn't have an ILogSession associated with it, it will buffer the writes
// all buffered content will be flushed once a session is assigned
class DeferredRecord extends ILogRecord {
	
	constructor ( session, props, callback ) {

		super ( null, props, callback );

		this._record = null;
		this._buffer = null;
		this._queueClose = false;
		this._closed = false;
		this._openingSession = false;
		this._flushArbiter = DeferredRecord.flushArbiter;
		this._flushOnce = false;

		this.emit( 'Record.Opened', null, this );

		if ( callback instanceof Function ) {
			process.nextTick( callback, null, this );
		}
	}

	isFlushed () {
		return this._buffer === null || this._buffer.isFlushed();
	}

	//nothing is written yet
	isEmpty () {
		return this.isFlushed() && this._record === null;
	}

	getLogRecord () {
		return this._record;
	}

	getId () {
		var obj = this._record;
		if ( obj ) {
			return obj.getId();
		}
		return null;
	}
	
	getUri () {
		var obj = this._record;
		if ( obj ) {
			return obj.getUri();
		}
		return null;
	}

	write ( data, callback ) {
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
		if ( this._flushArbiter( this ) ) {
			this.flush();
			this.emit( 'Deferred.Open', this );
		}

		return ret;
	}

	close ( callback ) {

		if ( this._closed ) {
			if ( callback instanceof Function ) {
				process.nextTick( callback, null, this );
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
	}

	flush () {
		var session = this._session;
		if ( session !== null && session.getLogSession() !== null ) {
			this.assignSession( session );
		}
		else {
			this._flushOnce = true;
			this.emit( 'Deferred.Open', this );
		}
	}

	assignSession ( session ) {

		//todo: remove after testing
		if ( this._record ) {
			throw new Error( 'UNEXPECTED_FLOW' );
		}

		this._session = session;
		
		// if we have a buffered stream, open a real log stream
		if ( this.isFlushed() || (!this._flushOnce && !this._flushArbiter( this )) ) {
			return;
		}

		if ( this._openingSession ) {
			return;
		}

		this._flushOnce = false;
		this._openingSession = true;

		var _this = this;
		this._session.getLogSession().openRecord( this._props, function ( err, record ) {

			_this._openingSession = false;
			
			if ( err ) {
				// if this fails buffer will remain not null and record will be null and the next write() will lead to assignSession again
				return;
			}
			// first time we open a real log record, flush the buffer
			var buffer = _this._buffer;
			_this._buffer = null;
			_this._record = record;
			buffer.flush( record );

			ProxyEvents( [
				'Record.Closed',
				'Record.Idle'
			], record, _this );

			_this.emit( 'Deferred.Flush', err, _this );

		} );
	}

	wait ( callback ) {
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

	setFlushArbiter ( arbiter ) {
		this._flushArbiter = arbiter;
		return this;
	}

	static flushArbiter ( record ) {
		return true;
	}

}

DeferredRecord.implement( ILogRecord );

module.exports = DeferredRecord;