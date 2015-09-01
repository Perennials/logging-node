"use strict";

var ILogEngine = require( './model/ILogEngine' );
var FileSession = require( './FileSession' );
var Fs = require( 'fs' );
var Os = require( 'os' );
var Path = require( 'path' );

function FileLog ( storageUri, callback ) {

	this._dir = null;
	this._openSessions = [];
	this._loggedSessions = [];

	var _this = this;

	if ( !String.isString( storageUri ) ) {
		storageUri = '';
	}

	// expand the path. if it doesn't exist use the temp dir
	Fs.stat( storageUri, function ( err, stats ) {
		if ( err || !stats.isDirectory() ) {
			_this._dir = Os.tmpdir();
			if ( !_this._dir.endsWith( Path.sep ) ) {
				_this._dir += Path.sep;
			}
			_this.emit( 'Log.Opened', err, _this );
			if ( callback instanceof Function ) {
				process.nextTick( function () {
					callback( err, _this );
				} );
			}
		}
		else {
			Fs.realpath( storageUri, function ( err, resolvedPath ) {
				if ( err ) {
					_this._dir = Os.tmpdir();
				}
				else {
					_this._dir = resolvedPath;
				}
				if ( !_this._dir.endsWith( Path.sep ) ) {
					_this._dir += Path.sep;
				}
				_this.emit( 'Log.Opened', err, _this );
				if ( callback instanceof Function ) {
					process.nextTick( function () {
						callback( err, _this );
					} );
				}
			} );
		}
	} );
}

// extend so we can use instanceof
FileLog.extend( ILogEngine, {

	getOpenSessions: function () {
		return this._openSessions;
	},

	getLoggedSessions: function () {
		return this._loggedSessions;
	},

	getStorageUri: function () {
		return this._dir;
	},

	openSession: function ( parentId, props, callback ) {
		var _this = this;
		var session = new FileSession( this, parentId, props, callback );
		this._openSessions.push( session );
		session.on( 'Session.Closed', function () {

			_this._loggedSessions.push( session.getId() );

			var sessions = _this._openSessions;
			var index = sessions.indexOf( session );
			if ( index >= 0 ) {
				sessions.splice( index, 1 );
			}
			if ( sessions.length === 0 ) {
				_this.emit( 'Log.Idle', _this );
			}
		} );
	},

	wait: function ( callback ) {
		if ( this._openSessions.length === 0 ) {
			process.nextTick( callback );
			return;
		}

		this.once( 'Log.Idle', callback );
	}


} ).implement( ILogEngine );

FileLog.defineStatic( {

	LogSessionClass: FileSession,

	Api: 'logging-node',
	ApiVersion: '0.9',
	LogSpecs: '0.9.4'

} );

module.exports = FileLog;