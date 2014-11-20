/**
 * @file Parse and represent a signature
 */
'use strict'

/**
 * @class
 * @param {number} id
 * @param {string} name
 * @param {?Type} input
 * @param {?Type} output
 */
function Signature(id, name, input, output) {
	/** @member {number} */
	this.id = id
	/** @member {string} */
	this.name = name
	/** @member {?Type} */
	this.input = input
	/** @member {?Type} */
	this.output = output
}

module.exports = Signature