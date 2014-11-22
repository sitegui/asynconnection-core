'use strict'

/**
 * Wraps a buffer with a read head pointer
 * @class
 * @param {Buffer} buffer
 */
function ReadState(buffer) {
	/** @member {Buffer} */
	this.buffer = buffer
	/** @member {number} */
	this.offset = 0
}

module.exports = ReadState

/**
 * Read one byte but don't advance the read pointer
 * @returns {number}
 */
ReadState.prototype.peekUInt8 = function () {
	return this.buffer.readUInt8(this.offset)
}

/**
 * Read one byte and advance the read pointer
 * @returns {number}
 */
ReadState.prototype.readUInt8 = function () {
	return this.buffer.readUInt8(this.offset++)
}

/**
 * @returns {number}
 */
ReadState.prototype.readUInt16 = function () {
	var r = this.buffer.readUInt16BE(this.offset)
	this.offset += 2
	return r
}

/**
 * @returns {number}
 */
ReadState.prototype.readUInt32 = function () {
	var r = this.buffer.readUInt32BE(this.offset)
	this.offset += 4
	return r
}