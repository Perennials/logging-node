"use strict";

var Events = require( 'events' );
var ILogEngine = require( './ILogEngine' );

function ILogRecord ( session, props, callback ) {
	this._session = session;
	this._props = ILogEngine.labelsToProps( props, ILogEngine.DefaultRecordProps );
}

ILogRecord.extend( Events.EventEmitter, {
	getSession: function () {
		return this._session;
	},

	getProps: function () {
		return this._props;
	},

	getId: function () {},
	getUri: function () {},
	close: function ( callback ) {},
	wait: function ( callback ) {},
	write: function ( data, callback ) {},
	setFlushArbiter: function ( arbiter ) {}
} );

module.exports = ILogRecord;