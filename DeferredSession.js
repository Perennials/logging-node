"use strict";

var ILogSession = require( './ILogSession' );
var DeferredRecord = require( './DeferredRecord' );
var ProxyEvents = require( './DeferredHelpers' ).ProxyEvents;

function DeferredSession ( constructor, log, parentId, props, callback ) {

	ILogSession.call( this, log, parentId, props, callback );

	this._session = null;
	this._ctor = constructor;
	this._ctorParams = Array.prototype.slice.call( arguments, 1 );
	this._deferredRecords = [];
	this._openingSession = false;
	this._closed = false;

	log.on( 'Log.Opened', this._onLogOpened.bind( this ) );
}

DeferredSession.extend( ILogSession, {

	_onLogOpened: function ( log ) {
		if ( !this._openingSession ) {
			return;
		}
		
		var _this = this;
		var session = Object.newArgs( _this._ctor, _this._ctorParams )
		session.on( 'Session.Opened', function ( err, session ) {

			if ( err ) {
				_this._openingSession = false;
				return;
			}

			_this._session = session;

			ProxyEvents( [
				'Session.Opened',
				'Session.Open.Error',
				'Session.Closed',
				'Session.Idle'
			], session, _this );

			_this.emit( 'Session.Opened', err, _this )
		} );
	},

	// open real session on first write and assign to all records
	_onRecordOpen: function ( record ) {
		if ( this._session || this._openingSession ) {
			return;
		}
		this._openingSession = true;
		this.emit( 'Deferred.Open', this );
	},

	// nothing is written anywhere
	isEmpty: function () {
		var records = this._deferredRecords;
		if ( records.length === 0 ) {
			return true;
		}
		for ( var i = records.length - 1; i >= 0; --i ) {
			if ( !records[ i ].isEmpty() ) {
				return false;
			}
		}
		return true;
	},

	getLogSession: function () {
		return this._session;
	},

	getLog: function () {
		return this._log;
	},

	getId: function () {
		return this._id;
	},

	getParentId: function () {
		return this._parentId;
	},

	getStorageUri: function () {
		var obj = this._session;
		if ( obj ) {
			return obj.getStorageUri();
		}
		return null;
	},

	getOpenRecords: function () {
		var obj = this._session;
		if ( obj ) {
			return obj.getOpenRecords();
		}
		return [];
	},
	
	getLoggedRecords: function () {
		var obj = this._session;
		if ( obj ) {
			return obj.getLoggedRecords();
		}
		return [];
	},

	openRecord: function ( props, callback ) {
		if ( this._session ) {
			return this._session.openRecord( props, callback );
		}
		else {
			var record = new DeferredRecord( this, props, callback );
			var _this = this;
			record.on( 'Deferred.Open', this._onRecordOpen.bind( this ) );
			this.once( 'Session.Opened', function ( err, session ) {
				record.assignSession( session );
				var records = _this._deferredRecords;
				records.splice( records.indexOf( record ) );
			} )
			this._deferredRecords.push( record );
			return record;
		}	
	},

	close: function ( callback ) {
		var obj = this._session;
		if ( obj ) {
			return obj.close( callback );
		}

		if ( this._closed ) {
			if ( callback instanceof Function ) {
				process.nextTick( function () {
					callback( null, _this );
				} );
			}
			return;
		}

		if ( callback instanceof Function ) {
			if ( !this.isEmpty() ) {
				var _this = this;
				this.once( 'Session.Opened', function () {
					_this.close( callback );
				} );
			}
			else {
				this._closed = true;
				this.emit( 'Session.Closed', null, this );
				process.nextTick( callback );
			}
		}
		else {
			this._closed = true;
			this.emit( 'Session.Closed', null, this );
		}
	},

	wait: function ( callback ) {
		var obj = this._session;
		if ( obj ) {
			return obj.wait( callback );
		}
		else if ( callback instanceof Function ) {
			if ( !this.isEmpty() ) {
				this.once( 'Session.Idle', callback );
			}
			else {
				process.nextTick( callback );
			}
		}
	},

} ).implement( ILogSession );

module.exports = DeferredSession;