"use strict";

var Events = require( 'events' );

function ILogRecord ( session, props, callback ) {
	this._session = session;
}

ILogRecord.extend( Events.EventEmitter, {
	getSession: function () {
		return this._session;
	},

	getId: function () {},
	getUri: function () {},
	close: function ( callback ) {},
	wait: function ( callback ) {},
	write: function ( data, callback ) {}
} );

module.exports = ILogRecord;