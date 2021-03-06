'use strict'

var jsBin = require('js-binary'),
	Type = jsBin.Type,
	Data = jsBin.Data

/**
 * @class
 * @param {number} id
 * @param {string} name
 * @param {?string|Object} input - see Type constructor
 * @param {?string|Object} output - see Type constructor
 * @param {function(*,function(?Error,*))} [handler]
 */
function Call(id, name, input, output, handler) {
	if (typeof id !== 'number' || Math.round(id) !== id || id <= 0) {
		throw new TypeError('Invalid id ' + id + ', expected a positive integer')
	} else if (typeof name !== 'string') {
		throw new TypeError('Invalid name ' + name + ', expected a string')
	}

	/** @member {number} */
	this.id = id
	/** @member {string} */
	this.name = name
	/** @member {?Type} */
	this.input = input ? new Type(input) : null
	/** @member {?Type} */
	this.output = output ? new Type(output) : null
	/** @member {?Function} */
	this.handler = handler

	/**
	 * Hash that is used to check peer compatibility
	 * @member {Buffer}
	 * @readonly
	 */
	this.hash = this._getHash()
}

module.exports = Call

/**
 * @return {Buffer}
 * @private
 */
Call.prototype._getHash = function () {
	var hash = new Data

	// Input
	hash.writeUInt8(0)
	if (this.input) {
		hash.appendBuffer(this.input.getHash())
	}

	// Output
	hash.writeUInt8(1)
	if (this.output) {
		hash.appendBuffer(this.output.getHash())
	}

	return hash.toBuffer()
}