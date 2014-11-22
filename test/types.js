/*globals describe, it*/
'use strict'

require('should')
var types = require('../types'),
	Data = require('../Data'),
	ReadState = require('../ReadState'),
	uintValues = require('./uint.json'),
	intValues = require('./int.json')

describe('types', function () {
	it('should correctly convert uints', function () {
		Object.keys(uintValues).forEach(function (value) {
			value = Number(value)
			var encoded = write(types.uint, value)
			encoded.should.be.equal(uintValues[value])
			read(encoded, types.uint).should.be.equal(value)
		})
	})

	it('should correctly convert ints', function () {
		Object.keys(intValues).forEach(function (value) {
			value = Number(value)
			var encoded = write(types.int, value)
			encoded.should.be.equal(intValues[value])
			read(encoded, types.int).should.be.equal(value)
		})
	})
})

/**
 * @param {Object} type
 * @param {*} value
 * @return {string} - hex string
 */
function write(type, value) {
	var data = new Data
	type.write(value, data, '')
	return data.toBuffer().toString('hex')
}

/**
 * @param {string} hexStr
 * @param {Object} type
 * @return {*}
 */
function read(hexStr, type) {
	var state = new ReadState(new Buffer(hexStr, 'hex')),
		r = type.read(state)
	state.hasEnded().should.be.true
	return r
}