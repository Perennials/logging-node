"use strict";

require( 'Prototype' );

var Events = require( 'events' );

function ILogEngine () {
}

ILogEngine.extend( Events.EventEmitter, {
	getOpenedSessions: function () {},
	getLoggedSessions: function () {},
	openSession: function ( props, callback ) {},
	wait: function ( callback ) {}
} );

ILogEngine.static( {
	
	// predefined "labels", i.e. key-value pairs
	DATA_BINARY: {
		Name: 'DataType',
		Value: 'BINARY'
	},
	
	DATA_JSON: {
		Name: 'DataType',
		Value: 'JSON'
	},
	
	DATA_XML: {
		Name: 'DataType',
		Value: 'XML'
	},

	DATA_TEXT: {
		Name: 'DataType',
		Value: 'TEXT'
	},

	DATA_HTML: {
		Name: 'DataType',
		Value: 'HTML'
	},

	RECORD_META: {
		Name: 'RecordType',
		Value: 'META'

	},

	RECORD_CLOSE: {
		Name: 'RecordType',
		Value: 'CLOSE'
	},

	RECORD_GENERIC: {
		Name: 'RecordType',
		Value: 'GENERIC'
	},

	RECORD_DEBUG: {
		Name: 'RecordType',
		Value: 'DEBUG'
	},

	RECORD_EXCEPTION: {
		Name: 'RecordType',
		Value: 'EXCEPTION'
	},

	RECORD_STREAM: {
		Name: 'RecordType',
		Value: 'STREAM'
	},

	RECORD_SERVER_REQUEST: {
		Name: 'RecordType',
		Value: 'SERVER_REQUEST'
	},

	RECORD_SERVER_ENV: {
		Name: 'RecordType',
		Value: 'SERVER_ENV'
	},

	RECORD_SERVER_RESPONSE: {
		Name: 'RecordType',
		Value: 'SERVER_RESPONSE'
	},

	RECORD_HTTP_REQUEST: {
		Name: 'RecordType',
		Value: 'HTTP_REQUEST'
	},

	RECORD_HTTP_RESPONSE: {
		Name: 'RecordType',
		Value: 'HTTP_RESPONSE'
	},

	SESSION_GENERIC: {
		Name: 'SessionType',
		Value: 'GENERIC'
	},

	SESSION_SERVER_REQUEST: {
		Name: 'SessionType',
		Value: 'SERVER_REQUEST'
	},

	SESSION_APP_RUN: {
		Name: 'SessionType',
		Value: 'APP_RUN'
	},
	
	// converts 'text/xml' to 'XML'
	mimeToDataType: function ( contentType, def ) {

		if ( def === undefined ) {
			def = ILogEngine.DATA_BINARY.Value;
		}

		//could be application/json; charset=UTF-8
		if ( String.isString( contentType ) && contentType.indexOf( ';' ) >= 0 ) {
			contentType = contentType.splitFirst( ';' ).left;
		}
		
		if ( contentType == 'application/json' ) {
			return ILogEngine.DATA_JSON.Value;
		}
		else if ( contentType == 'text/html' ) {
			return ILogEngine.DATA_HTML.Value;
		}
		else if ( contentType == 'text/xml' ) {
			return ILogEngine.DATA_XML.Value;
		}
		else if ( contentType == 'application/xml' ) {
			return ILogEngine.DATA_XML.Value;
		}
		else if ( contentType == 'text/plain' ) {
			return ILogEngine.DATA_TEXT.Value;
		}
		else if ( contentType == 'application/octet-stream' ) {
			return ILogEngine.DATA_BINARY.Value;
		}
		else if ( contentType == 'application/binary' ) {
			return ILogEngine.DATA_BINARY.Value;
		}
		
		return def;
	},

	// converts 'text/xml' to 'DATA_XML'
	mimeToDataLabel: function ( mime, def ) {
		var label = ILogEngine.mimeToDataType( mime, def );
		if ( String.isString( label ) ) {
			return 'DATA_' + label;
		}
		return null;
	},

	// converts 'DATA_XML' to DataType: 'XML'
	labelsToProps: function ( labels, defaults ) {
		var props = labels;
		if ( labels instanceof Array ) {
			props = {};
			for ( var i = labels.length - 1; i >= 0; --i ) {
				var label = labels[ i ];

				if ( label instanceof Object ) {
					props.merge( label );
					continue;
				}

				var prop = ILogEngine[ label ];
				if ( prop instanceof Object ) {
					props[ prop.Name ] = prop.Value;
				}
				else {
					props.Name = label;
				}
			}
		}

		if ( props === undefined || props === null ) {
			props = {};
		}

		if ( Object.isObject( props ) && defaults ) {

			for ( var key in defaults ) {
				if ( props[ key ] === undefined ) {
					props[ key ] = defaults[ key ];
				}
				
			}

		}

		if ( String.isString( props.Name ) ) {
			props.Name = props.Name.replace( /[^a-zA-Z0-9_]/g, '_' );
		}

		return props;
	},

	// normalize data for ILogRecord.write
	normalizeData: function ( data, props ) {
		// handle known data types
		if ( data instanceof Error &&
		     props.DataType == ILogEngine.DATA_TEXT.Value ) {
			
			data = data.stack;
		}
		else if ( data instanceof Object ) {
			if ( props.DataType == ILogEngine.DATA_JSON.Value ) {
				data = JSON.stringify( data );
			}
			else if (
			     props.DataType == ILogEngine.DATA_TEXT.Value ||
			     props.DataType == ILogEngine.DATA_BINARY.Value ) {
				
				if ( data.toString instanceof Function ) {
					data = data.toString();
				}
				else {
					data = Object.prototype.toString.call( data );
				}
			}
		}
		return data;
	}
} );

ILogEngine.static( {
	DefaultRecordProps: {
		RecordType: ILogEngine.RECORD_GENERIC.Value,
		DataType: ILogEngine.DATA_BINARY.Value
	},
	DefaultSessionProps: {
		SessionType: ILogEngine.SESSION_GENERIC.Value,
	}
} );

module.exports = ILogEngine;