var ILogEngine = require( '../model/ILogEngine.js' );

Unitest( 'ILogEngine.mimeToDataType()', function ( test ) {
	test( ILogEngine.mimeToDataType( 'application/json; charset=utf-8' ) === ILogEngine.DATA_JSON.Value );
	test( ILogEngine.mimeToDataType( 'application/json' ) === ILogEngine.DATA_JSON.Value );
	test( ILogEngine.mimeToDataType( 'application/octet-stream' ) === ILogEngine.DATA_BINARY.Value );
	test( ILogEngine.mimeToDataType( 'application/binary' ) === ILogEngine.DATA_BINARY.Value );
	test( ILogEngine.mimeToDataType( 'text/xml' ) === ILogEngine.DATA_XML.Value );
	test( ILogEngine.mimeToDataType( 'application/xml' ) === ILogEngine.DATA_XML.Value );
	test( ILogEngine.mimeToDataType( 'text/plain' ) === ILogEngine.DATA_TEXT.Value );
	test( ILogEngine.mimeToDataType( 'text/html' ) === ILogEngine.DATA_HTML.Value );
	test( ILogEngine.mimeToDataType( 'image/jpeg' ) === ILogEngine.DATA_BINARY.Value );
	test( ILogEngine.mimeToDataType( 'image/png' ) === ILogEngine.DATA_BINARY.Value );
	test( ILogEngine.mimeToDataType( null ) === ILogEngine.DATA_BINARY.Value );
	test( ILogEngine.mimeToDataType( null, 'pcx' ) === 'pcx' );
} );

Unitest( 'ILogEngine.mimeToDataLabel()', function ( test ) {
	test( ILogEngine.mimeToDataLabel( 'application/json; charset=utf-8' ) === 'DATA_' + ILogEngine.DATA_JSON.Value );
} );

Unitest( 'ILogEngine.labelsToProps()', function ( test ) {
	test.eq( ILogEngine.labelsToProps( { a: 1, b: 2 } ), { a: 1, b: 2 } );
	test.eq( ILogEngine.labelsToProps( [ 'RECORD_META', 'DATA_JSON' ] ), { RecordType: ILogEngine.RECORD_META.Value, DataType: ILogEngine.DATA_JSON.Value } );
	test.eq( ILogEngine.labelsToProps( [ 'RECORD_META', 'Ivan', { LinkedToknes: [ 1, 2, 'asd' ] } ] ), { RecordType: ILogEngine.RECORD_META.Value, Name: 'Ivan', LinkedToknes: [ 1, 2, 'asd' ] } );
} );

Unitest( 'ILogEngine.normalizeData()', function ( test ) {
	test.eq( ILogEngine.normalizeData( { a: 1, b: 2 }, { DataType: 'JSON' } ), '{"a":1,"b":2}' );
	test.eq( ILogEngine.normalizeData( { a: 1, b: 2 }, { DataType: 'TEXT' } ), '[object Object]' );
	test.eq( ILogEngine.normalizeData( { a: 1, b: 2 }, { DataType: 'BINARY' } ), '[object Object]' );
} );