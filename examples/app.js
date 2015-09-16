"use strict"

var PerennialApp = require( '../PerennialApp' );
var PerennialAppRequest = require( '../PerennialAppRequest' );

// this will be instantiated by PerennialApp whenever we have a new request coming in
class MyAppRequest extends PerennialAppRequest {

	constructor ( app, req, res ) {
		// call the parent constructor
		super( app, req, res );

		// open a log stream, that is file, in which we can write data
		// don't forget to close it or our app will not close
		this._logStream = this.LogSession.openRecord( [ 'RECORD_STREAM', 'DATA_XML' ] );
		this._logStream.write( '<log>\n' );
	}

	// customize options for log session that will be created in the constructor
	determineSessionProps () {
		return { DirectoryFormat: 'myapp-{SessionType}-{SessionIndex}{SessionName}' };
	}

	determineLogPolicy () {
		return 'LOG_ALL_ON_ERROR';
	}

	// make sure we clean what we have opened
	// logsession will not be closed properly if we have open streams
	cleanup () {
		this._logStream.write( '</log>' );
		this._logStream.close();
	}
	
	onError ( err ) {

		// log some line in our stream
		this._logStream.write( '<ERROR>Unhandled error "' + err.message + '"</ERROR>\n' );

		// this will be copied to a file in the log session
		console.error( 'Damn, error happened with this specific client request', this.Request );

		// finish the response so we can close the server
		this.Response.writeHead( 500, {
			'Connection': 'close',
		} );
		this.Response.end();
		this.cleanup();

		// call the default handler, which will log the error and abort the app
		super.onError( err );
	}


	// this will be called when we have the whole http request
	onHttpContent ( content ) {

		// log some line in our stream
		this._logStream.write( '<INFO>HTTP request received</INFO>\n' );

		// write a log record in the context of the HTTP request
		this.LogSession.write( { some: 'json' }, [ 'MyRecord', 'RECORD_GENERIC','DATA_JSON' ] )

		// we have the full request at this point, headers and content
		console.log( 'A request came from', this.Request.headers[ 'user-agent' ], '.' );

		doSomethingWithThe( this.Request, function ( good ) {

			// normal nodejs handling of the response
			this.Response.writeHead( good ? 200 : 500, {
				'Connection': 'close',
				'Content-Type': 'text/plain'
			} );
			this.Response.end( 'bye' );
			this.cleanup();

		} );

	}
}

class MyApp extends PerennialApp {

	determineSessionProps () {
		return { DirectoryFormat: 'myapp-{SessionType}-{SessionIndex}{SessionName}' };
	}
}


// construct a new HttpApp, tell it our request class is MyAppRequest
var app = new MyApp( MyAppRequest, '0.0.0.0', 1337 );

// log sessions will be written in this directory, or the temp directory
app.setStorageDir( __dirname );

// log something in the app log session
console.log( 'Starting to listen on 0.0.0.0:1337' );
app.startListening();

setTimeout( function () {
	require( 'child_process' ).exec( 'curl localhost:1337' );
}, 300 );