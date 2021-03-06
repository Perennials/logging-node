"use strict";

var Events = require( 'events' );
var ILogRecord = require( './model/ILogRecord' );
var ILogEngine = require( './model/ILogEngine' );
var Path = require( 'path' );
var Fs = require( 'fs' );
var CallBuffer = require( './CallBuffer' );

class FileRecord extends ILogRecord {

	constructor ( session, props, callback ) {
		super( session, props, callback );

		if ( props instanceof Function ) {
			callback = props;
			props = [ 'RECORD_STREAM', 'DATA_TEXT' ];
		}

		props = ILogEngine.labelsToProps( props, ILogEngine.DefaultRecordProps );

		var session = this.getSession();
		var fileName = session._makeRecordId( props );
		var uri = session.getStorageUri() + Path.sep + fileName;
		var index = session._getLastIdIndex();
		
		this._id = fileName;
		this._uri = uri;
		this._index = index;
		this._pendingWrites = 0;
		this._buffer = new CallBuffer();
		
		var stream = Fs.createWriteStream( uri, { flags: 'w+' } );

		this._stream = stream;

		var _this = this;
		
		// if error occurs before open call the callback, otherwise remove this listener in the open handler
		// error event handler
		var errListener = function ( err ) {

			_this.emit( 'Record.Open.Error', err, _this );
			stream.removeListener( 'open', openListener );

			if ( callback instanceof Function ) {
				process.nextTick( callback, err, _this );
			}

			_this._buffer = null;
		};

		// open event handler
		var openListener = function ( fd ) {
			stream.removeListener( 'error', errListener );

			_this.emit( 'Record.Opened', _this );

			if ( callback instanceof Function ) {
				process.nextTick( callback, null, _this );
			}

			var buffer = _this._buffer;
			_this._buffer = null;
			buffer.flush( _this );
		};

		stream.once( 'error', errListener );
		stream.once( 'open', openListener );
	}

	_getIndex () {
		return this._index;
	}

	isIdle () {
		return this._pendingWrites === 0 && this._buffer === null;
	}
	
	getId () {
		return this._id;
	}
	
	getUri () {
		return this._uri;
	}

	
	close ( callback ) {

		if ( this._buffer ) {
			this._buffer.push( 'close', callback );
			return;
		}

		var _this = this;
		this.wait( function () {

			_this._stream.end();
			_this._stream.close( function ( err ) {
				
				_this.emit( 'Record.Closed', err, _this );
				if ( callback instanceof Function ) {
					process.nextTick( callback, err, _this );
				}
			} );
		
		} );


	}
	
	write ( data, callback ) {

		if ( this._buffer ) {
			this._buffer.push( 'write', data, callback );
			return;
		}

		var _this = this;
		++this._pendingWrites;
		this._stream.write( data, function ( err ) {
			if ( --_this._pendingWrites === 0 ) {
				_this.emit( 'Record.Idle', _this );
			}
			if ( callback instanceof Function ) {
				process.nextTick( callback, err, _this );
			}
		} );
	}

	wait ( callback ) {
		if ( this.isIdle() ) {
			process.nextTick( callback );
			return;
		}

		this.once( 'Record.Idle', callback );
	}

}

FileRecord.implement( ILogRecord );

module.exports = FileRecord;