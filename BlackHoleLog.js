"use strict";

var ILogEngine = require( './ILogEngine' );

function BlackHoleLog ( callback ) {
	if ( callback instanceof Function ) {
		callback();
	}
}

// extend so we can use instanceof
BlackHoleLog.extend( ILogEngine, {
	startSession: function ( parentId, props, callback ) {
		if ( callback instanceof Function ) {
			callback( null );
		}
	},

	getSessionId: function () {
		return null;
	}
	
	getLoggedRecords: function () {
		return [];
	},

	getOpenRecords: function () {
		return [];
	},

	getOpenSteams: function () {
		return [];
	},
	
	write: function ( data, props, callback ) {
		if ( callback instanceof Function ) {
			callback( null );
		}
	},

	waitRecords: function ( callback ) {
		if ( callback instanceof Function ) {
			callback();
		}	
	}

} ).implement( ILogEngine );

module.exports = BlackHoleLog;