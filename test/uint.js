/*globals describe, it*/
'use strict'

require('should')
var uint = require('../types').uint,
	Data = require('../Data'),
	values = require('./uint.json')

describe('types', function () {
	it('should correctly convert uints', function () {
		Object.keys(values).forEach(function (value) {
			var u = Number(value),
				data = new Data
			uint.write(u, data, '')
			data.toBuffer().toString('hex').should.be.equal(values[value])
		})
	})
})