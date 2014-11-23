'use strict'

var Type

/**
 * @class
 * @param {number} id
 * @param {string} name
 * @param {?string|Object} input - see Type constructor
 * @param {function(*)} [handler]
 */
function Message(id, name, input, handler) {
	if (typeof id !== 'number' || Math.round(id) !== id || id <= 0) {
		throw new TypeError('Invalid id ' + id + ', expected a positive integer')
	} else if (typeof name !== 'string') {
		throw new TypeError('Invalid name ' + name + ', expected a string')
	}

	this.id = id
	this.name = name
	this.input = input ? new Type(input) : null
	this.handler = handler
}

module.exports = Message

Type = require('./Type')

/**
 * @return {Buffer}
 * @private
 */
Message.prototype._getHash = function () {
	return this.input ? this.input._getHash() : new Buffer(0)
}