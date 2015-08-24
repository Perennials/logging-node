var HttpApp = require( 'App/HttpApp' );
var Config = require( 'App/Config' );
var LoggedHttpAppRequest = require( './LoggedHttpAppRequest' );

function LoggedHttpApp ( appRequest, host, port ) {
	this._config = new Config();
	this._ogStdoutWrite = null;
	this._ogStdoutEnd = null;
	this._ogStderrWrite = null;
	this._ogStderrEnd = null;

	// hijack stdout/stderr so all console.log() and similar can be intercepted
	if ( process.stdout ) {
		this._ogStdoutWrite = process.stdout.write;
		this._ogStdoutEnd = process.stdout.end;
		process.stdout.write = this._stdoutWrite.bind( this );
		process.stdout.end = this._stdoutEnd.bind( this );
	}
	if ( process.stderr ) {
		this._ogStderrWrite = process.stderr.write;
		this._ogStderrEnd = process.stderr.end;
		process.stderr.write = this._stderrWrite.bind( this );
		process.stderr.end = this._stdoutEnd.bind( this );
	}

	HttpApp.call( this, appRequest || LoggedHttpAppRequest, host, port )
}

LoggedHttpApp.extend( HttpApp, {

	// double stdout write
	_stdoutWrite: function () {
		var stdout = null;
		if ( (stdout = process.stdout) ) {
			this._ogStdoutWrite.apply( stdout, arguments );
		}
		var domain = process.domain;
		if ( domain && (stdout = domain.HttpAppRequest.Stdout) ) {
			stdout.write.apply( stdout, arguments );
		}
	},

	// double stdout end
	_stdoutEnd: function () {
		var stdout = null;
		if ( (stdout = process.stdout) ) {
			this._ogStdoutEnd.apply( stdout, arguments );
		}
		var domain = process.domain;
		if ( domain && (stdout = domain.HttpAppRequest.Stdout) ) {
			stdout.end.apply( stdout, arguments );
		}
	},

	// double stderr write
	_stderrWrite: function () {
		var stderr = null;
		if ( (stderr = process.stderr) ) {
			this._ogStderrWrite.apply( stderr, arguments );
		}
		var domain = process.domain;
		if ( domain && (stderr = domain.HttpAppRequest.Stderr) ) {
			stderr.write.apply( stderr, arguments );
		}
	},

	// double stderr end
	_stderrEnd: function () {
		var stderr = null;
		if ( (stderr = process.stderr) ) {
			this._ogStderrEnd.apply( stderr, arguments );
		}
		var domain = process.domain;
		if ( domain && (stderr = domain.HttpAppRequest.Stderr) ) {
			stderr.end.apply( stderr, arguments );
		}
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