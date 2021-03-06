"use strict";

var HttpAppRequest = require( 'App/HttpAppRequest' );
var IncomingMessageLogger  = require( './loggers/IncomingMessageLogger' );
var WritableLogger  = require( './loggers/WritableLogger' );
var ConsoleLogger  = require( './loggers/ConsoleLogger' );
var LoggedHttpApp = null;
var Stats = require( 'Stats/Stats' );
var LinkedToken = require( './LinkedToken' );

var _Id = 0;
var _Reqs = new WeakMap();

function GetRqId ( rq ) {
	if ( !_Reqs.has( rq ) ) {
		var id = ++_Id;
		_Reqs.set( rq, id );
		return id;
	}
	return _Reqs.get( rq );
}

class LoggedHttpAppRequest extends HttpAppRequest {

	constructor ( app, req, res, loggingOptions ) {
		
		super( app, req, res );

		this._domain.HttpAppRequest = this;

		this._logPolicy = 'LOG_ALL';

		this._logSession = null;
		this._logStreams = { Stdout: null, Stderr: null };

		this._initOptions = null;
		
		this._stats = new Stats();
		this._stats.startTimer( this, 'Timing.Total' );

		if ( Object.isObject( loggingOptions ) ) {
			this.initLogging( loggingOptions );
		}

	}

	_onHttpRequestStart ( rq, rqprops ) {
		this._stats.startTimer( rq );
		this._stats.addStat( 'Requests.Started', 1 );
	}

	_onHttpRequestError ( rq, rqprops, err ) {
		this._onHttpResponseEnd( rq, rqprops, null, null, err );
	}

	_onHttpResponseError ( rq, rqprops, rs, rsprops, err ) {
		this._onHttpResponseEnd( rq, rqprops, rs, rsprops, err );
	}

	_onHttpResponseEnd ( rq, rqprops, rs, rsprops, err ) {

		var name = rqprops.Name || GetRqId( rq ).toString();
		var t = this._stats.saveTimer( rq, 'Request.' + name + '.Timing' );
		this._stats.addStat( 'Requests.Finished', 1 );

		var name = 'Request.' + ( rqprops.Name || GetRqId( rq ).toString() ) + '.Succeeded';
		var good = this._isResponseOk( rs, err );
		if ( good ) {
			this._stats.addStat( 'Requests.Succeeded', 1 );
		}
		else {
			this._stats.addStat( 'Requests.Failed', 1 );
		}
		this._stats.setStat( name, good );
	}

	_isResponseOk ( rs, err ) {
		return !(err instanceof Error) && rs.statusCode >= 200 && rs.statusCode < 400;
	}

	getStats () {
		return this._stats;
	}

	getInitOptions () {
		return this._initOptions;
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
		var log = this._app.getLog();
		if ( !log ) {
			return false;
		}
		
		options = Object.isObject( options ) ? options : {};

		this._initOptions = options;

		if ( String.isString( options.LogPolicy ) ) {
			this.setLogPolicy( options.LogPolicy );
		}

		if ( this._logPolicy == 'LOG_NOTHING' ) {
			return false;
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

		this._logSession = log.openSession( props );
		this._logSession.setFlushArbiter( this.flushArbiter.bind( this ) );

		this._logSession.on( 'Http.Request.Start', this._onHttpRequestStart.bind( this ) );
		this._logSession.on( 'Http.Request.Error', this._onHttpRequestError.bind( this ) );
		this._logSession.on( 'Http.Response.End', this._onHttpResponseEnd.bind( this ) );
		this._logSession.on( 'Http.Response.Error', this._onHttpResponseError.bind( this ) );

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

		// add link to the parent session, or when it is opened
		this._logSession.on( 'Deferred.Flush', function ( err, logSession ) {
			if ( !err && logSession ) {
				var parentSession = _this.getApp().getLogSession();
				var parentId = parentSession.getId();
				if ( parentId ) {
					parentSession.addLinkedToken( new LinkedToken( LinkedToken.Type.LOGSESSION, LinkedToken.Relation.CHILD, logSession.getId() ) );
					logSession.addLinkedToken( new LinkedToken( LinkedToken.Type.LOGSESSION, LinkedToken.Relation.PARENT, parentId ) );
				}
				else {
					parentSession.on( 'Deferred.Flush', function ( err, parentSession ) {
						if ( !err && logSession ) {
							parentSession.addLinkedToken( new LinkedToken( LinkedToken.Type.LOGSESSION, LinkedToken.Relation.CHILD, logSession.getId() ) );
							logSession.addLinkedToken( new LinkedToken( LinkedToken.Type.LOGSESSION, LinkedToken.Relation.PARENT, parentSession.getId() ) );
						}
					} )
				}
			}
		} );

	}

	finalizeStats () {
		this._stats.saveTimer( this, 'Timing.Total' );
		this._stats.setStat( 'Memory.Usage', process.memoryUsage().rss, 'b' );
		return this._stats;
	}

	flushArbiter ( record ) {
		return this._logPolicy == 'LOG_ALL';
	}

	flushDeferredLogs () {
		this._logSession.flushDeferredLogs();
	}

	onError ( err ) {
		if ( this._logPolicy == 'LOG_ALL_ON_ERROR' ) {
			
			this.setLogPolicy( 'LOG_ALL' );
			this.flushDeferredLogs();

		}

		var logSession = this._logSession;
		if ( logSession ) {
			logSession.write( err, [ 'RECORD_EXCEPTION', 'DATA_TEXT' ] );
		}

		return super.onError( err );
	}

	dispose () {

		if ( this._domain ) {
			
			this.finalizeStats();

			var _this = this;
			for ( let steamName in this._logStreams ) {
				var logStream = this._logStreams[ steamName ];
				if ( logStream ) {
					logStream.close( function () {
						_this._logStreams[ steamName ] = null;
					} );
				}
			}

			var logSession = this._logSession;
			if ( logSession ) {
				if ( this._initOptions.LogEnvironment !== false ) {
					logSession.write( this._stats.getStats(), [ 'RECORD_DEBUG', 'DATA_JSON' ] );
				}
				logSession.close( function () {
					_this._logSession = null;
				} );
			}

			super.dispose();
		}

	}

} 

module.exports = LoggedHttpAppRequest;
