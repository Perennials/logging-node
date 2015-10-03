"use strict"

var LoggedHttpApp = require( '../LoggedHttpApp' );
var LoggedHttpAppRequest = require( '../LoggedHttpAppRequest' );

// this will be instantiated by LoggedHttpApp whenever we have a new request coming in
class MyAppRequest extends LoggedHttpAppRequest {

	constructor ( app, req, res ) {
		// call the parent constructor
		// customize options for log session that will be created in the constructor
		var logOptions = {
			LogPolicy: app.getLogPolicy(),
			SessionProps: {
				DirectoryFormat: 'myapp-{SessionType}-{SessionIndex}{SessionName}'
			},
			UnchunkHttp: true
		};
		super( app, req, res, logOptions );

		// open a log stream, that is file, in which we can write data
		// don't forget to close it or our app will not close
		this._logStream = this._logSession.openRecord( [ 'RECORD_STREAM', 'DATA_XML' ] );
		this._logStream.write( '<log>\n' );
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
		console.error( 'Damn, error happened with this specific client request', Object.toString( this._request ) );

		// finish the response so we can close the server
		this._response.writeHead( 500, {
			'Connection': 'close',
		} );
		this._response.end();
		this.cleanup();

		// call the default handler, which will log the error and abort the app
		super.onError( err );
	}


	// this will be called when we have the whole http request
	onHttpContent ( content ) {

		// log some line in our stream
		this._logStream.write( '<INFO>HTTP request received</INFO>\n' );

		// write a log record in the context of the HTTP request
		this._logSession.write( { some: 'json' }, [ 'MyRecord', 'RECORD_GENERIC','DATA_JSON' ] )

		// we have the full request at this point, headers and content
		console.log( 'A request came from', this._request.headers[ 'user-agent' ], '.' );

		doSomethingWithThe( this._request, function ( good ) {

			// normal nodejs handling of the response
			this._response.writeHead( good ? 200 : 500, {
				'Connection': 'close',
				'Content-Type': 'text/plain'
			} );
			this._response.end( 'bye' );
			this.cleanup();

		} );

	}
}

// this is used for logging outside of a request context
class MyApp extends LoggedHttpApp {

	constructor ( appRequest ) {
		var logOptions = {
			LogPolicy: 'LOG_ALL_ON_ERROR',
			SessionProps: {
				DirectoryFormat: 'myapp-{SessionType}-{SessionIndex}{SessionName}'
			},
			UnchunkHttp: true,
			// log sessions will be written in this directory, or the temp directory
			StorageDir: __dirname
		};
		super( appRequest, logOptions );
	}
}


// construct a new HttpApp, tell it our request class is MyAppRequest
var app = new MyApp( MyAppRequest );

// log something in the app log session
console.log( 'Starting to listen on 0.0.0.0:1337' );
console.error( 'Ops.' );
app.startListening( 1337, '0.0.0.0' );


setTimeout( function () {
	require( 'child_process' ).exec( 'curl localhost:1337' );
}, 300 );