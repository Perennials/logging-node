Logs structure (v0.11)
----------------------

Logs are saved in a very generic structure which allows saving any type of data and creating custom conventions for the need of the applications. There are only two units in this structure - **log sessions** and **log records**.

![Diagram](/specs/log-structure.png?raw=true)

### Sessions
A **log session** is a logical group of **log records**. Usually it corresponds to a request to the server. So one request equals one log session. Log sessions can be linked together in parent-child relationship. This way different requests, for different purpose, made at different time, possibly to different applications, can be linked together. For example the client can initiate a search and start a log session, it then sends the **log session id** to the backend together with the search request. The backend starts a new log session which is a child to the log session started by the client. The backend can make new requests to other components with their own log sessions and be their parent session. The next day maybe a booking is performed which is again linked to the appropriate parent log session. This way all logs of a logical workflow can be grouped together and tracked. The session is also assigned a list of properties as key-value pairs used to describe the session so the Log Analyser can properly work with it. The key-value properties can be used to create conventions for the need of the applications. Bellow a list of predefined keys and values is given, which the Log Analyser and the Log UI are able to recognise in the context of Perennial's field of work.

#### Predefined log session properties

##### Name
An optional name for the log session. Can be used by the developers in order to distinguish their sessions.

- Type: `string`
- Values: [a-zA-Z0-9_]

##### SessionType
Describes the logical type of the sesion.

- Type: `string`
- Values:
  - `GENERIC` - A generic session.
  - `SERVER_REQUEST` - A session holding the records in the context of a
    server request.
  - `APP_RUN` - A session holding records in the context of an application
    run. In other words logs that are outside the context of a server request.

##### LinkedTokens
One or more tokens that represent links to other log sessions. Sometimes sessions can not be linked via parent-child relationship because of different reasons. Log sessions having the same token are linked together, meaning they belong to the same flow and should be treated as part of the same log session tree. It is outside the scope of this document to define how to ensure that the tokens will remain unique to the application that generated them.

- Type: `string[]`
- Values: any

### Records
A **log session** can hold multiple **log records**. Log records has unique **log record id** within the session. They hold some kind of data (XML, JSON, etc.), and a list of properties as key-value pairs used to describe the record so the log analyser can properly work with it. The key-value properties can be used to create conventions for the need of the applications. Bellow a list of predefined keys and values is given, which the Log Analyser and the Log UI are able to recognise in the context of Perennial's field of work.

#### Predefined log record properties

##### Name
An optional name for the log record. Can be used by the developers in order to distinguish their records.

- Type: `string`
- Values: [a-zA-Z0-9_]

##### DataType
Describes the data held by the log record.

- Type: `string`
- Values: The table lists the known data types and corresponding file extensions used for these types by the file backend, and also the MIME types corresponding to these types used when the data type is to be inferred automatically.

Value | File extension | MIME type(s)
----- | -------------- | ------------
`BINARY` | `.bin` | `application/binary`, `application/octet-stream`
`XML` | `.xml` | `text/xml`, `application/xml`
`JSON` | `.json` | `application/json`
`TEXT` | `.txt` | `text/plain`
`HTML` | `.html` | `text/html`

##### DataEncoding
Describes the way the record's data is encoded, e.g. compressed.

- Type: `string`
- Values: reseved for future use.

##### RecordType
Describes the logical type of the record.

- Type: `string`
- Values: see the table.
  - `META` - A record containing meta information about the session.

    ```js
    {
    	// Log specs version.
        Api: "<string>",
    
        // The API that generated the logs.
        ApiVersion: "<string>",
    
        // API version.
        LogSpecs: "<string>",
    
        // Log session id.
        LogSession: "<string>",
    
        // Parent log session id.
        ParentSession: "<string>|null",
    
        // Tokens that associate this log session with other log sessions.
        LinkedTokens: "<string>[]",
    
        // Logical type of the session.
        SessionType: "<string>|null",
    
        // Time when the session was opened. ISO8601 string.
        TimeStamp: "<DateTime>"
    }
    ```
  - `CLOSE` - A record that is created when the session is successfully closed.
  
    ```js
    {
  	    // Time when the session was closed. ISO8601 string.
        TimeStamp: "<DateTime>"
    }
    ```
  - `GENERIC` - A generic record.
  - `DEBUG` - A record containing some kind of debug information, usually statistics and similar collected by the application or the SDK. In no particular format at this time (2015-08-22).
  - `EXCEPTION` - A record containing information about exception or error that occurred within the application.
  - `STREAM` - A record representing a stream. An example would be if the standard console output of the application is saved as a log record, or the developer creates a file/memory stream to incrementally log information.
  - `SERVER_REQUEST` - A record holding the request that was sent to the server.
  - `SERVER_ENV` - A record holding information about the server environment when the request was received.
  - `SERVER_RESPONSE` - A record holding the response to the incoming request.
  - `HTTP_REQUEST` - A record representing an HTTP request sent by the application.
  - `HTTP_RESPONSE` - A record representing an HTTP response received as a result of an `HTTP_REQUEST`.
  - `PHP_ERROR_LOG` - An `error.log` file generated by PHP.

##### Data
The actual data for the record, e.g. some XML data or JSON data.

- Type: `string[]`
- Values: any


File backend
------------

### Directory structure
Each log session is stored in its own directory and all log records live as files within this directory.

```
/app/store/log/{LogSession}/{LogRecords}...
```

The name of the log session is composed of the app name and app instance identifier, unique id and optional session name.

```
/app/store/log/{Id}-{Name}-{App}.{Version}-{Instance}/...
```

### File stucture
The name of the log records is composed of a sequential record number, the record type, optional name and file extension based on the data type (e.g. JSON = .json, TEXT = .txt).

```
/app/store/log/jisd83k9--ws2.10-1/{N}-{RecordType}-{Name}.{DataType}
```

When the session is created together with it a META record is created. All other records are optional. A missing CLOSE record indicates either the session is still open, or the session was not closed properly, or the application crashed without being able to close the session.

```
/app/store/log/jisd83k9--ws2.10-1/1-META-.json
/app/store/log/jisd83k9--ws2.10-1/2-SERVER_ENV-.json
/app/store/log/jisd83k9--ws2.10-1/3-SERVER_REQUEST-.txt
/app/store/log/jisd83k9--ws2.10-1/4-SERVER_RESPONSE-.txt
/app/store/log/jisd83k9--ws2.10-1/5-STREAM-STDOUT.txt
/app/store/log/jisd83k9--ws2.10-1/6-STREAM-STDERR.txt
/app/store/log/jisd83k9--ws2.10-1/7-CLOSE-.json
```

Authors
-------
Borislav Peev (borislav.asdf at gmail dot com)
