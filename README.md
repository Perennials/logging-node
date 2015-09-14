Logging
=======
Logging module for Node.js, implementation of <https://perennial.atlassian.net/wiki/display/DV2/Logging>.

The implementation is in `BETA` stage.

<!-- MarkdownTOC -->

- [About](#about)
- [Installation](#installation)
- [Example](#example)
- [API](#api)
	- [Session and record properties](#session-and-record-properties)
		- [Session labels](#session-labels)
		- [Record labels](#record-labels)
	- [LoggedHttpApp](#loggedhttpapp)
		- [Methods](#methods)
			- [Constructor](#constructor)
			- [.getLog()](#getlog)
			- [.getLogSession()](#getlogsession)
			- [.setConfig() / .getConfig()](#setconfig--getconfig)
			- [.onClose()](#onclose)
		- [Logging HTTP requests](#logging-http-requests)
			- [Disabling the logging of a specific request](#disabling-the-logging-of-a-specific-request)
			- [Specifying options for the log record](#specifying-options-for-the-log-record)
	- [LoggedHttpAppRequest](#loggedhttpapprequest)
		- [Public properties](#public-properties)
		- [Methods](#methods-1)
			- [Constructor](#constructor-1)
			- [.dispose()](#dispose)
			- [.onError()](#onerror)
	- [FileLog](#filelog)
		- [Methods](#methods-2)
			- [Constructor](#constructor-2)
			- [.openSession()](#opensession)
			- [.getOpenSessions()](#getopensessions)
			- [.getLoggedSessions()](#getloggedsessions)
			- [.getStorageUri()](#getstorageuri)
			- [.wait()](#wait)
		- [Events](#events)
			- ['Log.Opened'](#logopened)
			- ['Log.Idle'](#logidle)
	- [FileSession](#filesession)
		- [Methods](#methods-3)
			- [.openRecord()](#openrecord)
			- [.getLog()](#getlog-1)
			- [.getId()](#getid)
			- [.getParentId()](#getparentid)
			- [.getProps()](#getprops)
			- [.getStorageUri()](#getstorageuri-1)
			- [.getOpenRecords()](#getopenrecords)
			- [.getLoggedRecords()](#getloggedrecords)
			- [.write()](#write)
			- [.wait()](#wait-1)
			- [.close()](#close)
		- [Events](#events-1)
			- ['Session.Opened'](#sessionopened)
			- ['Session.Open.Error'](#sessionopenerror)
			- ['Session.Idle'](#sessionidle)
			- ['Session.Closed'](#sessionclosed)
	- [FileRecord](#filerecord)
		- [Methods](#methods-4)
			- [.write()](#write-1)
			- [.getId()](#getid-1)
			- [.getUri()](#geturi)
			- [.wait()](#wait-2)
			- [.close()](#close-1)
		- [Events](#events-2)
			- ['Record.Opened'](#recordopened)
			- ['Record.Open.Error'](#recordopenerror)
			- ['Record.Idle'](#recordidle)
			- ['Record.Closed'](#recordclosed)
	- [Deferred logging](#deferred-logging)
		- [DeferredLog](#deferredlog)
		- [DeferredSession](#deferredsession)
		- [DeferredRecord](#deferredrecord)
- [TODO](#todo)
- [Authors](#authors)

<!-- /MarkdownTOC -->


About
-----

The purpose of this module is to bring consistent logging functionality across
the Perennial services with minimal required effort from the developer, while
still providing low level access for custom logging with output according to
the specs.

- Automatic logging of console output.
- Automatic logging of HTTP request.
- Automatic logging of unhandled exceptions.
- Domain sensitive logging - all logging done in the context of an HTTP
  request is associated with this request.
- File writes are buffered until the file is actually opened - so nothing is
  blocked and one can use semi-sync API without any blocking.
- Fully async with support for deferred creation of files and directories -
  nothing will be created until something is actually written.


Installation
------------

```sh
npm install https://github.com/Perennials/logging-node/tarball/master
```


Example
-------

The module provides the [LoggedHttpApp](#loggedhttpapp) class which implements
domain and error handling, as well as hooking of the console output and HTTP
requests. The low level logging classes can be used separately but the
automatic logging capabilities will remain unused. Running this example (it
can be found in the examples directory) and requesting `localhost:1337` will
create log session with a bunch of records.

The [LoggedHttpApp](#loggedhttpapp) class extends
[HttpApp](https://github.com/Perennials/app-node#httpapp) of the [App
module](https://github.com/Perennials/app-node). Check the links for
explanation of the concept of reusing the `HttpApp` class.

```js

var LoggedHttpApp = require( 'Logging/LoggedHttpApp' );
var LoggedHttpAppRequest = require( 'Logging/LoggedHttpAppRequest' );
var FileSession = require( 'Logging/FileSession' );
var Config = require( 'App/Config' );

// this will be instantiated by LoggedHttpApp whenever we have a new request coming in
function MyAppRequest ( app, req, res ) {
	// call the parent constructor
	LoggedHttpAppRequest.call( this, app, req, res );

	// open a log stream, that is file, in which we can write data
	// don't forget to close it or our app will not close
	this._logStream = this.LogSession.openRecord( [ 'RECORD_STREAM', 'DATA_XML' ] );
	this._logStream.write( '<log>\n' );

}

MyAppRequest.extend( LoggedHttpAppRequest, {

	// make sure we clean what we have opened
	// logsession will not be closed properly if we have open streams
	cleanup: function () {
		this._logStream.write( '</log>' );
		this._logStream.close();
	},
	
	onError: function ( err ) {

		// log some line in our stream
		this._logStream.write( '<ERROR>Unhandled error "' + err.message + '"</ERROR>\n' );

		// this will be copied to a file in the log session
		console.error( 'Damn, error happened with this specific client request', this.Request );

		// finish the response so we can close the server
		this.Response.writeHead( 500, {
			'Connection': 'close',
		} );
		this.Response.end();
		this.cleanup();

		// call the default handler, which will log the error and abort the app
		LoggedHttpAppRequest.prototype.onError.call( this, err );
	},


	// this will be called when we have the whole http request
	onHttpContent: function ( content ) {

		// log some line in our stream
		this._logStream.write( '<INFO>HTTP request received</INFO>\n' );

		// write a log record in the context of the HTTP request
		this.LogSession.write( { some: 'json' }, [ 'MyRecord', 'RECORD_GENERIC','DATA_JSON' ] )

		// we have the full request at this point, headers and content
		console.log( 'A request came from', this.Request.headers[ 'user-agent' ], '.' );

		doSomethingWithThe( this.Request, function ( good ) {

			// normal nodejs handling of the response
			this.Response.writeHead( good ? 200 : 500, {
				'Connection': 'close',
				'Content-Type': 'text/plain'
			} );
			this.Response.end( 'bye' );
			this.cleanup();

		} );

	}
} );


// construct a new HttpApp, tell it our request class is MyAppRequest
var app = new LoggedHttpApp( MyAppRequest, '0.0.0.0', 1337 );

// log sessions will be written in the directory pointed by 'storage.log', or the temp directory
app.setConfig( new Config( { storage: { log: __dirname } } ) );

// we can customize the session directory naming
FileSession.DirectoryFormat = 'myapp-{LogSession}{SessionName}';

app.startListening();
```



API
---

### Session and record properties

When opening a session or a record, the corresponding function accepts a list
of properties for the new object. They can be passed either as an object of
key-value pairs or an array of predefined labels. These labels will be
converted to an object with the corresponding key-value pairs. A label is
simply a string and provides a level of abstraction and convenience over the
key-value pairs of the specs.

If a label is not recognized as one of the supported values, it will be
treated as a `Name` for the session or the record.

For example `MyRecordName` will be translated to `Name: 'MyRecordName'`.

- [Session labels](#session-labels)
- [Record labels](#record-labels)

#### Session labels

The meaning of the keys and values is explained
[elsewhere](https://perennial.atlassian.net/wiki/display/DV2/Logging#Logging-Predefinedlogsessionproperties).

- `SESSION_GENERIC`, translates to `SessionType: 'GENERIC'`.
- `SESSION_SERVER_REQUEST`, translates to `SessionType: 'SERVER_REQUEST'`.
- `SESSION_APP_RUN` , translates to `SessionType: 'APP_RUN'`.

#### Record labels

The meaning of the keys and values is explained
[elsewhere](https://perennial.atlassian.net/wiki/display/DV2/Logging#Logging-Predefinedlogrecordproperties).

- `RECORD_META`, translates to `RecordType: 'META'`.
- `RECORD_CLOSE`, translates to `RecordType: 'CLOSE'`.
- `RECORD_GENERIC`, translates to `RecordType: 'GENERIC'`.
- `RECORD_DEBUG`, translates to `RecordType: 'DEBUG'`.
- `RECORD_EXCEPTION`, translates to `RecordType: 'EXCEPTION'`.
- `RECORD_STREAM`, translates to `RecordType: 'STREAM'`.
- `RECORD_SERVER_REQUEST`, translates to `RecordType: 'SERVER_REQUEST'`.
- `RECORD_SERVER_ENV`, translates to `RecordType: 'SERVER_ENV'`.
- `RECORD_SERVER_RESPONSE`, translates to `RecordType: 'SERVER_RESPONSE'`.
- `RECORD_HTTP_REQUEST`, translates to `RecordType: 'HTTP_REQUEST'`.
- `RECORD_HTTP_RESPONSE`, translates to `RecordType: 'HTTP_RESPONSE'`.  
  &nbsp;
- `DATA_BINARY`, translates to `DataType: 'BINARY'`.
- `DATA_JSON`, translates to `DataType: 'JSON'`.
- `DATA_XML`, translates to `DataType: 'XML'`.
- `DATA_TEXT`, translates to `DataType: 'TEXT'`.
- `DATA_HTML`, translates to `DataType: 'HTML'`.
- `DATA_JPEG`, translates to `DataType: 'JPEG'`.
- `DATA_PNG`, translates to `DataType: 'PNG'`.


### LoggedHttpApp
Extends [HttpApp](https://github.com/Perennials/app-node#httpapp). This is the
main application class. It takes care of hooking the console output and HTTP
requests of the application. The logging is domain aware and cooperates with
[LoggedHttpAppRequest](#loggedhttpapprequest) - so the logs will be saved in
the context of the current `LoggedHttpAppRequest`, if any. If there is no
current request context the logs will be saved in the application level log
session.

```js
var LoggedHttpApp = require( 'Logging/LoggedHttpApp' );
```

- [Methods](#methods)
- [Logging HTTP requests](#logging-http-requests)

#### Methods

- [Constructor](#constructor)
- [.getLog()](#getlog)
- [.getLogSession()](#getlogsession)
- [.setConfig() / .getConfig()](#setconfig--getconfig)
- [.onClose()](#onclose)


##### Constructor
The `appRequest` parameter is a constructor for a class derived
`LoggedHttpAppRequest`. The rest of the parameter are used when creating an
HTTP server and are passed directly to `http.Server.listen()`.

The constructor will instantiate an empty
[Config](https://github.com/Perennials/app-node#config) object.

The constructor will create a [DeferredLog](#deferredlog) and
[DeferredSession](#deferredsession). That is an application log session. Log
outside the context of an HTTP request (i.e.
[LoggedHttpAppRequest](#loggedhttpapprequest)) will be saved in this session.
The session directory will only be created if any data is actually logged. It
will be created in the location pointed by the config entry named
`storage.log`, or default to the system's temp directory.

**Remarks:** Upon constructing an instance all console output and HTTP
requests will be hooked. The side effect of this is that two instances of this
class can not be constructed at the same time. Constructing a second instance
of this class requires `.close()`ing the first instance in order to work
properly.


```js
new LoggedHttpApp (
	appRequest:HttpAppRequest,
	host:String
	port:Number
);
```


##### .getLog()
Retrieves the log engine associated with the application.

```js
.getLog() : DeferredLog;
```


##### .getLogSession()
Retrieves the log session associated with the application.

```js
.getLogSession() : DeferredSession;
```


##### .setConfig() / .getConfig()
Sets the config associated with the application. It is
[Config](https://github.com/Perennials/app-node#config) from the the [App
module](https://github.com/Perennials/app-node).

```js
.setConfig(
	config:Config
) : this;

.getConfig() : Config;
```


##### .onClose()
Implements a close handler for the application. It will close all log sessions
created by the application and the `LoggedHttpAppRequest`s.

```
.onClose();
```


#### Logging HTTP requests
Normally HTTP requests will be hooked by the [LoggedHttpApp](#loggedhttpapp)
class and will be logged automatically. One can control the logging of these
requests by placing a property called `LogRecord` inside the options passed to
node's `http.request()` function.

- [Disabling the logging of a specific request](#disabling-the-logging-of-a-specific-request)
- [Specifying options for the log record](#specifying-options-for-the-log-record)

##### Disabling the logging of a specific request

To skip the logging of an HTTP request pass `LogRecord: false`.

```js
var http = require( 'http' );
var request = http.request( {
	method: 'GET',
	host: 'perennial.de',
	port: 80,
	LogRecord: false
} );
// ...
```

##### Specifying options for the log record

If the `LogRecord.RequestProps` and `LogRecord.ResponseProps` is an object or
an array, it will be passed directly to the [.openRecord()](#openrecord)
function. Changing the data type or the record type is not recommended, but
one can change the name in order to be able to identify a specific request
easily.

```js
var http = require( 'http' );
var request = http.request( {
	method: 'GET',
	host: 'perennial.de',
	port: 80,
	LogRecord: { 
		RequestProps: { Name: 'MyRequest' }, 
		ResponseProps: { Name: 'MyResponse' }
	}
} );
// ...
```


### LoggedHttpAppRequest
Extends [HttpAppRequest](https://github.com/Perennials/app-node#httpapprequest).

This class should be derived and the constructor passed to the constructor of
`LoggedHttpApp`. A new instance will be created for each incoming HTTP
request.

```js
var LoggedHttpAppRequest = require( 'Logging/LoggedHttpAppRequest' );
```

- [Public properties](#public-properties)
- [Methods](#methods-1)

#### Public properties

```js
{
	LogSession: DeferredSession
	LogStreams: {
		Stdout: DeferredRecord,
		Stderr: DeferredRecord
	}
}
```

#### Methods

- [Constructor](#constructor-1)
- [.dispose()](#dispose)
- [.onError()](#onerror)

##### Constructor
Should not be used directly, but only called in the constructor of the derived
classes in order to perform the default initialization and domain handling.

```js
new LoggedHttpAppRequest(
	app: LoggedHttpApp,
	req: http.IncommingMessage,
	res: http.ServerResponse,
);
```

##### .dispose()
Normally this function will be called by the `.onClose()` handler of the
application. It will close the log session associated with HTTP request and
dispose the domain.

```js
.dispose();
```

##### .onError()
The default domain error handler will log the error as `EXCEPTION` in the
session and then call the parent handler which will print the error to
`stderr` and close the application.

```js
.onError( err:Error );
```


### FileLog
This class is part of the low-level API and normally shouldn't be used
directly, but only via [LoggedHttpApp](#loggedhttpapp) and
[LoggedHttpAppRequest](#loggedhttpapprequest).

```js
var FileLog = require( 'Logging/FileLog' );
```


#### Methods

- [Constructor](#constructor-2)
- [.openSession()](#opensession)
- [.getOpenSessions()](#getopensessions)
- [.getLoggedSessions()](#getloggedsessions)
- [.getStorageUri()](#getstorageuri)
- [.wait()](#wait)


##### Constructor
Constructor. `storageUri` is a directory where sessions will be created.
`callback` will be called when the underlying file is opened and ready for
use. The `err` parameter will be populated if there was problem while
verifying the storage path passed to the constructor, in which case the
system's temp directory will be used as storage location.

```js
new FileLog(
	storageUri:String,
	callback:function( err:Error|null, log:FileLog )|undefined
);
```


##### .openSession()
Creates a new FileSession. It will be created as a subdirectory in the
location specified for the LogLog. The naming of the directory is determined
by a static property `FileSession.DirectoryFormat`.

```js
.openSession(
	parentId:String|null,
	props:Object|String[],
	callback:function( err:Error|null, session:FileSession )|undefined
) : FileSession;
```

Argument | Description
:------- | :----------
`props` | A [list of properties or labels](#session-and-record-properties) for the session.
`parentId` | An id of the parent log session, if any.
`callback` | A function to be notified when the session is opened and ready for use (or when an error prevented this from happening). Since a meta record will be created upon opening the session, the callback will be invoked after the record is created and if it fails the `err` argument will be populated but the `session` will be open and valid.


##### .getOpenSessions()
Retrieves the list of currently opened sessions for this log engine. Could be
empty.

```js
.getOpenedSessions() : FileSession[];
```


##### .getLoggedSessions()
Retrieves the list of log sessions that were closed. Could be empty.

```js
.getLoggedSessions() : String[];
```


##### .getStorageUri()
Retrieves the path of the log session directory where log records will be written.

```js
.getStorageUri() : String;
```


##### .wait()
Notifies a callback when the log is idle, that is when there are no more open
log sessions. May be called immediately (on the next tick) if there are no
open sessions.

```js
.wait(
	callback:function()|undefined
);
```


#### Events

- ['Log.Opened'](#logopened)
- ['Log.Idle'](#logidle)


##### 'Log.Opened'
Emitted when the log is opened and ready for use. The `err` parameter will be
populated if there was problem while verifying the storage path passed to the
constructor, in which case the system's temp directory will be used as storage
location.

```js
function (
	err:Error|null
	log:FileLog
);
```


##### 'Log.Idle'
Emitted each time the last open child session is closed.

```js
function (
	log:FileLog
);
```


### FileSession
This class is part of the low-level API and normally shouldn't be used
directly, but only via [LoggedHttpApp](#loggedhttpapp) and
[LoggedHttpAppRequest](#loggedhttpapprequest).

```js
var FileSession = require( 'Logging/FileSession' );
```

- [Methods](#methods-3)
- [Events](#events-1)

#### Methods

- [.openRecord()](#openrecord)
- [.getLog()](#getlog-1)
- [.getId()](#getid)
- [.getParentId()](#getparentid)
- [.getProps()](#getprops)
- [.getStorageUri()](#getstorageuri-1)
- [.getOpenRecords()](#getopenrecords)
- [.getLoggedRecords()](#getloggedrecords)
- [.write()](#write)
- [.wait()](#wait-1)
- [.close()](#close)

##### .openRecord()
Opens a new [FileRecord](#filerecord) in the session. The record will be writeable
immediately but the writes will be buffered until the file is actually opened
when they will be flushed.

```js
.openRecord(
	props:Object|String[],
	callback:function( err:Error|null, record:FileLog|null )|undefined
) : FileRecord;
```

Argument | Description
:------- | :----------
`props` | A [list of properties or labels](#session-and-record-properties) for the record.
`callback` | A function to be notified when the record is opened and ready for use (or when an error prevented this from happening).


##### .getLog()
Retrieves the file log instance associated with this session.

```js
.getLog() : FileLog;
```


##### .getId()
Retrieves the id of the session. The id is the same as the directory name.

```js
.getId() : String;
```


##### .getParentId()
Retrieves the parent session id, if any.

```js
.getParentId() : String|null;
```


##### .getProps()
Retrieves the properties that describe the session.

```js
.getProps() : Object|String[]|null;
```


##### .getStorageUri()
Retrieves the full path of the session directory.

```js
.getStorageUri() : String;
```


##### .getOpenRecords()
Retrieves the list of currently open records in this session. Could be empty.

```js
.getOpenRecords() : FileRecord[];
```


##### .getLoggedRecords()
Retrieves the list of past records, that is records that were closed. Could be empty.

```js
.getLoggedRecords() : String[];
```


##### .write()
This is a convenience function for opening a record, writing a piece of data in it and
closing the record. It just uses the other APIs of the class to achieve this. The `data`
parameter is the data to be written, the other arguments are passed directly to 
[.openRecord()](#openrecord).

```js
.write(
	data:Buffer|String,
	props:Object|String[],
	callback:function( err:Error|null )|undefined
);
```

Argument | Description
:------- | :----------
`props` | A [list of properties or labels](#session-and-record-properties) for the record.
`callback` | A function to be notified when the record is opened and ready for use (or when an error prevented this from happening).


##### .wait()
Notifies the specified callback when the session becomes idle, that is when
there are no more open records. If there are no open records the callback will
be called immediately (upon next tick).

```js
.wait(
	callback:function()|undefined
);
```


##### .close()
Closes the session. The session will not be closed while there are still open
records and they will not be forcefully closed. This module will close
everything opened by it when the application is closed, but the user is
responsible for closing any records he/she opened manually. This function will
actually invoke `.wait()` and continue when all the records are closed.

```js
.close(
	callback:function( err:Error|null, session:FileSession )|undefined
);
```


#### Events

- ['Session.Opened'](#sessionopened)
- ['Session.Open.Error'](#sessionopenerror)
- ['Session.Idle'](#sessionidle)
- ['Session.Closed'](#sessionclosed)

##### 'Session.Opened'
Emitted when the session is successfully opened and ready for use. Since a
'meta' record will be created upon opening the session, the callback will be
invoked after the record is created and if it fails the `err` argument will be
populated but the `session` will be open and valid.

```js
function (
	err:Error|null,
	session:FileSession
);
```


##### 'Session.Open.Error'
Emitted if an error prevented the session from opening.

```js
function (
	err:Error|null,
	session:FileSession
);
```


##### 'Session.Idle'
Emitted every time the last open record of this session is closed.

```js
function (
	session:FileSession
);
```


##### 'Session.Closed'
Emitted after the session was closed. Since a 'close' record will be created
upon closing the session, the callback will be invoked after the record is
created and if it fails the `err` argument will be populated but the `session`
will still be closed.

```js
function (
	err:Error|null,
	session:FileSession
);
```


### FileRecord
This class is part of the low-level API and normally shouldn't be used
directly, but only via [LoggedHttpApp](#loggedhttpapp) and
[LoggedHttpAppRequest](#loggedhttpapprequest).

```js
var FileRecord = require( 'Logging/FileRecord' );
```

#### Methods

- [.write()](#write-1)
- [.getId()](#getid-1)
- [.getUri()](#geturi)
- [.wait()](#wait-2)
- [.close()](#close-1)

##### .write()
Writes a chunk of data in the file and notifies a callback when the data is
flushed to the disk.

```js
.write(
	data:Buffer|String,
	callback:function( err:Error|null )|undefined
);
```

##### .getId()
Retrieves the id of the record, it is the same as the file name within the
session directory.

```js
.getId() : String;
```


##### .getUri()
Retrieves the full path of the underlying file of this record.

```js
.getUri() : String;
```


##### .wait()
Notifies the specified callback when the record becomes idle, that is when all
data from previous writes is flushed to the disk. If there are no pending
writes the callback will be called immediately (upon next tick).

```js
.wait(
	callback:function()|undefined
);
```

##### .close()
Closes the record. The user is responsible for closing all manually open
records. Not closing them may result in the inability to close the application
and waiting forever.

```js
.close(
	callback:function( err:Error|null, record:FileRecord )|undefined
);
```

#### Events

- ['Record.Opened'](#recordopened)
- ['Record.Open.Error'](#recordopenerror)
- ['Record.Idle'](#recordidle)
- ['Record.Closed'](#recordclosed)

##### 'Record.Opened'
Emitted when the record is successfully opened and ready for use.

```js
function (
	err:Error|null,
	record:FileRecord
);
```


##### 'Record.Open.Error'
Emitted if an error prevented the record from opening.

```js
function (
	err:Error|null,
	record:FileRecord
);
```


##### 'Record.Idle'
Emitted every time the last chunk of data queued to be written is flushed
to the disk.

```js
function (
	record:FileRecord
);
```


##### 'Record.Closed'
Emitted after the record was closed.

```js
function (
	err:Error|null,
	record:FileRecord
);
```


### Deferred logging

Three classes are implemented for deferred logging. These are `DeferredLog`,
`DeferredSession` and `DeferredRecord`. They are analogous to `FileLog`,
`FileSession` and `FileRecord` and actually wrap them. Deferred logs serve two
purposes:

1. To provide convenient synchronous API - unlike the underlying file sessions
   and file records, the deferred sessions and records can be used immediately
   after the object is constructed and there is no need to wait for a ready
   callback. Operations will buffered and will be flushed to the disk as soon
   as the directory is created or the file is opened.
2. To reduce clutter and improve performance - opening a deferred session or
   deferred record will not actually write anything to the disk until the
   first time some data is written in a deferred record. After the first write
   the session and the record will be created on the disk.

These classes expose mostly the same API as their underlying file classes
should be able to replace them without changing the logic. But the opposite
may not be always possible - since the file sessions and records rely on a
callback to notify the user when the resources are actually ready for use. If
one is using the deferred classes in a synchronous manner, that is without the
ready callbacks in the constructors or in the `.openSession()` /
`.openRecord()` functions, replacing the deferred classes with file classes
will result in errors.



#### DeferredLog

This class is part of the low-level API and normally shouldn't be used
directly, but only via [LoggedHttpApp](#loggedhttpapp) and
[LoggedHttpAppRequest](#loggedhttpapprequest).

This class exposes the same methods and events as the [FileLog](#filelog),
except for `.getStorageUri()`. All callbacks and events will receive
references to the `DeferredLog` and the wrapped `FileLog` can be accessed via
`.getLog()` method. One should refer to the documentation of `FileSession`.

```js
var DeferredLog = require( 'Logging/DeferredLog' );
```


#### DeferredSession

This class is part of the low-level API and normally shouldn't be used
directly, but only via [LoggedHttpApp](#loggedhttpapp) and
[LoggedHttpAppRequest](#loggedhttpapprequest).

This class exposes the same methods and events as the
[FileSession](#filesession). All callbacks and events will receive references
to the `DeferredSession` and the wrapped `FileSession` can be accessed via
`.getLogSession()` method. One should refer to the documentation of `FileSession`.

```js
var DeferredSession = require( 'Logging/DeferredSession' );
```


#### DeferredRecord

This class is part of the low-level API and normally shouldn't be used
directly, but only via [LoggedHttpApp](#loggedhttpapp) and
[LoggedHttpAppRequest](#loggedhttpapprequest).

This class exposes the same methods and events as the
[FileRecord](#filerecord). All callbacks and events will receive references to
the `DeferredRecord` and the wrapped `FileRecord` can be accessed via
`.getLogRecord()` method. One should refer to the documentation of `FileRecord`.

```js
var DeferredRecord = require( 'Logging/DeferredRecord' );
```


TODO
----

- When hooking `http.IncommingMessage` the body should be human readable, not
  chunked or compressed, but I'm not sure because for repeating the request
  is better to have the exact replica, for human inspection and testing it
  needs to be readable and the `content-length` needs to be adjusted.
- Would be cool to document everything precisely, including the interfaces and
  the deferred classes. Also the logic of the deferred classes is slightly
  different and they don't emit the `.Open.Error` event, which could cause
  problems.
- Split docs into different files? This one is too long.
- Be able to configure how much stuff to log. For Perennial services
  everything should be logged, but for example for generic tool like sync
  scripts or something only debug information should be logged.
- Keep memory stats somehow?
- Keep timings of the requests.
- The deferred api should be the same as the real one. Meaning open event in
  the ctor together with the callback and different event for real open.



Authors
-------
Borislav Peev (borislav.asdf at gmail dot com)
