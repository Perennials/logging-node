"use strict";

var HttpAppRequest = require( 'App/HttpAppRequest' );
var FileLog = require( './FileLog' );

function LoggedHttpAppRequest ( app, req, res ) {
	var _this = this;
	this.Log = null;
	this.Stdout = null;
	this.Stderr = null;

	function finishInit () {
		HttpAppRequest.call( _this, app, req, res );
		_this.Domain.HttpAppRequest = _this;
	}

	// open all log streams first otherwise we can miss console.log()s for this domain
	new FileLog( app.getConfig().get( 'storage.log' ), function ( err, log ) {
		if ( err ) {
			finishInit();
			return;
		}
		
		//todo: get the parent session from somewhere
		log.startSession( null, null, function ( err, id ) {
			if ( err ) {
				finishInit();
				return;
			}

			_this.Log = log;

			var streamsToGo = 2;
			// open stdout file to mirror console.log()
			log.openStream( { Name: 'STDOUT', DataType: 'TEXT' }, function ( err, stream ) {
				if ( !err ) {
					_this.Stdout = stream;
				}
				if ( --streamsToGo == 0 ) {
					finishInit();
				}
			} );

			// open stderr file to mirror console.error()
			log.openStream( { Name: 'STDERR', DataType: 'TEXT' }, function ( err, stream ) {
				if ( !err ) {
					_this.Stderr = stream;
				}
				if ( --streamsToGo == 0 ) {
					finishInit();
				}
			} );
		} );
	} );
}

LoggedHttpAppRequest.extend( HttpAppRequest, {

	onError: function ( err ) {
		if ( this.Log ) {
			this.Log.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ] );
		}
		HttpAppRequest.prototype.onError.call( this, err );
	},

	dispose: function () {
		
		//todo: it is cool to .close() but if there is something that started in the same domain and it does logging we will miss this
		if ( this.Stdout ) {
			this.Stdout.close();
		}
		if ( this.Stderr ) {
			this.Stderr.close();
		}

		HttpAppRequest.prototype.dispose.call( this );
	},

	onHttpContent: function ( content ) {

		
		
		//todo: log the incomming request and server environment
		//todo: log the response. need to hijack it somehow to mirror all writes to the log
	}

} );

module.exports = LoggedHttpAppRequest;