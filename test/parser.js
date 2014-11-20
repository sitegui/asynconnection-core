/*globals describe, it*/
'use strict'

require('should')
var parser = require('../parser'),
	Type = require('../Type')

describe('parser', function () {
	it('should parse simple signatures', function () {
		parser('#1 add').should.be.eql({
			id: 1,
			name: 'add',
			input: null,
			output: null
		})

		parser('#7 half(int) -> float').should.be.eql({
			id: 7,
			name: 'half',
			input: new Type(Type.INT),
			output: new Type(Type.FLOAT)
		})
	})

	it('should parse more complex signatures', function () {
		parser('#123 handshake(auth?: (user: string, pass: string), calls[]: (id: uint, sig: Buffer)) -> boolean').should.be.eql({
			id: 123,
			name: 'handshake',
			input: {
				type: Type.OBJECT,
				fields: [{
					name: 'auth',
					array: false,
					optional: true,
					type: {
						type: Type.OBJECT,
						fields: [{
							name: 'user',
							array: false,
							optional: false,
							type: new Type(Type.STRING)
						}, {
							name: 'pass',
							array: false,
							optional: false,
							type: new Type(Type.STRING)
						}]
					}
				}, {
					name: 'calls',
					array: true,
					optional: false,
					type: {
						type: Type.OBJECT,
						fields: [{
							name: 'id',
							array: false,
							optional: false,
							type: new Type(Type.UINT)
						}, {
							name: 'sig',
							array: false,
							optional: false,
							type: new Type(Type.BUFFER)
						}]
					}
				}]
			},
			output: new Type(Type.BOOLEAN)
		})
	})
})