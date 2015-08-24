var LoggedHttpApp = require( '../LoggedHttpApp' );
var LoggedHttpAppRequest = require( '../LoggedHttpAppRequest' );
var HttpRequest = require( 'Net/HttpRequest' );
var Fs = require( 'fs' );

UnitestA( 'LoggedHttpAppRequest.onHttpContent', function ( test ) {

	function TestAppRequest ( app, req, res ) {
		LoggedHttpAppRequest.call( this, app, req, res );
	}

	TestAppRequest.extend( LoggedHttpAppRequest, {
		onHttpContent: function ( content ) {
			LoggedHttpAppRequest.prototype.onHttpContent.call( this, content );
			test( this.Request.headers.someting === 'custom' );
			test( content.toString() === 'asd.qwe' );
			console.log( 'asd' );
			console.error( 'qwe' );
			setTimeout( function () {
				throw new Error( '1' );
			}, 100 );
		},

		onError: function ( err ) {
			var _this = this;
			this.Response.end();
			this.Log.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ], function ( err, id ) {
				_this.App.onClose( function () {
					test.out();
				} );
			} );
		}
	} );

	var app1 = new LoggedHttpApp( TestAppRequest, '127.0.0.1', 55555 );
	var cfg = app1.getConfig();
	var logsDir = __dirname + '/testlogs';
	cfg.merge( { storage: { log:  logsDir } } );
	if ( !Fs.existsSync( logsDir ) ) {
		Fs.mkdirSync( logsDir );
	}
	app1.startListening();
	(new HttpRequest( 'http://127.0.0.1:55555' ))
		.setHeader( 'someting', 'custom' )
		.send( 'asd.qwe' );

} );

/*UnitestA( 'Parallel domain handling', function ( test ) {

	var nreq = 0;
	var nerr = 0;

	function TestAppRequest ( app, req, res ) {
		LoggedHttpAppRequest.call( this, app, req, res );
	}

	TestAppRequest.extend( LoggedHttpAppRequest, {
		onHttpContent: function ( content ) {
			this.Request.content = content;
			++nreq;
			if ( nreq === 1 ) {
				setTimeout( function () {
					throw new Error( '1' );
				}, 100 );
			}
			else if ( nreq === 2 ) {
				setTimeout( function () {
					process.nextTick( function () {
						throw new Error( '2' );
					} );
				}, 50 );	
			}
			else if ( nreq === 3 ) {
				throw new Error( '3' );
			}
		},

		onError: function ( err ) {
			++nerr;
			this.Response.end();
			if ( nerr === 1 ) {
				test( err.message === '3' );
				test( this.Request.content.toString() === '333' );
				this.App.onClose( function () {
					test.out();
				} );
			}
			else if ( nerr === 2 ) {
				test( err.message === '2' );
				test( this.Request.content.toString() === '222' );
			}
			else if ( nerr === 3 ) {
				test( err.message === '1' );
				test( this.Request.content.toString() === '111' );
			}
		}
	} );

	var app1 = new LoggedHttpApp( TestAppRequest, '127.0.0.1', 55555 );
	app1.startListening();
	(new HttpRequest( 'http://127.0.0.1:55555' )).send( '111' );
	(new HttpRequest( 'http://127.0.0.1:55555' )).send( '222' );
	(new HttpRequest( 'http://127.0.0.1:55555' )).send( '333' );
} );
*/