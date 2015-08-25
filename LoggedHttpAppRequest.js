"use strict";

var HttpAppRequest = require( 'App/HttpAppRequest' );
var FileLog = require( './FileLog' );
var BufferedStream = require( './BufferedStream' );
var DeferredLogStream = require( './DeferredLogStream' );
var MirrorLogger = require( './MirrorLogger' );
var Os = require( 'os' );

function LoggedHttpAppRequest ( app, req, res ) {
	
	var _this = this;

	// BufferedStream is buffering write calls so it will work for FileLog too
	this.Log = new BufferedStream();

	function makeLogStreamCallback( logStreamName ) {
		return function ( stream ) {
			_this.LogStreams[ logStreamName ] = stream;
		};
	}

	// defer all log streams - open them on the first write
	// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected to the current domain
	this.LogStreams = {
		Stdout: new DeferredLogStream( [ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ], makeLogStreamCallback( 'Stdout' ) ),
		Stderr: new DeferredLogStream( [ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ], makeLogStreamCallback( 'Stderr' ) ),
		Request: new DeferredLogStream( [ 'RECORD_SERVER_REQUEST', 'DATA_TEXT' ], makeLogStreamCallback( 'Request' ) ),
		Response: new DeferredLogStream( [ 'RECORD_SERVER_RESPONSE', 'DATA_TEXT' ], makeLogStreamCallback( 'Response' ) )
	};
	

	function cancelLogging () {
		_this.Log = null;
		_this.LogStreams = {
			Stdout: null,
			Stderr: null,
			Request: null,
			Response: null
		};
	}

	// open all log streams but don't make the request wait for us, defer and buffer
	new FileLog( app.getConfig().get( 'storage.log' ), function ( err, log ) {
		if ( err ) {
			cancelLogging();
			return;
		}
		
		//todo: get the parent session from somewhere
		log.startSession( null, null, function ( err, id ) {
			if ( err ) {
				cancelLogging();
				return;
			}

			// flush the buffered writes
			_this.Log.flush( log );
			_this.Log = log;

			for ( var steamName in _this.LogStreams ) {
				_this.LogStreams[ steamName ].assignLog( log );
			}
		} );
	} );

	// log the server environment
	var env = {
		process: {
			cwd: process.cwd(),
			execPath: process.execPath,
			argv: process.argv,
			execArgv: process.execArgv,
			env: process.env,
			title: process.title,
			pid: process.pid,
			gid: process.getgid(),
			uid: process.getuid(),
			groups: process.getgroups(),
			umask: process.umask()
		},
		node: {
			version: process.version,
			versions: process.versions,
			config: process.config,
		},
		os: {
			type: Os.type(),
			platform: Os.platform(),
			arch: Os.arch(),
			release: Os.release(),
			tmpdir: Os.tmpdir(),
			endianness: Os.endianness(),
			hostname: Os.hostname(),
			totalmem: Os.totalmem(),
			cpus: Os.cpus(),
			networkInterfaces: Os.networkInterfaces()
		}
	};

	this.Log.write( env, [ 'RECORD_SERVER_ENV', 'DATA_JSON' ] );

	// log req
	MirrorLogger.mirrorIncomingMessage( req, _this.LogStreams.Request );
	// log res
	MirrorLogger.mirrorServerResponse( res, _this.LogStreams.Response );

	HttpAppRequest.call( this, app, req, res );
	this.Domain.HttpAppRequest = this;

}

LoggedHttpAppRequest.extend( HttpAppRequest, {

	onError: function ( err ) {
		if ( this.Log ) {
			this.Log.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ] );
		}
		HttpAppRequest.prototype.onError.call( this, err );
	},

	dispose: function () {
		
		for ( var steamName in this.LogStreams ) {
			var stream = this.LogStreams[ steamName ];
			if ( stream !== null ) {
				stream.close();
				this.LogStreams[ steamName ] = null;
			}
		}

		HttpAppRequest.prototype.dispose.call( this );
	}

} );

module.exports = LoggedHttpAppRequest;