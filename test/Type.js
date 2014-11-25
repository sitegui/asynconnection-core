/*globals describe, it*/
'use strict'

require('should')
var Type = require('../lib/Type')

describe('Type', function () {
	var myType

	it('should correctly parse a type', function () {
		myType = new Type({
			a: 'int',
			b: ['int'],
			c: [{
				'd?': 'string'
			}]
		})

		myType.should.be.eql({
			type: Type.OBJECT,
			fields: [{
				name: 'a',
				optional: false,
				array: false,
				type: {
					type: Type.INT
				}
			}, {
				name: 'b',
				optional: false,
				array: true,
				type: {
					type: Type.INT
				}
			}, {
				name: 'c',
				optional: false,
				array: true,
				type: {
					type: Type.OBJECT,
					fields: [{
						name: 'd',
						optional: true,
						array: false,
						type: {
							type: Type.STRING
						}
					}]
				}
			}]
		})
	})
})