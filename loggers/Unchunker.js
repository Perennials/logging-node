"use strict";

var Fs = require( 'fs' );
var Zlib = require( 'zlib' );

const TRAILER = '\r\n\r\n';
const PADDING = 16;

class Unchunker {

	constructor ( dest, literalChunkSize ) {
		this._dest = dest;
		this._headers = [];
		this._zlib = null;
		this._unchunk = false;
		this._savedPos = 0;
		this._messageSize = 0;
		this._zlibWrites = 0;
		this._closed = false;
		this._literalChunkSize = literalChunkSize;
		this._leftOvers = null;
		this._lastChunk = false;
		this.write = this._bufferHeaders;
		this._onZlibChunk = this._onZlibChunk.bind( this );
	}

	static _headersHasEnded ( headers ) {
		var length = 0;
		var last = headers.last;

		if ( headers[ 0 ].startsWith( 'GET' ) ) {
			return true;
		}

		if ( last.indexOf( TRAILER ) ) {
			return true;
		}

		// get 3 bytes from the last chunk. no need to get 4 since we know we don't have full trailer there
		var n = Math.min( last.length, 3 );
		length += n;
		var chunks = [];
		chunks.push( last.slice( -1 * n ) );
		// read from previous chunks until we have at least four bytes
		for ( var i = headers.length - 2; i >= 0 && length < 7; --i ) {
			last = headers[ i ];
			n = Math.min( last.length, 4 );
			length += n;
			chunks.push( last.slice( -1 * n ) );
		}
		// we don't have enough bytes
		if ( length < 4 ) {
			return false;
		}
		else if ( chunks.join( '' ).indexOf( TRAILER ) >= 0 ) {
			return true;
		}
	}

	_unchunkData ( data ) {

		if ( this._lastChunk ) {
			return;
		}

		var left = this._leftOvers;
		if ( this._leftOvers ) {
			if ( data instanceof Buffer ) {
				data = Buffer.concat( [ new Buffer( this._leftOvers ), data ] );
			}
			else {
				data = this._leftOvers + data;
			}
			this._leftOvers = null;
		}

		if ( this._unchunk ) {
			if ( this._literalChunkSize ) {
				size = data.length;
			}
			else {
				var pos = data.indexOf( '\r\n' );
				var size = parseInt( data.slice( 0, pos ) , 16 );
				if ( size === 0 ) {
					// this must be the last chunk
					this._lastChunk = true;
					return;
				}
				var pos2 = pos + 2; // +2 for the \r\n after the size and another +2 for \r\n after the chunk
				if ( pos2 + size + 2 > data.length ) {
					this._leftOvers = data;
					return;
				}
				data = data.slice( pos2, pos2 + size );
			}
		}
		if ( this._zlib ) {
			++this._zlibWrites;
			this._zlib.write( data, this._onZlibChunk );
		}
		else {
			this._messageSize += size;
			this._dest.write( data );
		}
	}

	_onZlibChunk () {
		var data = this._zlib.read();
		if ( data ) {
			this._messageSize += data.length;
			this._dest.write( data );
		}
		if ( --this._zlibWrites === 0 && this._closed ) {
			this._close();
		}
	}

	_bufferHeaders ( data ) {
		
		if ( data instanceof Buffer ) {
			data = data.toString( 'utf8' );
		}

		var headers = this._headers;
		headers.push( data );
		
		// is this the last chunk of the headers
		if ( !Unchunker._headersHasEnded( headers ) ) {
			return;
		}
		
		headers = headers.join( '' );
		// nothing to do for get
		if ( headers.startsWith( 'GET' ) ) {
			this.write = this._dest.write.bind( this._dest );
			this.write( headers );
			return;
		}

		headers = headers.splitFirst( TRAILER );
		var message = headers.right;
		headers = headers.left;

		var newheaders = {};
		headers = headers.split( '\r\n' ).map( ( line, i ) => {
			if ( i === 0 ) {
				return line;
			}
			line = line.split( ':' ).map( 'trim' );
			newheaders[ line[ 0 ].toLowerCase() ] = line[ 1 ];
		} );

		var encoding = newheaders[ 'content-encoding' ];
		if ( encoding == 'gzip' ) {
			this._zlib = Zlib.createGunzip();
		}
		else if ( encoding == 'deflate' ) {
			this._zlib = Zlib.createInflate();
		}
		if ( encoding !== undefined && encoding != 'identity' ) {
			newheaders[ 'x-logging-node-original-content-encoding' ] = encoding;
			newheaders[ 'content-encoding' ] = 'identity';
		}

		var len = newheaders[ 'content-length' ];
		if ( len !== undefined && this._zlib === null ) {
			// we have nothing to do
			this.write = this._dest.write.bind( this._dest );
			this.write( this._headers.join( '' ) );
			return;
		}
		else {
			// use new logic from now on
			this.write = this._unchunkData;
		}

		// don't need this anymore
		this._headers = null;

		if ( len !== undefined ) {
			newheaders[ 'x-logging-node-original-content-length' ] = len;
		}
		newheaders[ 'content-length' ] = ' '.repeat( PADDING ); //some padding that we will change later;

		encoding = newheaders[ 'transfer-encoding' ];
		if ( encoding !== undefined ) {
			if ( encoding == 'chunked' ) {
				this._unchunk = true;
			}
			newheaders[ 'x-logging-node-original-transfer-encoding' ] = encoding;
			delete newheaders[ 'transfer-encoding' ];
		}

		var pos = headers[ 0 ].length + 2;
		this._dest.write( headers[ 0 ] + '\r\n' );
		for ( var name in newheaders ) {
			var value = newheaders[ name ];
			if ( name == 'content-length' ) {
				this._savedPos = pos + name.length + 2;
			}
			pos += name.length + 2 + value.length + 2;
			this._dest.write( name + ': ' + value + '\r\n' );
		}
		this._dest.write( '\r\n' );

		// if we have buffered more than the headers flush it
		if ( String.isString( message ) && message.length > 0 ) {
			this._leftOvers = message;
		}
	}

	close () {

		this._closed = true;
		if ( this._zlibWrites === 0 ) {
			this._close();
		}
	}

	_close () {
		if ( this.write === this._bufferHeaders && this._headers.length > 0 ) {
			// closing while still buffering, flush
			this._dest.write( this._headers.join( '' ) );
			this._dest.close();
		}
		else if ( this._savedPos > 0 ) {
			var dest = this._dest;

			var pos = this._savedPos;
			var size = this._messageSize.toString( 10 );
			if ( size.length < PADDING ) {
				size = ' '.repeat( PADDING - size.length ) + size;
			}

			dest.close( function ( err, record ) {
				var uri = record.getUri();
				if ( err || uri === null ) {
					return;
				}

				Fs.open( uri, 'r+', function ( err, fd ) {
					if ( err ) {
						Fs.close( fd );
						return;
					}
					Fs.write( fd, size, pos, function () {
						Fs.close( fd );
					} )
				} ) ;
			} );
		}
		else {
			return this._dest.close();
		}
	}

}

module.exports = Unchunker;
