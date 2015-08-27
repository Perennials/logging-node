"use strict";

var Events = require( 'events' );
var Fs = require( 'fs' );
var ILogEngine = require( './ILogEngine' );
var ILogSession = require( './ILogSession' );
var Path = require( 'path' );
var FileRecord = require( './FileRecord' );

function FileSession ( log, parentId, props, callback ) {

	ILogSession.call( this, log, parentId, props, callback );
	this._dir = log.getStorageUri();
	this._fileCount = 0;
	this._openRecords = [];
	this._loggedRecords = [];

	var _this = this;

	if ( props instanceof Function ) {
		callback = props;
		props = {};
	}

	props = ILogEngine.labelsToProps( props, ILogEngine.DefaultSessionProps );

	var fileName = FileSession.DirectoryFormat;

	this._makeSessionId( fileName, function ( err, id ) {

		// this will never happen. the logic loops until it succeeds
		if ( err ) {
			_this.emit( 'Session.Open.Error', err, _this );

			if ( callback instanceof Function ) {
				process.nextTick( function () {
					callback( err, _this );
				} );
			}
			return;
		}

		_this._dir += FileSession.DirectoryFormat.replace( '{LogSession}', id ) + Path.sep;
		_this._id = id;

		if ( !Object.isObject( props ) ) {
			props = {};
		}
		else {
			// dont ruin the original object
			props = {}.merge( props );
		}

		var meta = {
			Api: 'logging-node',
			ApiVersion: '0.9',
			LogSpecs: '0.9.2',
			LogSession: id,
			ParentSession: parentId,
			TimeStamp: (new Date()).toISOString()
		};

		props.merge( ILogEngine.labelsToProps( [ 'RECORD_META', 'DATA_JSON' ] ) );

		_this.write( meta, props, function ( err ) {

			_this.emit( 'Session.Opened', err, _this );

			if ( callback instanceof Function ) {
				process.nextTick( function () {
					callback( err, _this );
				} );
			}
		} );

	} );

}

FileSession.extend( ILogSession, {

	_makeSessionId: function ( fileName, callback, _num ) {
		if ( _num === undefined ) {
			_num = Date.now();
		}

		var id = _num.toString( 36 );
		var path = this._dir + fileName.replace( '{LogSession}', id );
		
		var _this = this;

		// try to create a dir with unique name
		Fs.mkdir( path, function( err, fd ) {
			if ( err ) {
				_this._makeSessionId( fileName, callback, _num + 1 );
			}
			else {
				process.nextTick( function () {
					callback( null, id )
				} );
			}
		} );
	},

	_makeRecordId: function ( props ) {
		var recordName = '';
		if ( String.isString( props.Name ) ) {
			recordName = '-' + props.Name;
		}
		if ( !String.isString( props.RecordType ) ) {
			props.RecordType = ILogEngine.RECORD_GENERIC.Value;
		}

		var fileName = (++this._fileCount) + '-' +
			props.RecordType + recordName + '.' +
			FileSession._dataTypeToFileExt( props.DataType );

		return fileName;
	},

	_getLastIdIndex: function () {
		return this._fileCount - 1;
	},

	getStorageUri: function () {
		return this._dir.slice( 0, -1 );
	},

	getLoggedRecords: function () {
		return this._loggedRecords;
	},

	close: function ( callback ) {
		var _this = this;
		
		this.wait( function () {
			
			var meta = {
				TimeStamp: (new Date()).toISOString()
			};

			var props = ILogEngine.labelsToProps( [ 'RECORD_META', 'DATA_JSON' ] );

			_this.write( meta, props, function ( err ) {

				_this.emit( 'Session.Closed', err, _this );

				if ( callback instanceof Function ) {
					process.nextTick( function () {
						callback( err, _this );
					} );
				}
			} );
		} );
	},

	getOpenRecords: function () {
		return this._openRecords;
	},

	openRecord: function ( props, callback ) {
		var _this = this;
		var record = new FileRecord( this, props, callback );
		this._openRecords.push( record );
		record.on( 'Record.Closed', function () {

			_this._loggedRecords[ record._getIndex() ] = record.getId();

			var records = _this._openRecords;
			var index = records.indexOf( record );
			if ( index >= 0 ) {
				records.splice( index, 1 );
			}
			if ( records.length === 0 ) {
				_this.emit( 'Session.Idle', _this );
			}
		} );
	},

	wait: function ( callback ) {
		if ( this._openRecords.length === 0 ) {
			process.nextTick( callback );
			return;
		}

		this.once( 'Session.Idle', callback );
	}

} ).implement( ILogSession );

FileSession.defineStatic( {

	DirectoryFormat: /*'LogSession_' +*/ '{LogSession}',

	_dataTypeToFileExt: function ( dataType, def ) {
		return FileSession._dataLabelToFileExt( 'DATA_' + dataType, def );
	},

	_dataLabelToFileExt: function ( dataLabel, def ) {

		if ( def === undefined ) {
			def = 'bin';
		}

		if ( dataLabel == 'DATA_XML' ) {
			return 'xml';
		}
		else if ( dataLabel == 'DATA_JSON' ) {
			return 'json';
		}
		else if ( dataLabel == 'DATA_TEXT' ) {
			return 'txt';
		}
		else if ( dataLabel == 'DATA_JPEG' ) {
			return 'jpg';
		}
		else if ( dataLabel == 'DATA_PNG' ) {
			return 'png';
		}
		else if ( dataLabel == 'DATA_HTML' ) {
			return 'html';
		}
		else if ( dataLabel == 'DATA_BINARY' ) {
			return 'bin';
		}
		
		return def;
	}

} );

module.exports = FileSession;