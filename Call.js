'use strict'

var Type, Data

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

	this.id = id
	this.name = name
	this.input = input ? new Type(input) : null
	this.output = output ? new Type(output) : null
	this.handler = handler

	// Create the hash that will be used to check peer compatibility
	this._hash = this._getHash()
}

module.exports = Call

Type = require('./Type')
Data = require('./Data')

/**
 * @return {Buffer}
 * @private
 */
Call.prototype._getHash = function () {
	var hash = new Data

	// Input
	hash.writeUInt8(0)
	if (this.input) {
		hash.appendBuffer(this.input._getHash())
	}

	// Output
	hash.writeUInt8(1)
	if (this.output) {
		hash.appendBuffer(this.output._getHash())
	}

	return hash.toBuffer()
}