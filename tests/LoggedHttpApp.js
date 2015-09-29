"use strict";

var LoggedHttpApp = require( '../LoggedHttpApp' );
var FileSession = require( '../FileSession' );
var LoggedHttpAppRequest = require( '../LoggedHttpAppRequest' );
var HttpRequest = require( 'Net/HttpRequest' );
var Fs = require( 'fs' );

require( 'shelljs/global' );

var logsDir = __dirname + '/testlogs';

UnitestA( 'SESSION_APP_RUN no logs', function ( test ) {
	var app1 = new LoggedHttpApp( null, { StorageDir: logsDir } );
	mkdir( '-p', logsDir );
	test( Fs.existsSync( logsDir ) );
	
	var session = app1.getLogSession();

	// we have no output so no logs should be created
	test( !(session instanceof FileSession) );

	Fs.rmdirSync( logsDir );
	test( !Fs.existsSync( logsDir ) );
	app1.close( function () {
		test.out();
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
	var app1 = new LoggedHttpApp( null, { StorageDir: logsDir } );
	mkdir( '-p', logsDir );
	test( Fs.existsSync( logsDir ) );
	
	console.log( 'asd' );
	console.error( 'qwe' );

	// wait until we have log initialized
	// but this doesn't mean the log streams are ready and we don't have listeners for this
	var session = app1.getLogSession();

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

				session.close( function () {
					rm( '-rf', logsDir );
					test.out();
				} );

			} );

		} );

		records.map( 'close' );

	}, 100 );

} );


UnitestA( 'LoggedHttpAppRequest logging', function ( test ) {

	class TestAppRequest extends LoggedHttpAppRequest {

		constructor ( app, req, res ) {
			super( app, req, res, {} );
		}

		onHttpContent ( content ) {
			console.log( 'asd' );
			console.error( 'qwe' );
			setTimeout( function () {
				throw new Error( '1' );
			}, 100 );
		}

		onError ( err ) {
			if ( global.errored ) {
				return;
			}
			global.errored = true;
			var _this = this;
			this._response.write( '123' );
			this._response.end( '456' );
			this.getLogSession().write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ], function ( err, id ) {

				test( !err );
				_this._app.close( function () {

					_this.getLogSession().close( function () {
						// if we have 8 files - two std streams, an exception, a meta, a close, a server env, server rq and rs, a debug
						test( _this.getLogSession().getLoggedRecords().length === 9 );

						//if the console calls went properly in the session
						test.eq( 'asd\n', Fs.readFileSync( _this.getLogSession().getStorageUri() + '/' + _this.getLogSession().getLoggedRecords()[ 3 ], { encoding: 'utf8' } ) );
						test.eq( 'qwe\n', Fs.readFileSync( _this.getLogSession().getStorageUri() + '/' + _this.getLogSession().getLoggedRecords()[ 4 ], { encoding: 'utf8' } ) );
						//test the server response was logged
						test( Fs.readFileSync( _this.getLogSession().getStorageUri() + '/' + _this.getLogSession().getLoggedRecords()[ 5 ], { encoding: 'utf8' } ).indexOf( '3\r\n123\r\n3\r\n456\r\n0\r\n' ) > 0 );
						

						var session = app1.getLogSession();

						// meta, env, rq, rs, close
						test( session.getLoggedRecords().length === 5 );
						
						rm( '-rf', logsDir );
						test.out();

					} );

				} );
			} );
		}
	}

	var app1 = new LoggedHttpApp( TestAppRequest, { StorageDir: logsDir } );
	mkdir( '-p', logsDir );
	test( Fs.existsSync( logsDir ) );
	app1.startListening( 55555, '127.0.0.1' );
	(new HttpRequest( 'http://127.0.0.1:55555' ))
		.setOptions( { LogRecord: { RequestProps: [ 'rq' ], ResponseProps: [ 'rs' ] } } )
		.setHeader( 'someting', 'custom' )
		.setHeader( 'content-encoding', 'gzip' )
		.send( 'asd.qwe' );

} );
