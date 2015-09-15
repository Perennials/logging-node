"use strict";

var ILogSession = require( './model/ILogSession' );
var DeferredRecord = require( './DeferredRecord' );
var ProxyEvents = require( './DeferredHelpers' ).ProxyEvents;

class DeferredSession extends ILogSession {

	constructor ( constructor, log, parentId, props, callback ) {

		super( log, parentId, props, callback );

		this._session = null;
		this._ctor = constructor;
		this._ctorParams = Array.prototype.slice.call( arguments, 1 );
		this._deferredRecords = [];
		this._tokens = [];
		this._openingSession = false;
		this._closed = false;

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
			
			var props = _this._ctorParams[ 2 ];
			if ( props instanceof Array ) {
				props = props.concat( { LinkedTokens: this._tokens } );
			}
			else if ( props instanceof Object ) {
				if ( props.LinkedTokens ) {
					props.LinkedTokens = props.LinkedTokens.concat( this._tokens );
				}
				else {
					props.LinkedTokens = this._tokens;
				}
			}
		}

		var _this = this;
		var session = Object.newArgs( _this._ctor, _this._ctorParams );
		session.on( 'Session.Opened', function ( err, session ) {

			if ( err ) {
				_this._openingSession = 0;
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
	}

	// open real session on first write and assign to all records
	_onRecordOpen ( record ) {
		if ( this._session || this._openingSession > 0 ) {
			return;
		}
		this._openingSession = 1;
		this._log.once( 'Log.Opened', this._onLogOpened.bind( this ) );
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

	getId () {
		return this._id;
	}

	getParentId () {
		return this._parentId;
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

	addLinkedToken ( token ) {
		if ( this._session ) {
			this._session.addLinkedToken( token );
		}
		else {
			this._tokens.push( token );
		}
		return this;
	}

	openRecord ( props, callback ) {
		var record = new DeferredRecord( this, props, callback );
		var _this = this;
		if ( this._session ) {
			record.on( 'Deferred.Open', function () {
				record.assignSession( _this );
				var records = _this._deferredRecords;
				records.splice( records.indexOf( record ) );
			} );
		}
		else {
			record.on( 'Deferred.Open', this._onRecordOpen.bind( this ) );
			this.once( 'Session.Opened', function ( err, session ) {
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
				process.nextTick( function () {
					callback( null, _this );
				} );
			}
			return;
		}

		if ( !this.isEmpty() ) {
			var _this = this;
			this.once( 'Session.Opened', function () {
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

}

DeferredSession.implement( ILogSession );

module.exports = DeferredSession;