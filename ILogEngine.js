"use strict";

require( 'Prototype' );

function ILogEngine () {

}

ILogEngine.define( {
	getLoggedRecords: function () {},
	getRecordsInProgress: function () {},
	getSessionId: function () {},
	startSession: function ( parentId, props, callback ) {},
	write: function ( data, props, callback ) {},
	openStream: function ( props, callback ) {},
	waitRecords: function ( callback ) {}
} );

ILogEngine.defineStatic( {
	
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

	DATA_JPEG: {
		Name: 'DataType',
		Value: 'JPEG'
	},

	DATA_PNG: {
		Name: 'DataType',
		Value: 'PNG'
	},

	RECORD_META: {
		Name: 'RecordType',
		Value: 'META'
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

	RECORD_PROGRAM_RESULT: {
		Name: 'RecordType',
		Value: 'PROGRAM_RESULT'
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
		else if ( contentType == 'image/jpeg' ) {
			return ILogEngine.DATA_JPEG.Value;
		}
		else if ( contentType == 'image/png' ) {
			return ILogEngine.DATA_PNG.Value;
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
	labelsToProps: function ( labels ) {
		var props = labels;
		if ( labels instanceof Array ) {
			props = {};
			for ( var i = labels.length - 1; i >= 0; --i ) {
				var prop = ILogEngine[ labels[ i ] ];
				if ( prop instanceof Object ) {
					props[ prop.Name ] = prop.Value;
				}
			}
		}
		return props;
	}
} );

module.exports = ILogEngine;