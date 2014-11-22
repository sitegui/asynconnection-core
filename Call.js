'use strict'

var Type

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
}

module.exports = Call