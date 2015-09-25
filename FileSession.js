"use strict";

var Events = require( 'events' );
var Fs = require( 'fs' );
var ILogEngine = require( './model/ILogEngine' );
var ILogSession = require( './model/ILogSession' );
var Path = require( 'path' );
var FileRecord = require( './FileRecord' );
var DeferredLog = require( './DeferredLog' );
var FileLog = null;

class FileSession extends ILogSession {

	constructor ( log, parentId, props, callback ) {

		// dependencies, ah
		FileLog = FileLog || require( './FileLog' );

		if ( Object.isObject( parentId ) || parentId instanceof Array ) {
			callback = props;
			props = parentId;
			parentId = null;
		}

		else if ( props instanceof Function ) {
			callback = props;
			props = {};
		}

		else if ( parentId instanceof Function ) {
			callback = parentId;
			props = {};
			parentId = null;
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
			sessionName = props.Name;
			delete props.Name;
		}
		
		if ( props.DirectoryFormat ) {
			fileName = props.DirectoryFormat;
			delete props.DirectoryFormat;
		}

		if ( props.ParentSession ) {
			parentId = props.ParentSession;
			delete props.ParentSession;
		}

		super( log, parentId, props, callback );

		             /// this is not in ILogEngine so not in DeferredLog
		this._dir = ( log instanceof DeferredLog ? log.getLog().getStorageUri() : log.getStorageUri() );
		this._fileCount = 0;
		this._openRecords = [];
		this._loggedRecords = [];
		this._closed = false;
		this._meta = {
			Protocol: FileLog.Protocol,
			Api: FileLog.Api,
			ApiVersion: FileLog.ApiVersion,
			LogSession: null,
			ParentSession: null,
			LinkedTokens: [],
			SessionType: props.SessionType || null,
			TimeStamp: null
		};
		this._pendingWrites = 0;

		var _this = this;

		if ( props.LinkedTokens ) {
			this._meta.LinkedTokens = props.LinkedTokens;
		}

		this._makeSessionId( this._meta.SessionType, fileName, sessionName, function ( err, index, id ) {

			// this will never happen. the logic loops until it succeeds
			if ( err ) {
				_this.emit( 'Session.Open.Error', err, _this );

				if ( callback instanceof Function ) {
					process.nextTick( callback, err, _this );
				}
				return;
			}

			_this._dir += Path.sep + id;
			_this._index = index;
			_this._id = id;

			var meta = _this._meta;
			meta.LogSession = id;
			meta.ParentSession = parentId;
			if ( meta.TimeStamp === null ) {
				meta.TimeStamp = (new Date()).toISOString();
			}

			_this.write( meta, props, function ( err, record ) {

				if ( err ) {
					this.emit( 'Session.Meta.Error', err, record );
				}

				_this._metaRecord = record.getUri();

				_this.emit( 'Session.Opened', err, _this );

				if ( callback instanceof Function ) {
					process.nextTick( callback, err, _this );
				}
			} );

		} );

	}

	_makeSessionId ( sessionType, fileName, sessionName, callback, _num ) {
		if ( _num === undefined ) {
			_num = Date.now();
		}

		var id = _num.toString( 36 );
		var dirName = fileName.replace( '{SessionIndex}', id ).replace( '{SessionName}', sessionName ).replace( '{SessionType}', sessionType );
		var path = this._dir + Path.sep + dirName;
		
		var _this = this;

		// try to create a dir with unique name
		Fs.mkdir( path, function( err, fd ) {
			if ( err ) {
				_this._makeSessionId( sessionType, fileName, sessionName, callback, _num + 1 );
			}
			else {
				process.nextTick( callback, null, id, dirName )
			}
		} );
	}

	_makeRecordId ( props ) {
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
	}

	_getLastIdIndex () {
		return this._fileCount - 1;
	}

	_updateMetaRecord () {
		if ( this._metaRecord === null ) {
			return;
		}
			
		var _this = this;
		++this._pendingWrites;
		Fs.writeFile( this._metaRecord, JSON.stringify( this._meta ), function ( err ) {
			if ( err ) {
				_this.emit( 'Session.Meta.Error', err );
			}
			
			if ( --_this._pendingWrites === 0 && _this.isIdle() ) {
				_this.emit( 'Session.Idle' );
			}
		} );
	}

	setParentSession ( sessionId ) {
		this._meta.ParentSession = sessionId;
		this._updateMetaRecord();
		return this;
	}

	addLinkedToken ( token ) {
		this._meta.LinkedTokens.push( token );
		this._updateMetaRecord();
		return this;
	}

	isIdle () {
		if ( this._pendingWrites > 0 ) {
			return false;
		}
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
	}

	getStorageUri () {
		return this._dir;
	}

	getLoggedRecords () {
		return this._loggedRecords;
	}

	close ( callback ) {
		var _this = this;
		if ( this._closed ) {
			if ( callback instanceof Function ) {
				process.nextTick( callback, null, this );
			}	
			return;
		}
		
		this.wait( function () {
			
			_this._closed = true;
			
			var meta = {
				TimeStamp: (new Date()).toISOString()
			};

			var props = ILogEngine.labelsToProps( [ 'RECORD_CLOSE', 'DATA_JSON' ] );

			_this.write( meta, props, function ( err ) {

				_this.emit( 'Session.Closed', err, _this );

				if ( callback instanceof Function ) {
					process.nextTick( callback, err, _this );
				}
			} );
		} );
	}

	getOpenRecords () {
		return this._openRecords;
	}

	openRecord ( props, callback ) {
		var _this = this;
		var record = new FileRecord( this, props, callback );
		this._openRecords.push( record );
		record.on( 'Record.Closed', function ( err, record ) {

			_this._loggedRecords[ record._getIndex() ] = record.getId();

			var records = _this._openRecords;
			records.splice( records.indexOf( record ), 1 );
			if ( records.length === 0 && _this.isIdle() ) {
				_this.emit( 'Session.Idle', _this );
			}
		} );
		return record;
	}

	wait ( callback ) {

		if ( this.isIdle() ) {
			process.nextTick( callback );
			return;
		}

		this.once( 'Session.Idle', callback );
	}

	static _dataTypeToFileExt ( dataType, def ) {
		return FileSession._dataLabelToFileExt( 'DATA_' + dataType, def );
	}

	static _dataLabelToFileExt ( dataLabel, def ) {

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

}

FileSession.implement( ILogSession );

FileSession.static( {

	DirectoryFormat: '{SessionIndex}-{SessionName}'

} );

module.exports = FileSession;
