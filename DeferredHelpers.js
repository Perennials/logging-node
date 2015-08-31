"use strict";

module.exports = {
	ProxyEvents: function ( events, src, dest ) {

		function makeProxyListener ( name, dest ) {
			return function () {
				var args = Array.prototype.slice.call( arguments, 0 );
				for ( var i = args.length - 1; i >= 0; --i ) {
					if ( args[ i ] === src ) {
						args[ i ] = dest;
					}
				}
				return dest.emit.apply( dest, [ name ].concat( args ) );
			};
		}

		for ( var i = events.length - 1; i >= 0; --i ) {
			var event = events[ i ];
			src.on( event, makeProxyListener( event, dest ) );
		}
	}

}