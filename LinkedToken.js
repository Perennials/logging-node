"use strict";

class LinkedToken {

	constructor ( type, relation, value ) {
		this.Type = type;
		this.Relation = relation;
		this.Value = value;
	}

	getType () {
		return this.Type;
	}

	getRelation () {
		return this.Relation;
	}

	getValue () {
		return this.Value;
	}

}

LinkedToken.static( {
	Type: {
		LOGSESSION: 'LOGSESSION',
		EXTERNAL: 'EXTERNAL'
	},
	
	Relation: {
		PARENT: 'PARENT',
		CHILD: 'CHILD',
		SIBLING: 'SIBLING'
	}
} );

module.exports = LinkedToken;