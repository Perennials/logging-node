"use strict";

var Events = require( 'events' );
var ILogEngine = require( './ILogEngine' );
var LinkedToken = require( '../LinkedToken' );

function ILogSession ( log, props, callback ) {
	this._log = log;
	this._id = null;
	this._index = null;
	this._props = props;
	this._meta = null;
}

ILogSession.extend( Events.EventEmitter, {

	getMeta: function () {
		return this._meta;
	},
	
	getLog: function () {
		return this._log;
	},

	getIndex: function () {
		return this._index;
	},

	getId: function () {
		return this._id;
	},

	getLinkedToken: function ( type, relation ) {
		if ( !this._meta ) {
			return null;
		}
		
		var ret = [];
		for ( var token of this._meta.LinkedTokens ) {
			if ( token instanceof LinkedToken && (!type || token.getType() == type) && (!relation || token.getRelation() == relation) ) {
				ret.push( token );
			}
		}
		if ( ret.length > 0 ) {
			return ret;
		}
		return null;
	},

	getProps: function () {
		return this._props;
	},

	getStorageUri: function () {},
	close: function ( callback ) {},
	getOpenRecords: function () {},
	getLoggedRecords: function () {},
	openRecord: function ( props, callback ) {},
	addLinkedToken ( token ) {},
	wait: function ( callback ) {},

	write: function ( data, props, callback ) {

		if ( props instanceof Function ) {
			callback = props;
			props = undefined;
		}

		if ( props === undefined ) {
			if ( data instanceof Error ) {
				props = [ 'RECORD_EXCEPTION', 'DATA_TEXT' ];
			}
			else {
				props = [ 'RECORD_GENERIC', String.isString( data ) ? 'DATA_TEXT' : data instanceof Buffer ? 'DATA_BINARY' : 'DATA_JSON' ];
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