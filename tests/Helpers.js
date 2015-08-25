"use strict";

var Fs = require( 'fs' );

module.exports = {

	removeLogSession: function ( log ) {
		var records = log.getLoggedRecords();
		for ( var i = records.length - 1; i >= 0; --i ) {
			Fs.unlinkSync( log.getStorageUri() + '/' + records[ i ] );
		}
		Fs.rmdirSync( log.getStorageUri() );
	}

};