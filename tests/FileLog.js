var FileLog = require( '../FileLog.js' );
var FileSession = require( '../FileSession.js' );
var ILogEngine = require( '../model/ILogEngine.js' );
var Path = require( 'path' );
var Fs = require( 'fs' );

require( 'shelljs/global' );

Unitest( 'FileSession._dataLabelToFileExt()', function ( test ) {
	test( FileSession._dataLabelToFileExt( 'DATA_JSON' ) == 'json' );
	test( FileSession._dataLabelToFileExt( 'DATA_TEXT' ) == 'txt' );
	test( FileSession._dataLabelToFileExt( 'DATA_XML' ) == 'xml' );
	test( FileSession._dataLabelToFileExt( 'DATA_BINARY' ) == 'bin' );
	test( FileSession._dataLabelToFileExt( 'DATA_JPEG' ) == 'jpg' );
	test( FileSession._dataLabelToFileExt( 'DATA_PNG' ) == 'png' );
	test( FileSession._dataLabelToFileExt( 'DATA_HTML' ) == 'html' );
	test( FileSession._dataLabelToFileExt( null ) == 'bin' );
	test( FileSession._dataLabelToFileExt( null, 'pcx' ) == 'pcx' );
} );

UnitestA( 'FileLog()', function ( test ) {
	new FileLog( null, function ( err, log ) {
		test( err );
		test( log instanceof FileLog );
		// at least on OSX 10.10 the tmpdir includes trailing slash
		test.eq( log.getStorageUri(), require( 'os' ).tmpdir() );
		test.out();
	} );
} );

UnitestA( 'FileLog.openSession()', function ( test ) {
	var dir = __dirname + Path.sep + 'testlogs' + Path.sep;
	mkdir( '-p', dir );
	test( Fs.existsSync( dir ) );

	// start a file log
	new FileLog( dir, function ( err, log ) {
		test( !err );
		test( log instanceof FileLog );
		test( log.getStorageUri() == dir );

		if ( err ) {
			test.out();
			return;
		}

		// start a session with parent and name
		log.openSession( '123', [ 'Sesiq' ], function ( err, session ) {

			test( !err );

			// check if we have proper meta data for the session
			test( Fs.existsSync( dir
			                         + Path.sep
			                         + FileSession.DirectoryFormat
			                         	.replace( '{LogSession}', session.getId() )
			                         	.replace( '{SessionName}', '-Sesiq' )
			) );
			test.eq( session.getLoggedRecords()[ 0 ], '1-META.json' );
			var fn = session.getStorageUri() + '/' + session.getLoggedRecords()[ 0 ];
			test( Fs.existsSync( fn ) );
			
			var meta = JSON.parse( Fs.readFileSync( fn, { encoding: 'utf8' } ) );
			test( meta.Api == FileLog.Api );
			test( meta.LogSpecs == FileLog.LogSpecs );
			test( meta.LogSession == session.getId() );
			test( meta.ParentSession == '123' );

			// clean everything
			session.close( function () {
				rm( '-rf', dir );
				test.out();
			} );
		} );

	} );
} );


UnitestA( 'FileSession.wait()', function ( test ) {
	var dir = __dirname + Path.sep + 'testlogs';
	mkdir( '-p', dir );
	test( Fs.existsSync( dir ) );

	// start a file log
	new FileLog( dir, function ( err, log ) {
		if ( err ) {
			test.out();
			return;
		}

		// start a session
		log.openSession( null, function ( err, session ) {

			// write one record and check its contents
			session.write( 'asd qwe', [ 'DATA_TEXT' ], function ( err ) {
				test( !err );
				test( session.getLoggedRecords()[ 1 ] == '2-GENERIC.txt' );
				var fn = session.getStorageUri() + '/' + session.getLoggedRecords()[ 1 ];
				test( Fs.readFileSync( fn, { encoding: 'utf8' } ) == 'asd qwe' );
			} );

			// open one stream too and see if write is working and closing is properly waited for
			session.openRecord( function ( err, record ) {
				if ( record ) {
					record.once( 'Record.Idle', function () {
						test.eq( Fs.readFileSync( record.getUri(), { encoding: 'utf8' } ), 'qwe asd' );
						record.close();
					} );
					record.write( 'qwe asd' );
				}
			} );

			// check if the wait callback is working and clean everything
			session.wait( function () {
				var records = session.getLoggedRecords();
				test( records.length == 3 );
				session.close( function () {
					rm( '-rf', dir );
				} );
			} );

			log.wait( function () {
				test.out();
			} );
		} );

	} );
} );
