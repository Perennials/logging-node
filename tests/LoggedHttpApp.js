var LoggedHttpApp = require( '../LoggedHttpApp' );
var LoggedHttpAppRequest = require( '../LoggedHttpAppRequest' );
var HttpRequest = require( 'Net/HttpRequest' );
var Fs = require( 'fs' );

require( 'shelljs/global' );

var logsDir = __dirname + '/testlogs';

UnitestA( 'SESSION_APP_RUN no logs', function ( test ) {
	var app1 = new LoggedHttpApp( null, '127.0.0.1', 55555 );
	var cfg = app1.getConfig();
	cfg.merge( { storage: { log:  logsDir } } );
	mkdir( '-p', logsDir );
	test( Fs.existsSync( logsDir ) );
	
	app1.getLogSession( function ( err, session ) {

		test( !err );
		// we have no output so no logs should be created
		test( !session );

		rm( '-rf', logsDir );
		test( !Fs.existsSync( logsDir ) );
		app1.close( function () {
			test.out();
		} );

	} );
} );

function SyncEvents ( event, objects, callback ) {
	var unfinished = objects.length;

	if ( unfinished === 0 ) {
		process.nextTick( callback );
		return;
	}

	for ( var i = objects.length - 1; i >= 0; --i ) {
		objects[ i ].once( event, function () {
			if ( --unfinished === 0 ) {
				process.nextTick( callback );
			}
		} );
	}
}

UnitestA( 'SESSION_APP_RUN logs upon console.log()', function ( test ) {
	var app1 = new LoggedHttpApp( null, '127.0.0.1', 55555 );
	var cfg = app1.getConfig();
	cfg.merge( { storage: { log:  logsDir } } );
	mkdir( '-p', logsDir );
	test( Fs.existsSync( logsDir ) );
	
	console.log( 'asd' );
	console.error( 'qwe' );

	// wait until we have log initialized
	// but this doesn't mean the log streams are ready and we don't have listeners for this
	app1.getLogSession( function ( err, session ) {

		// wait a little bit so hopefully all streams (initiated by the console calls above) are open
		// no guarantee though
		setTimeout( function () {
			var records = session.getOpenRecords();

			SyncEvents( 'Record.Closed', records, function () {

				var records = session.getLoggedRecords();

				// check logs are in the app run log
				test( 'asd\n' == Fs.readFileSync( session.getStorageUri() + '/' + records[ 2 ], { encoding: 'utf8' } ) );
				test( 'qwe\n' == Fs.readFileSync( session.getStorageUri() + '/' + records[ 3 ], { encoding: 'utf8' } ) );

				app1.close( function () {

					test( !err );
					session.close( function () {
						rm( '-rf', logsDir );
						test.out();
					} );

				} );

			} );

			records.map( 'close' );

		}, 100 );

	} );
} );

UnitestA( 'LoggedHttpAppRequest.onHttpContent', function ( test ) {

	function TestAppRequest ( app, req, res ) {
		LoggedHttpAppRequest.call( this, app, req, res );
	}

	TestAppRequest.extend( LoggedHttpAppRequest, {
		onHttpContent: function ( content ) {
			console.log( 'asd' );
			console.error( 'qwe' );
			setTimeout( function () {
				throw new Error( '1' );
			}, 100 );
		},

		onError: function ( err ) {
			var _this = this;
			this.Response.write( '123' );
			this.Response.end( '456' );//
			this.LogSession.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ], function ( err, id ) {

				test( !err );

				_this.App.close( function () {

					_this.LogSession.close( function () {
						// if we have 8 files - two std streams, an exception, a meta, a close, a server env, server rq and rs
						test( _this.LogSession.getLoggedRecords().length === 8 );

						//if the console calls went properly in the session
						test.eq( 'asd\n', Fs.readFileSync( _this.LogSession.getStorageUri() + '/' + _this.LogSession.getLoggedRecords()[ 2 ], { encoding: 'utf8' } ) );
						test.eq( 'qwe\n', Fs.readFileSync( _this.LogSession.getStorageUri() + '/' + _this.LogSession.getLoggedRecords()[ 3 ], { encoding: 'utf8' } ) );
						//test the server response was logged
						test.eq( '123456', Fs.readFileSync( _this.LogSession.getStorageUri() + '/' + _this.LogSession.getLoggedRecords()[ 5 ], { encoding: 'utf8' } ) );
						
						rm( '-rf', logsDir );
						test.out();
					} );

				} );
			} );
		}
	} );

	var app1 = new LoggedHttpApp( TestAppRequest, '127.0.0.1', 55555 );
	var cfg = app1.getConfig();
	cfg.merge( { storage: { log:  logsDir } } );
	mkdir( '-p', logsDir );
	test( Fs.existsSync( logsDir ) );
	app1.startListening();
	(new HttpRequest( 'http://127.0.0.1:55555' ))
		.setOptions( { LogRecord: { RequestProps: [ 'rq' ], ResponseProps: [ 'rs' ] } } )
		.setHeader( 'someting', 'custom' )
		.send( 'asd.qwe' );

} );
