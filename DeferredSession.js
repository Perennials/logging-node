"use strict";

var ILogSession = require( './model/ILogSession' );
var DeferredRecord = require( './DeferredRecord' );
var ProxyEvents = require( './DeferredHelpers' ).ProxyEvents;
var Helpers = require( './Helpers' );

class DeferredSession extends ILogSession {

	constructor ( constructor, log, parentId, props, callback ) {

		if ( Object.isObject( parentId ) || parentId instanceof Array ) {
			callback = props;
			props = parentId;
			parentId = null;
		}

		else if ( props instanceof Function ) {
			callback = props;
			props = {};
		}

		else if ( parentId instanceof Function ) {
			callback = parentId;
			props = {};
			parentId = null;
		}

		super( log, parentId, props, callback );

		this.setMaxListeners( 0 );

		this._session = null;
		this._ctor = constructor;
		this._ctorLog = log;
		this._ctorParentId = parentId;
		this._ctorProps = props;
		this._ctorCallback = callback;
		this._deferredRecords = [];
		this._tokens = [];
		this._userData = {};
		this._openingSession = false;
		this._closed = false;
		this._flushArbiter = null;

		this.emit( 'Session.Opened', null, this );

		if ( callback instanceof Function ) {
			process.nextTick( callback, null, this );
		}

	}

	assignLog ( log ) {
		return this._onLogOpened( log );
	}

	_onLogOpened ( log ) {
		if ( this._openingSession !== 1 ) {
			return;
		}
		this._openingSession = 2;

		if ( this._tokens.length > 0 ) {
			Helpers.addSessionPropRaw( this._ctorProps, 'LinkedTokens', this._tokens, true );
		}
		if ( Object.keys( this._userData ).length > 0 ) {
			Helpers.addSessionPropRaw( this._ctorProps, 'UserData', this._userData, true );
		}

		var _this = this;
		var ctor = _this._ctor;
		var session = new ctor( this._ctorLog, this._ctorParentId, this._ctorProps, this._ctorCallback );
		session.on( 'Session.Opened', function ( err, session ) {

			if ( err ) {
				_this._openingSession = 0;
				return;
			}

			_this._session = session;

			ProxyEvents( [
				'Session.Closed',
				'Session.Idle'
			], session, _this );

			_this.emit( 'Deferred.Flush', err, _this )
		} );
	}

	// open real session on first write and assign to all records
	_onRecordNeedsOpen ( record ) {
		if ( this._session || this._openingSession > 0 ) {
			return;
		}
		this._openingSession = 1;
		this._log.once( 'Deferred.Flush', this._onLogOpened.bind( this ) );
		this.emit( 'Deferred.Open', this );
	}

	// nothing is written anywhere
	isEmpty () {
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
	}

	getLogSession () {
		return this._session;
	}

	getLog () {
		return this._log;
	}

	getMeta () {
		var obj = this._session;
		if ( obj ) {
			return obj.getMeta();
		}
		return null;
	}

	getId () {
		var obj = this._session;
		if ( obj ) {
			return obj.getId();
		}
		return null;
	}

	getIndex () {
		var obj = this._session;
		if ( obj ) {
			return obj.getIndex();
		}
		return null;
	}

	getParentId () {
		var obj = this._session;
		if ( obj ) {
			return obj.getParentId();
		}
		return null;
	}

	getStorageUri () {
		var obj = this._session;
		if ( obj ) {
			return obj.getStorageUri();
		}
		return null;
	}

	getOpenRecords () {
		var obj = this._session;
		if ( obj ) {
			return obj.getOpenRecords();
		}
		return [];
	}
	
	getLoggedRecords () {
		var obj = this._session;
		if ( obj ) {
			return obj.getLoggedRecords();
		}
		return [];
	}

	setParentSession ( sesionId ) {
		if ( this._session ) {
			this._session.setParentSession( sesionId );
		}
		else {
			this._ctorParentId = sesionId;
		}
		return this;
	}

	addLinkedToken ( token ) {
		if ( this._session ) {
			this._session.addLinkedToken( token );
		}
		else {
			this._tokens.push( token );
		}
		return this;
	}

	setUserData ( key, value ) {
		if ( this._session ) {
			this._session.setUserData( key, value );
		}
		else {
			if ( key instanceof Object ) {
				this._userData.merge( key );
			}
			else {
				this._userData[ key ] = value;
			}
		}
	}

	openRecord ( props, callback ) {
		var record = new DeferredRecord( this, props, callback );
		if ( this._flushArbiter ) {
			record.setFlushArbiter( this._flushArbiter );
		}
		var _this = this;
		if ( this._session ) {
			record.on( 'Deferred.Open', function () {
				record.assignSession( _this );
				var records = _this._deferredRecords;
				records.splice( records.indexOf( record ) );
			} );
		}
		else {
			record.on( 'Deferred.Open', this._onRecordNeedsOpen.bind( this ) );
			this.once( 'Deferred.Flush', function ( err, session ) {
				record.assignSession( session );
				var records = _this._deferredRecords;
				records.splice( records.indexOf( record ) );
			} );
		}
		this._deferredRecords.push( record );
		return record;
	}

	close ( callback ) {
		var obj = this._session;
		if ( obj ) {
			return obj.close( callback );
		}

		if ( this._closed ) {
			if ( callback instanceof Function ) {
				process.nextTick( callback, null, this );
			}
			return;
		}

		if ( !this.isEmpty() ) {
			var _this = this;
			this.once( 'Deferred.Flush', function () {
				_this.close( callback );
			} );
		}
		else {
			this._closed = true;
			this.emit( 'Session.Closed', null, this );
			if ( callback instanceof Function ) {
				process.nextTick( callback );
			}
		}
	}

	wait ( callback ) {
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
	}

	setFlushArbiter ( arbiter ) {
		this._flushArbiter = arbiter;
		return this;
	}

	flushDeferredLogs () {
		var logs = this._deferredRecords;
		for ( var i = logs.length - 1; i >= 0; --i ) {
			var log = logs[ i ];
			if ( !log.isFlushed() ) {
				log.flush();
			}
		}
	}

}

DeferredSession.implement( ILogSession );

module.exports = DeferredSession;
