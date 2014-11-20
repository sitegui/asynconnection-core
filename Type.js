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

/**
 * @class
 * @param {number} type
 */
function Type(type) {
	/** @member {number} */
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