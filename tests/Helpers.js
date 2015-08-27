"use strict";

var Fs = require( 'fs' );

module.exports = {

	removeLogSession: function ( session ) {
		var records = session.getLoggedRecords();
		for ( var i = records.length - 1; i >= 0; --i ) {
			Fs.unlinkSync( session.getStorageUri() + '/' + records[ i ] );
		}
		Fs.rmdirSync( session.getStorageUri() );
	}

};