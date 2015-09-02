"use strict";

var Events = require( 'events' );
var Fs = require( 'fs' );
var ILogEngine = require( './model/ILogEngine' );
var ILogSession = require( './model/ILogSession' );
var Path = require( 'path' );
var FileRecord = require( './FileRecord' );
var DeferredLog = require( './DeferredLog' );
var FileLog = null;

function FileSession ( log, parentId, props, callback ) {

	ILogSession.call( this, log, parentId, props, callback );
	this._dir = ( log instanceof DeferredLog ? log.getLog().getStorageUri() : log.getStorageUri() );
	this._fileCount = 0;
	this._openRecords = [];
	this._loggedRecords = [];
	this._closed = false;

	var _this = this;

	if ( props instanceof Function ) {
		callback = props;
		props = {};
	}

	props = ILogEngine.labelsToProps( props, ILogEngine.DefaultSessionProps );

	var fileName = FileSession.DirectoryFormat;
	var sessionName = '';
	if ( !Object.isObject( props ) ) {
		props = {};
	}
	else {
		// dont ruin the original object
		props = {}.merge( props );
	}
	props.merge( ILogEngine.labelsToProps( [ 'RECORD_META', 'DATA_JSON' ] ) );
	if ( props.Name !== undefined ) {
		sessionName = '-' + props.Name;
		delete props.Name;
	}

	this._makeSessionId( fileName, sessionName, function ( err, id, dirName ) {

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

		_this._dir += dirName + Path.sep;
		_this._id = id;

		// dependencies, ah
		FileLog = FileLog || require( './FileLog' );

		var meta = {
			Api: FileLog.Api,
			ApiVersion: FileLog.ApiVersion,
			LogSpecs: FileLog.LogSpecs,
			LogSession: id,
			ParentSession: parentId,
			TimeStamp: (new Date()).toISOString()
		};

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

	_makeSessionId: function ( fileName, sessionName, callback, _num ) {
		if ( _num === undefined ) {
			_num = Date.now();
		}

		var id = _num.toString( 36 );
		var dirName = fileName.replace( '{LogSession}', id ).replace( '{SessionName}', sessionName );
		var path = this._dir + dirName;
		
		var _this = this;

		// try to create a dir with unique name
		Fs.mkdir( path, function( err, fd ) {
			if ( err ) {
				_this._makeSessionId( fileName, sessionName, callback, _num + 1 );
			}
			else {
				process.nextTick( function () {
					callback( null, id, dirName )
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

	isIdle: function () {
		var records = this._openRecords;
		if ( records.length === 0 ) {
			return true;
		}
		for ( var i = records.length - 1; i >= 0; --i ) {
			if ( !records[ i ].isIdle() ) {
				return false;
			}
		}
		return true;
	},

	getStorageUri: function () {
		return this._dir.slice( 0, -1 );
	},

	getLoggedRecords: function () {
		return this._loggedRecords;
	},

	close: function ( callback ) {
		var _this = this;
		if ( this._closed ) {
			if ( callback instanceof Function ) {
				process.nextTick( function () {
					callback( null, _this );
				} );
			}	
			return;
		}
		
		this.wait( function () {
			
			var meta = {
				TimeStamp: (new Date()).toISOString()
			};

			var props = ILogEngine.labelsToProps( [ 'RECORD_CLOSE', 'DATA_JSON' ] );

			_this.write( meta, props, function ( err ) {

				_this._closed = true;

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
		record.on( 'Record.Closed', function ( err, record ) {

			_this._loggedRecords[ record._getIndex() ] = record.getId();

			var records = _this._openRecords;
			records.splice( records.indexOf( record ), 1 );
			if ( records.length === 0 ) {
				_this.emit( 'Session.Idle', _this );
			}
		} );
		return record;
	},

	wait: function ( callback ) {

		if ( this.isIdle() ) {
			process.nextTick( callback );
			return;
		}

		this.once( 'Session.Idle', callback );
	}

} ).implement( ILogSession );

FileSession.defineStatic( {

	DirectoryFormat: '{LogSession}{SessionName}',

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