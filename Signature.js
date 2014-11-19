/**
 * @file Parse and represent a signature
 */
'use strict'

/**
 * @class
 */
function Signature() {
	/** @member {number} */
	this.id = 0
	/** @member {string} */
	this.name = ''
	/** @member {Type} */
	this.input = null
	/** @member {Type} */
	this.output = null
}

module.exports = Signature