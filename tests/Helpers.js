var Helpers = require( '../Helpers.js' );

Unitest( 'Helpers.addSessionProp()', function ( test ) {
	var obj = {};
	Helpers.addSessionProp( obj, 'Name', 'Asd' );
	test.eq( obj, { SessionProps: { Name: 'Asd' } } );
	Helpers.addSessionProp( obj, 'Value', 'Qwe' );
	test.eq( obj, { SessionProps: { Name: 'Asd', 'Value': 'Qwe' } } );
} );

Unitest( 'Helpers.addSessionPropRaw()', function ( test ) {
	var obj = {};
	Helpers.addSessionPropRaw( obj, 'Name', 'Asd' );
	test.eq( obj, { Name: 'Asd' } );
	Helpers.addSessionPropRaw( obj, 'Name', 'Qwe' );
	test.eq( obj, { Name: 'Asd' } );

	var obj = { Name: 'Asd' };
	Helpers.addSessionPropRaw( obj, 'Name', 'Qwe' );
	test.eq( obj, { Name: 'Asd' } );
	Helpers.addSessionPropRaw( obj, 'Name', 'Qwe', true );
	test.eq( obj, { Name: 'Qwe' } );

	var obj = { LinkedTokens: [ 'Asd' ] };
	Helpers.addSessionPropRaw( obj, 'LinkedTokens', 'Qwe' );
	test.eq( obj, { LinkedTokens: [ 'Asd' ] } );
	Helpers.addSessionPropRaw( obj, 'LinkedTokens', 'Qwe', true );
	test.eq( obj, { LinkedTokens: [ 'Asd', 'Qwe' ] } );

	var obj = [];
	Helpers.addSessionPropRaw( obj, 'Name', 'Asd' );
	test.eq( obj, [ { Name: 'Asd' } ] );
	Helpers.addSessionPropRaw( obj, 'Name', 'Qwe' );
	test.eq( obj, [ { Name: 'Asd' } ] );
	Helpers.addSessionPropRaw( obj, 'Name', 'Qwe', true );
	test.eq( obj, [ { Name: 'Qwe' } ] );
} );