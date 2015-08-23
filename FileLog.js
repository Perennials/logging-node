"use strict";

var ILogEngine = require( './ILogEngine' );
var Fs = require( 'fs' );
var Os = require( 'os' );
var Path = require( 'path' );

function FileLog ( storageUri, callback ) {

	this._dir = null;
	this._sessionId = null;
	this._queue = {};
	this._loggedIds = [];
	this._notifyAfterLastWrite = [];
	this._fileCount = 0;

	var _this = this;

	if ( !String.isString( storageUri ) ) {
		storageUri = '';
	}

	// expand the path. if it doesn't exist use the temp dir
	Fs.stat( storageUri, function ( err, stats ) {
		if ( err || !stats.isDirectory() ) {
			_this._dir = Os.tmpdir();
			if ( !_this._dir.endsWith( Path.sep ) ) {
				_this._dir += Path.sep;
			}
			if ( callback instanceof Function ) {
				callback( err, _this );
			}
		}
		else {
			Fs.realpath( storageUri, function ( err, resolvedPath ) {
				if ( err ) {
					_this._dir = Os.tmpdir();
				}
				else {
					_this._dir = resolvedPath;
				}
				if ( !_this._dir.endsWith( Path.sep ) ) {
					_this._dir += Path.sep;
				}
				if ( callback instanceof Function ) {
					callback( err, _this );
				}
			} );
		}
	} );
}

// extend so we can use instanceof
FileLog.extend( ILogEngine, {

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
				callback( err, id )
			}
		} );
	},

	_writeQueue: function ( fileName, data, callback ) {
		var _this = this;
		this._queue[ fileName ] = true;

		Fs.writeFile( this._dir + fileName, data, function ( err ) {
			_this._loggedIds.push( fileName );
			delete _this._queue[ fileName ];
			if ( callback instanceof Function ) {
				callback( err );
			}

			if ( _this._notifyAfterLastWrite.length > 0 &&
				 _this.getRecordsInProgress().length === 0 ) {
				
				var callbacks = _this._notifyAfterLastWrite;
				for ( var i = 0, iend = callbacks.length; i < iend; ++i ) {
					callbacks[ i ]();
				}
				_this._notifyAfterLastWrite = [];
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
			FileLog._dataTypeToFileExt( props.DataType );

		return fileName;
	},

	waitRecords: function ( callback ) {
		if ( this.getRecordsInProgress().length === 0 ) {
			callback();
		}
		else {
			this._notifyAfterLastWrite.push( callback );
		}
	},

	startSession: function ( parentId, props, callback ) {
		var _this = this;

		if ( props instanceof Function ) {
			callback = props;
			props = null;
		}

		props = ILogEngine.labelsToProps( props );

		var prefix = 'LogSession_';
		var fileName = prefix + '{LogSession}';

		this._makeSessionId( fileName, function ( err, id ) {
			if ( !err ) {
				_this._dir += prefix + id + Path.sep;
				_this._sessionId = id;
			}

			if ( !Object.isObject( props ) ) {
				props = {};
			}
			else {
				// dont ruin the original object
				props = {}.merge( props );
			}

			var meta = {
				Api: 'logging-node-1.0',
				LogSpecs: '0.9',
				LogSession: id,
				ParentSession: parentId
			};

			props.merge( meta );

			_this.write( props, [ 'RECORD_META', 'DATA_JSON' ], function ( err ) {
				if ( callback instanceof Function ) {
					callback( err, id );
				}
			} );

		} );
	},

	getSessionId: function () {
		return this._sessionId;
	},
	
	getLoggedRecords: function () {
		return this._loggedIds;
	},

	getRecordsInProgress: function () {
		return Object.keys( this._queue );
	},
	
	write: function ( data, props, callback ) {

		props = ILogEngine.labelsToProps( props );

		var fileName = this._makeRecordId( props );

		// handle known data types
		//todo: this handling can be exported to shared function, but no need atm, we are the only user
		//todo: handle HttpRequest, HttpResponse
		if ( data instanceof Object &&
			 props.DataType == ILogEngine.DATA_JSON.Value ) {
			
			data = JSON.stringify( data );
		}

		// write it
		this._writeQueue( fileName, data, callback );
	},

	getStorageUri: function () {
		return this._dir.slice( 0, -1 );
	}

} ).implement( ILogEngine );

FileLog.defineStatic( {

	_dataTypeToFileExt: function ( dataType, def ) {
		return FileLog._dataLabelToFileExt( 'DATA_' + dataType, def );
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

module.exports = FileLog;