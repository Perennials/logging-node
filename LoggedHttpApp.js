var HttpApp = require( 'App/HttpApp' );

function LoggedHttpApp () {
	this._loggers = [];

	//todo: hijack stdout/stderr, possibly with a flag, to redirect all output to a log file
}

LoggedHttpApp.extends( HttpApp, {

	// cleanup and then wait for all loggers to finish
	cleanup: function ( ready ) {
		var _this = this;

		HttpApp.prototype.cleanup.call( this, function () {
			var activeLoggers = _this._loggers.length;
			if ( activeLoggers === 0 ) {
				ready();
			}
			else {
				for ( var i = activeLoggers - 1; i >= 0; --i ) {
					_this._loggers[ i ].waitRecords( function () {
						if ( --activeLoggers === 0 ) {
							ready();
						}
					} );
				}
			}
		} );
	},

	onError: function ( err, rqctx ) {
		//todo: log unhandled exceptions
		this.shutdown( 1 );
	},

	onHttpContent: function ( rqctx ) {
		//todo: start a session but where to take the parentid from? check what providerkit is doing.
		//todo: but how to associate console.log() calls with the current domain? process.domain is the current domain according to https://medium.com/unexpected-token/node-js-domains-make-my-app-predictably-fixable-a6f30fb153d7
		//todo: attach new logger
		//todo: log the incomming request and server environment
		//todo: log the response, need to hijack it somehow to mirror all writes to the log
		//todo: when the response is done free the logger
	}

} );

module.exports = LoggedHttpApp;