"use strict";

var Events = require( 'events' );
var ILogRecord = require( './ILogRecord' );
var ILogEngine = require( './ILogEngine' );
var Path = require( 'path' );
var Fs = require( 'fs' );

function FileRecord ( session, props, callback ) {
	ILogRecord.call( this, session, props, callback );

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
	
	var stream = Fs.createWriteStream( uri, { flags: 'w+' } );

	this._stream = stream;

	var _this = this;
	
	// if error occurs before open call the callback, otherwise remove this listener in the open handler
	// error event handler
	var errListener = function ( err ) {
		_this.emit( 'Record.Open.Error', err, _this );
		stream.removeListener( 'open', openListener );

		if ( callback instanceof Function ) {
			process.nextTick( function () {
				callback( err, _this );
			} );
		}
	};

	// open event handler
	var openListener = function ( fd ) {
		stream.removeListener( 'error', errListener );

		_this.emit( 'Record.Opened', _this );

		if ( callback instanceof Function ) {
			process.nextTick( function () {
				callback( null, _this );
			} );
		}
	};

	stream.once( 'error', errListener );
	stream.once( 'open', openListener );
}

FileRecord.extend( ILogRecord, {
	_getIndex: function () {
		return this._index;
	},
	
	getId: function () {
		return this._id;
	},
	
	getUri: function () {
		return this._uri;
	},

	
	close: function ( callback ) {

		var _this = this;
		this.wait( function () {

			_this._stream.end();
			_this._stream.close( function () {
				
				_this.emit( 'Record.Closed', _this );
				if ( callback instanceof Function ) {
					process.nextTick( callback );
				}
			} );
		
		} );


	},
	
	write: function ( data, callback ) {
		var _this = this;
		++this._pendingWrites;
		this._stream.write( data, function ( err ) {
			if ( --_this._pendingWrites === 0 ) {
				_this.emit( 'Record.Idle', _this );
			}
			if ( callback instanceof Function ) {
				process.nextTick( function () {
					callback( err );
				} );
			}
		} );
	},

	wait: function ( callback ) {
		if ( this._pendingWrites === 0 ) {
			process.nextTick( callback );
			return;
		}

		this.once( 'Record.Idle', callback );
	},

} ).implement( ILogRecord );

module.exports = FileRecord;