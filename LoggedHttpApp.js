var HttpApp = require( 'App/HttpApp' );
var Config = require( 'App/Config' );
var LoggedHttpAppRequest = require( './LoggedHttpAppRequest' );

function LoggedHttpApp ( appRequest, host, port ) {
	this._config = new Config();

	// hijack stdout/stderr so all console.log() and similar can be intercepted
	if ( process.stdout ) {
		this._hookStreamCopierFn( process.stdout, 'write', 'Stdout' )
		this._hookStreamCopierFn( process.stdout, 'end', 'Stdout' )
	}
	if ( process.stderr ) {
		this._hookStreamCopierFn( process.stderr, 'write', 'Stderr' )
		this._hookStreamCopierFn( process.stderr, 'end', 'Stderr' )
	}

	HttpApp.call( this, appRequest || LoggedHttpAppRequest, host, port )
}

LoggedHttpApp.extend( HttpApp, {

	_hookStreamCopierFn: function ( stream, streamCallName, appRqStreamName ) {

		var originalCall = stream[ streamCallName ];
		
		stream[ streamCallName ] = function () {

			// call the originall .write() or .end()
			var ret = originalCall.apply( stream, arguments );

			// call .write() or .end() on the log file
			var domain = process.domain;
			var appRqStream = null;
			if ( domain && (appRqStream = domain.HttpAppRequest.LogStreams[ appRqStreamName ]) ) {
				appRqStream[ streamCallName ].apply( appRqStream, arguments );
			}

			return ret;
		};
	},

	getConfig: function () {
		return this._config;
	},

	// cleanup and then wait for all loggers to finish
	onClose: function ( callback ) {
		var _this = this;

		// close the server and when this is done
		HttpApp.prototype.onClose.call( this, function () {
			var activeLoggers = _this._requests.length;
			if ( activeLoggers === 0 ) {
				if ( callback instanceof Function ) {
					process.nextTick( callback );
				}
			}
			else {
				// wait for all loggers. they will not finish before we close our stdout and stderr
				// so make sure we try to finalize and close everything after the .end() call
				for ( var i = activeLoggers - 1; i >= 0; --i ) {
					var request = _this._requests[ i ];
					if ( request.Log === null ) {
						if ( --activeLoggers === 0 ) {
							if ( callback instanceof Function ) {
								process.nextTick( callback );
							}
						}
						continue;
					}
					request.dispose();
					request.Log.waitRecords( function () {
						if ( --activeLoggers === 0 ) {
							if ( callback instanceof Function ) {
								process.nextTick( callback );
							}
						}
					} );
				}
			}
		} );
	}

} );

module.exports = LoggedHttpApp;