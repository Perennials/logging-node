var FileLog = require( '../FileLog.js' );
var Path = require( 'path' );
var Fs = require( 'fs' );
var Helpers = require( './Helpers' );

Unitest( 'FileLog._dataLabelToFileExt()', function ( test ) {
	test( FileLog._dataLabelToFileExt( 'DATA_JSON' ) == 'json' );
	test( FileLog._dataLabelToFileExt( 'DATA_TEXT' ) == 'txt' );
	test( FileLog._dataLabelToFileExt( 'DATA_XML' ) == 'xml' );
	test( FileLog._dataLabelToFileExt( 'DATA_BINARY' ) == 'bin' );
	test( FileLog._dataLabelToFileExt( 'DATA_JPEG' ) == 'jpg' );
	test( FileLog._dataLabelToFileExt( 'DATA_PNG' ) == 'png' );
	test( FileLog._dataLabelToFileExt( 'DATA_HTML' ) == 'html' );
	test( FileLog._dataLabelToFileExt( null ) == 'bin' );
	test( FileLog._dataLabelToFileExt( null, 'pcx' ) == 'pcx' );
} );

UnitestA( 'FileLog()', function ( test ) {
	new FileLog( null, function ( err, log ) {
		test( err );
		test( log instanceof FileLog );
		// at least on OSX 10.10 the tmpdir includes trailing slash
		test( log.getStorageUri() == require( 'os' ).tmpdir().slice( 0, -1 ) );
		test( log._makeRecordId( { RecordType: 'META', DataType: 'JSON' } ) == '1-META.json' );
		test.out();
	} );
} );

UnitestA( 'FileLog.startSession()', function ( test ) {
	var dir = __dirname + Path.sep + 'testlogs';
	try { Fs.mkdirSync( dir ); }
	catch ( e ) {}
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
		log.startSession( '123', [ 'Sesiq' ], function ( err, sessionId ) {

			test( !err );

			// check if we have proper meta data for the session
			test( Fs.existsSync( dir + Path.sep + FileLog.LogSessionDirectoryFormat.replace( '{LogSession}', log.getSessionId() ) ) );
			test( log.getLoggedRecords()[ 0 ] == '1-META.json' );
			var fn = log.getStorageUri() + '/' + log.getLoggedRecords()[ 0 ];
			test( Fs.existsSync( fn ) );
			
			var meta = JSON.parse( Fs.readFileSync( fn, { encoding: 'utf8' } ) );
			test( meta.Api == 'logging-node' );
			test( meta.LogSpecs == '0.9' );
			test( meta.LogSession == log.getSessionId() );
			test( meta.ParentSession == '123' );
			test( meta.Name == 'Sesiq' );

			// clean everything
			Helpers.removeLogSession( log );
			Fs.rmdirSync( dir );
			test.out();
		} );

	} );
} );

UnitestA( 'FileLog.waitRecords()', function ( test ) {
	var dir = __dirname + Path.sep + 'testlogs';
	try { Fs.mkdirSync( dir ); }
	catch ( e ) {}
	test( Fs.existsSync( dir ) );

	// start a file log
	new FileLog( dir, function ( err, log ) {
		if ( err ) {
			test.out();
			return;
		}

		// start a session
		log.startSession( null, function ( err, sessionId ) {

			// write one record and check its contents
			log.write( 'asd qwe', [ 'DATA_TEXT' ], function ( err ) {
				test( !err );
				test( log.getLoggedRecords()[ 1 ] == '2-GENERIC.txt' );
				var fn = log.getStorageUri() + '/' + log.getLoggedRecords()[ 1 ];
				test( Fs.readFileSync( fn, { encoding: 'utf8' } ) == 'asd qwe' );
			} );

			// open one stream too and see if write is working and closing is properly waited for
			log.openStream( function ( err, stream ) {
				if ( stream ) {
					stream.once( 'close', function () {
						var fn = log.getStorageUri() + '/' + log.getLoggedRecords()[ 2 ];
						test( Fs.readFileSync( fn, { encoding: 'utf8' } ) == 'qwe asd' );
					} );
					stream.end( 'qwe asd' );
					stream.close();
				}
			} );

			// check if the wait callback is working and clean everything
			log.waitRecords( function () {
				var records = log.getLoggedRecords();
				test( records.length == 3 );
				// clean everything
				Helpers.removeLogSession( log );
				Fs.rmdirSync( dir );
				test.out();
			} );
		} );

	} );
} );