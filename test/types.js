/*globals describe, it*/
'use strict'

require('should')
var types = require('../types'),
	Data = require('../Data'),
	uintValues = require('./uint.json'),
	intValues = require('./int.json')

describe('types', function () {
	it('should correctly convert uints', function () {
		Object.keys(uintValues).forEach(function (value) {
			var u = Number(value),
				data = new Data
			types.uint.write(u, data, '')
			data.toBuffer().toString('hex').should.be.equal(uintValues[value])
		})
	})

	it('should correctly convert ints', function () {
		Object.keys(intValues).forEach(function (value) {
			var i = Number(value),
				data = new Data
			types.int.write(i, data, '')
			data.toBuffer().toString('hex').should.be.equal(intValues[value])
		})
	})
})