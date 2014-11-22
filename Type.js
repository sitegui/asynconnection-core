/**
 * @file Parse and represent a type
 * Example:
 *
 * 'a: int, b[]: int, c[]: (d?: string)'
 * {
 * type: Type.OBJECT,
 * fields: [{
 * 	name: 'a',
 * 	type: {
 * 		type: Type.INT
 * 	}
 * }, {
 * 	name: 'b',
 * 	array: true,
 * 	type: {
 * 		type: Type.INT
 * 	}
 * }, {
 * 	name: 'c',
 * 	array: true,
 * 	type: {
 * 		type: Type.OBJECT,
 * 		fields: [{
 * 			name: 'd',
 * 			optional: true,
 * 			type: {
 * 				type: Type.STRING
 * 			}
 * 		}]
 * 	}
 * }]
 * }
 *
 */
'use strict'

var Data = require('./Data'),
	ReadState = require('./ReadState'),
	types = require('./types')

/**
 * @class
 * @param {string} type
 */
function Type(type) {
	/** @member {string} */
	this.type = type

	/** @member {Array<Field>} */
	this.fields = null
}

module.exports = Type

Type.UINT = 'uint'
Type.INT = 'int'
Type.FLOAT = 'float'
Type.STRING = 'string'
Type.BUFFER = 'Buffer'
Type.BOOLEAN = 'boolean'
Type.JSON = 'json'
Type.OID = 'oid'
Type.REGEX = 'regex'
Type.DATE = 'date'
Type.OBJECT = 'object'

/**
 * @param {*} value
 * @return {Buffer}
 * @throws - if the value is invalid
 */
Type.prototype.write = function (value) {
	var data = new Data
	this._write(value, data, '')
	return data.toBuffer()
}

/**
 * @param {Buffer} buffer
 * @return {*}
 * @throws - if fails
 */
Type.prototype.read = function (buffer) {
	return this._read(new ReadState(buffer))
}

/**
 * @param {*} value
 * @param {Data} data
 * @param {string} path
 * @private
 */
Type.prototype._write = function (value, data, path) {
	if (this.type !== Type.OBJECT) {
		// Simple type
		return types[this.type].write(value, data, path)
	}

	if (!value || typeof value !== 'object') {
		throw new TypeError('Expected an object at ' + path)
	}

	this.fields.forEach(function (field) {
		var subpath = path ? path + '.' + field.name : field.name,
			subValue = value[field.name]

		if (field.optional) {
			if (subValue === undefined || subValue === null) {
				return types.boolean.write(false, data)
			} else {
				types.boolean.write(true, data)
			}
		}

		if (!field.array) {
			return field.type._write(subValue, data, subpath)
		}

		if (!Array.isArray(subValue)) {
			throw new TypeError('Expected an Array at ' + subpath)
		}
		types.uint.write(subValue.length, data)
		subValue.forEach(function (value, i) {
			field.type._write(value, data, subpath + '.' + i)
		})
	})
}

/**
 * @param {ReadState} state
 * @return {*}
 * @private
 */
Type.prototype._read = function (state) {
	var ret

	if (this.type !== Type.OBJECT) {
		// Simple type
		return types[this.type].read(state)
	}

	ret = {}

	this.fields.forEach(function (field) {
		var arr, i

		if (field.optional && !types.boolean.read(state)) {
			return
		}

		if (!field.array) {
			return (ret[field.name] = field.type._read(state))
		}

		arr = new Array(types.uint.read(state))
		for (i = 0; i < arr.length; i++) {
			arr[i] = field.type._read(state)
		}
		ret[field.name] = arr
	})

	return ret
}