"use strict";

require( 'Prototype' );

class Helpers {

	static addSessionProp ( options, propName, propValue, mergeExisting ) {

		var sessionProps = options.SessionProps;
		if ( sessionProps instanceof Array || sessionProps instanceof Object ) {
			Helpers.addSessionPropRaw( sessionProps, propName, propValue, mergeExisting );
		}
		else {
			var obj = {};
			obj[ propName ] = propValue;
			options.SessionProps = obj;
		}
	}

	static addSessionPropRaw ( sessionProps, propName, propValue, mergeExisting ) {

		if ( sessionProps instanceof Array ) {
			var obj = {};
			obj[ propName ] = propValue;
			var existing = undefined;
			for ( var it of sessionProps ) {
				if ( it instanceof Object && it[ propName ] !== undefined ) {
					existing = it;
					break;
				}
			}
			if ( existing !== undefined ) {
				if ( mergeExisting ) {
					Helpers.addSessionPropRaw( existing, propName, propValue, true );
				}
			}
			else {
				sessionProps.unshift( obj );
			}
		}
		else if ( sessionProps instanceof Object ) {
			var existing = sessionProps[ propName ];
			if ( existing === undefined ) {
				sessionProps[ propName ] = propValue;
			}
			else if ( mergeExisting ) {
				if ( existing instanceof Array ) {
					var changed = false;
					existing.forEach( it => {
						if ( Object.isObject( it ) && it[ propValue ] !== undefined ) {
							Helpers.addSessionPropRaw( it, propName, propValue, true );
							changed = true;
						}
					} );
					if ( changed ) {
						return;
					}

					if ( propValue instanceof Array ) {
						sessionProps[ propName ] = existing.concat( propValue );
					}
					else {
						existing.push( propValue );
					}
				}
				else if ( Object.isObject( existing ) && Object.isObject( propValue ) ) {
					existing.mergeDeep( propValue );
				}
				else {
					sessionProps[ propName ] = propValue;
				}
			}
		}
	}

}

module.exports = Helpers;