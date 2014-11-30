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
	var i, lockA = true,
		lockB = true

	a.on('_sendFrame', function (frame) {
		if (!lockA) {
			b.emit('frame', frame)
		}
	})
	b.on('_sendFrame', function (frame) {
		if (!lockB) {
			a.emit('frame', frame)
		}
	})

	// Send previous frames
	for (i = 0; i < a.frames.length; i++) {
		b.emit('frame', a.frames[i])
	}
	lockA = false
	for (i = 0; i < b.frames.length; i++) {
		a.emit('frame', b.frames[i])
	}
	lockB = false
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