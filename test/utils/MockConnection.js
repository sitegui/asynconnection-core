/**
 * @file A mock connection, for testing
 */
'use strict'

/**
 * @class
 * @extends EventEmitter
 */
function MockConnection() {
	this.frames = []
	this.closed = false
}

require('util').inherits(MockConnection, require('events').EventEmitter)
module.exports = MockConnection

/**
 * Pipe a to b and b to a
 * @param {MockConnection} a
 * @param {MockConnection} b
 */
MockConnection.link = function (a, b) {
	var lenA, lenB, i

	a.on('_sendFrame', function (frame) {
		b.emit('frame', frame)
	})
	b.on('_sendFrame', function (frame) {
		a.emit('frame', frame)
	})

	// Send previous frames
	lenA = a.frames.length
	lenB = b.frames.length
	for (i = 0; i < lenA; i++) {
		b.emit('frame', a.frames[i])
	}
	for (i = 0; i < lenB; i++) {
		a.emit('frame', b.frames[i])
	}
}

MockConnection.prototype.sendFrame = function (frame) {
	this.frames.push(frame)
	this.emit('_sendFrame', frame)
}

MockConnection.prototype.close = function () {
	if (!this.closed) {
		this.closed = true
		this.emit('close')
	}
}

MockConnection.prototype.lastFrame = function () {
	return this.frames[this.frames.length - 1]
}