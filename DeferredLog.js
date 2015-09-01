"use strict";

var ILogEngine = require( './model/ILogEngine' );
var DeferredSession = require( './DeferredSession' );
var ProxyEvents = require( './DeferredHelpers' ).ProxyEvents;

function DeferredLog ( constructor ) {
	this._log = null;
	this._ctor = constructor;
	this._ctorParams = Array.prototype.slice.call( arguments, 1 );
	this._deferredSessions = [];
}

DeferredLog.extend( ILogEngine, {

	_onSessionOpen: function ( session ) {
		var _this = this;
		var params = this._ctorParams;
		if ( params.length === 1 && params[ 0 ] instanceof Function ) {
			params = params[ 0 ]();
		}

		var log = Object.newArgs( this._ctor, params );
		log.once( 'Log.Opened', function ( err, log ) {
			ProxyEvents( [
				'Log.Opened',
				'Log.Open.Error',
				'Log.Closed',
				'Log.Idle'
			], log, _this );
			
			_this._log = log;

			_this.emit( 'Log.Opened', err, _this );

		} );
		
	},

	isEmpty: function () {
		//bp: if we have opened a real log assume we have written something it. not necessary the case though
		if ( this._log ) {
			return false;
		}
		else {
			var sessions = this._deferredSessions;
			for ( var i = sessions.length - 1; i >= 0; --i ) {
				if ( !sessions[ i ].isEmpty() ) {
					return false;
				}
			}
		}
		return true;
	},

	getLog: function () {
		return this._log;
	},

	getOpenedSessions: function () {
		var obj = this._log;
		if ( obj ) {
			return obj.getOpenedSessions();
		}
		return [];
	},

	getLoggedSessions: function () {
		var obj = this._log;
		if ( obj ) {
			return obj.getLoggedSessions();
		}
		return [];
	},

	openSession: function ( parentId, props, callback ) {
		var obj = this._log;
		if ( obj ) {
			return obj.openSession( parentId, props, callback );
		}
		else {
			var _this = this;
			var session = new DeferredSession( this._ctor.LogSessionClass, this, parentId, props, callback );
			session.on( 'Deferred.Open', this._onSessionOpen.bind( this ) );
			session.on( 'Session.Opened', function ( err, session ) {
				var sessions = _this._deferredSessions;
				sessions.splice( sessions.indexOf( session ), 1 );
			} );
			this._deferredSessions.push( session );
			return session;
		}
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

} ).implement( ILogEngine );

module.exports = DeferredLog;