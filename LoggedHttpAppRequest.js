"use strict";

var HttpAppRequest = require( 'App/HttpAppRequest' );
var IncomingMessageLogger  = require( './loggers/IncomingMessageLogger' );
var WritableLogger  = require( './loggers/WritableLogger' );
var ConsoleLogger  = require( './loggers/ConsoleLogger' );
var LoggedHttpApp = null;

class LoggedHttpAppRequest extends HttpAppRequest {

	constructor ( app, req, res, loggingOptions ) {
		
		super( app, req, res );

		this._domain.HttpAppRequest = this;

		this._logPolicy = 'LOG_ALL';

		// this is public because LoggedHttpApp needs it
		this._logSession = null;
		this._logStreams = { Stdout: null, Stderr: null };

		if ( Object.isObject( loggingOptions ) ) {
			this.initLogging( loggingOptions );
		}

	}

	setLogPolicy ( policy ) {
		this._logPolicy = policy;
		return this;
	}

	getLogPolicy () {
		return this._logPolicy;
	}

	getLogSession () {
		return this._logSession;
	}

	getLogStream ( name ) {
		return this._logStreams[ name ];
	}

	initLogging ( options ) {
		options = Object.isObject( options ) ? options : {};

		if ( String.isString( options.LogPolicy ) ) {
			this.setLogPolicy( options.LogPolicy );
		}

		var _this = this;

		var props = [ 'SESSION_SERVER_REQUEST' ];
		var sessionProps = options.SessionProps;
		if ( sessionProps instanceof Array ) {
			props = sessionProps.concat( props );
		}
		else if ( sessionProps instanceof Object ) {
			props.push( sessionProps );
		}

		this._logSession = this._app.getLog().openSession( props );
		this._logSession.setFlushArbiter( this.flushArbiter.bind( this ) );

		if ( options.LogEnvironment !== false ) {
			// log the server environment
			LoggedHttpApp = LoggedHttpApp || require( './LoggedHttpApp' );
			LoggedHttpApp.logServerEnv( this._logSession );
		}
		
		if ( options.LogHttp !== false ) {
			// log req
			new IncomingMessageLogger( this._request, this._logSession.openRecord( [ 'RECORD_SERVER_REQUEST', 'DATA_TEXT' ] ), options.UnchunkHttp );

			// log res
			new WritableLogger( this._response.connection, this._logSession.openRecord( [ 'RECORD_SERVER_RESPONSE', 'DATA_TEXT' ] ), options.UnchunkHttp );
		}

		if ( options.LogConsole !== false ) {

			// defer all log streams - open them on the first write
			// stdout and stderr are hooked in the LoggedHttpApp class and the call is redirected to the current domain
			this._logStreams = {
				Stdout: this._logSession.openRecord( [ 'STDOUT', 'RECORD_STREAM', 'DATA_TEXT' ] ),
				Stderr: this._logSession.openRecord( [ 'STDERR', 'RECORD_STREAM', 'DATA_TEXT' ] ),
			};
		}
	}

	flushArbiter ( record ) {
		return true;
	}

	onError ( err ) {
		var logSession = this._logSession;
		if ( logSession ) {
			logSession.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ] );
		}
		super.onError( err );
	}

	dispose () {

		if ( this._domain ) {

			for ( var steamName in this._logStreams ) {
				this._logStreams[ steamName ].close();
			}

			var logSession = this._logSession;
			if ( logSession ) {
				logSession.close();
			}

			super.dispose();
		}

	}

} 

module.exports = LoggedHttpAppRequest;
