/*globals describe, it*/
'use strict'

var Context = require('../lib/Context'),
	EventEmitter = require('events').EventEmitter,
	should = require('should')

describe('Peer', function () {
	// Mock connection
	var clientConn = new EventEmitter,
		serverConn = new EventEmitter
	clientConn.frames = []
	serverConn.frames = []
	clientConn.sendFrame = serverConn.sendFrame = function (frame) {
		console.log(frame)
		this.frames.push(frame)
	}
	clientConn.getLastFrame = serverConn.getLastFrame = function () {
		return this.frames.pop()
	}
	clientConn.close = serverConn.close = function () {}

	// Prepare context
	var cntxt = new Context
	cntxt.addClientCall(1, 'add', {
		a: 'int',
		b: 'int'
	}, 'int')

	describe('invalid authentication', function () {
		// In this example, the client requires the server to authenticate
		// Since the server doesn't do this, the connection is closed right after the handshake

		// Create peer
		var client = cntxt._createPeer(false, {
				user: 'user',
				password: 'pass',
				required: true
			}, clientConn),
			server = cntxt._createPeer(true, {}, serverConn)

		var clientHandshake, serverHandshake
		it('should send the handshake', function () {
			clientHandshake = clientConn.getLastFrame()
			serverHandshake = serverConn.getLastFrame()
			clientHandshake.should.be.a.Buffer
			serverHandshake.should.be.a.Buffer
			client.handshakeDone.should.be.false
			server.handshakeDone.should.be.false
		})

		it('should end the handshake and close the connection', function () {
			var errors = 0
			client.once('error', function () {
				errors++
			})
			server.once('error', function () {
				errors++
			})
			clientConn.emit('frame', serverHandshake)
			serverConn.emit('frame', clientHandshake)
			client.closed.should.be.true
			server.closed.should.be.true
			errors.should.be.equal(2)
		})
	})
})