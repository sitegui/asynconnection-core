'use strict'

// Stores 2^i from i=0 to i=56
var POW = (function () {
	var r = [],
		i, n = 1
	for (i = 0; i <= 56; i++) {
		r.push(n)
		n *= 2
	}
	return r
})()

// Pre-calculated constants
var MAX_DOUBLE_INT = POW[53],
	MAX_INT = POW[31] - 1,
	MAX_UINT8 = POW[7],
	MAX_UINT16 = POW[14],
	MAX_UINT32 = POW[29],
	MAX_INT8 = POW[6],
	MAX_INT16 = POW[13],
	MAX_INT32 = POW[28]

/*
 * Formats (big-endian):
 * 7b	0xxx xxxx
 * 14b	10xx xxxx  xxxx xxxx
 * 29b	110x xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx
 * 61b	111x xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx  xxxx xxxx
 */
module.exports.uint = {
	write: function (u, data, path) {
		// Check the input
		if (Math.round(u) !== u || u > MAX_DOUBLE_INT || u < 0) {
			throw new TypeError('Expected unsigned integer at ' + path)
		}

		if (u < MAX_UINT8) {
			data.writeUInt8(u)
		} else if (u < MAX_UINT16) {
			data.writeUInt16(u + 0x8000)
		} else if (u < MAX_UINT32) {
			data.writeUInt32(u + 0xc0000000)
		} else {
			// Split in two 32b uints
			data.writeUInt32(Math.floor(u / POW[32]) + 0xe0000000)
			data.writeUInt32(u >>> 0)
		}
	},
	read: function (data, path) {

	}
}

module.exports.int = {
	write: function (i, data, path) {
		// Check the input
		if (Math.round(i) !== i || i > MAX_DOUBLE_INT || i < -MAX_DOUBLE_INT) {
			throw new TypeError('Expected signed integer at ' + path)
		}

		if (i >= -MAX_INT8 && i < MAX_INT8) {
			data.writeUInt8(i & 0x7f)
		} else if (i >= -MAX_INT16 && i < MAX_INT16) {
			data.writeUInt16((i & 0x3fff) + 0x8000)
		} else if (i >= -MAX_INT32 && i < MAX_INT32) {
			data.writeUInt32((i & 0x1fffffff) + 0xc0000000)
		} else {
			// Split in two 32b uints
			data.writeUInt32((Math.floor(i / POW[32]) & 0x1fffffff) + 0xe0000000)
			data.writeUInt32(i >>> 0)
		}
	}
}