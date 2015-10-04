"use strict";

var Events = require( 'events' );
var ILogEngine = require( './ILogEngine' );

function ILogSession ( log, parentId, props, callback ) {
	this._log = log;
	this._id = null;
	this._index = null;
	this._parentId = parentId;
	this._props = props;
}

ILogSession.extend( Events.EventEmitter, {
	
	getLog: function () {
		return this._log;
	},

	getIndex: function () {
		return this._index;
	},

	getId: function () {
		return this._id;
	},

	getParentId: function () {
		return this._parentId;
	},

	getProps: function () {
		return this._props;
	},

	getStorageUri: function () {},
	close: function ( callback ) {},
	getOpenRecords: function () {},
	getLoggedRecords: function () {},
	openRecord: function ( props, callback ) {},
	setParentSession: function ( sessionId ) {},
	addLinkedToken ( token ) {},
	wait: function ( callback ) {},

	write: function ( data, props, callback ) {

		if ( props instanceof Function ) {
			callback = props;
			if ( data instanceof Error ) {
				props = [ 'RECORD_EXCEPTION', 'DATA_TEXT' ];
			}
			else {
				props = [ 'RECORD_GENERIC', String.isString( data ) ? 'DATA_TEXT' : 'DATA_JSON' ];
			}
		}

		props = ILogEngine.labelsToProps( props, ILogEngine.DefaultRecordProps );

		data = ILogEngine.normalizeData( data, props );

		this.openRecord( props, function ( err, record ) {
			if ( err ) {
				if ( callback instanceof Function ) {
					process.nextTick( callback, err, null );
				}
				return;
			}

			record.write( data, function ( err ) {

				record.close( function () {
					if ( callback instanceof Function ) {
						process.nextTick( callback, err, record );
					}
				} );
			} );
		} );
	}
} );

module.exports = ILogSession;