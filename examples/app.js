var LoggedHttpApp = require( '../LoggedHttpApp' );
var LoggedHttpAppRequest = require( '../LoggedHttpAppRequest' );
var FileSession = require( '../FileSession' );
var Config = require( 'App/Config' );

// this will be instantiated by LoggedHttpApp whenever we have a new request coming in
function MyAppRequest ( app, req, res ) {
	// call the parent constructor
	LoggedHttpAppRequest.call( this, app, req, res );

	// open a log stream, that is file, in which we can write data
	// don't forget to close it or our app will not close
	this._logStream = this.LogSession.openRecord( [ 'RECORD_STREAM', 'DATA_XML' ] );
	this._logStream.write( '<log>\n' );

}

MyAppRequest.extend( LoggedHttpAppRequest, {

	// make sure we clean what we have opened
	// logsession will not be closed properly if we have open streams
	cleanup: function () {
		this._logStream.write( '</log>' );
		this._logStream.close();
	},
	
	onError: function ( err ) {

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
		LoggedHttpAppRequest.prototype.onError.call( this, err );
	},


	// this will be called when we have the whole http request
	onHttpContent: function ( content ) {

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
} );


// construct a new HttpApp, tell it our request class is MyAppRequest
var app = new LoggedHttpApp( MyAppRequest, '0.0.0.0', 1337 );

// log sessions will be written in the directory pointed by 'storage.log', or the temp directory
app.setConfig( new Config( { storage: { log: __dirname } } ) );

// we can customize the session directory naming
FileSession.DirectoryFormat = 'myapp-{LogSession}{SessionName}';

app.startListening();

// setTimeout( function () {
// 	require( 'child_process' ).exec( 'curl localhost:1337' );
// }, 300 );