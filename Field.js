/**
 * @file Parse and represent an object field. See example in Type.js
 */
'use strict'

/**
 * @class
 */
function Field() {
	/** @member {string} */
	this.name = ''

	/** @member {Type} */
	this.type = null

	/** @member {boolean} */
	this.array = false

	/** @member {boolean} */
	this.optional = false
}

module.exports = Field