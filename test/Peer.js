/*globals describe, it*/
'use strict'

var Context = require('../lib/Context'),
	MockConnection = require('./utils/MockConnection')

describe('Peer', function () {
	// Prepare context
	var cntxt = new Context
	cntxt.addClientCall(1, 'add', {
		a: 'int',
		b: 'int'
	}, 'int', function () {
		console.log('hi')
	})

	describe('invalid authentication', function () {
		// In this example, the client requires the server to authenticate
		// Since the server doesn't do this, the connection is closed right after the handshake

		// Create peers
		var clientConn = new MockConnection,
			serverConn = new MockConnection,
			client = cntxt._createPeer(false, {
				user: 'user',
				password: 'pass',
				required: true
			}, clientConn),
			server = cntxt._createPeer(true, {}, serverConn)

		it('should send the handshake', function () {
			clientConn.lastFrame().should.be.a.Buffer
			clientConn.lastFrame().should.be.a.Buffer
			client._handshakeReceived.should.be.false
			server._handshakeReceived.should.be.false
		})

		it('should end the handshake and close the connection', function () {
			var errors = 0
			client.once('error', function () {
				errors++
			})
			server.once('error', function () {
				errors++
			})

			MockConnection.link(clientConn, serverConn)
			client._handshakeReceived.should.be.true
			server._handshakeReceived.should.be.true
			client.closed.should.be.true
			server.closed.should.be.true
			errors.should.be.equal(2)
		})
	})

	describe('no authentication', function () {
		it('should be simple to connect without auth', function () {
			var clientConn = new MockConnection,
				serverConn = new MockConnection,
				client = cntxt._createPeer(false, {}, clientConn),
				server = cntxt._createPeer(true, {}, serverConn)
			MockConnection.link(clientConn, serverConn)

			client.handshakeDone.should.be.true
			server.handshakeDone.should.be.true
			client.closed.should.be.false
			server.closed.should.be.false
		})
	})

	describe('using auth handler', function () {
		it('should be able to check credentials and block the connection', function (done) {
			var clientConn = new MockConnection,
				serverConn = new MockConnection,
				client = cntxt._createPeer(false, {
					user: 'u',
					password: 'p'
				}, clientConn),
				server = cntxt._createPeer(true, {
					required: true,
					handler: function (auth, done) {
						auth.remoteUser.should.be.equal('u')
						auth.remotePassword.should.be.equal('p')
						this.should.be.equal(server)
						setTimeout(function () {
							done(new Error('Invalid credentials, for some reason'))
						}, 10)
						server.handshakeDone.should.be.false
						client.handshakeDone.should.be.false
					}
				}, serverConn)
			MockConnection.link(clientConn, serverConn)
			client.handshakeDone.should.be.true
			client.call('add', {
				a: 12,
				b: 13
			}, function () {
				console.log(arguments)
			})

			server.on('error', function (err) {
				server.handshakeDone.should.be.true
				client.handshakeDone.should.be.true
				server.closed.should.be.true
				err.message.should.be.equal('Invalid credentials, for some reason')
				done()
			})
		})

		it('should be able to check credentials and allow the connection', function (done) {
			var clientConn = new MockConnection,
				serverConn = new MockConnection,
				client = cntxt._createPeer(false, {
					user: 'u',
					password: 'p'
				}, clientConn),
				server = cntxt._createPeer(true, {
					required: true,
					handler: function (auth, done) {
						auth.remoteUser.should.be.equal('u')
						auth.remotePassword.should.be.equal('p')
						this.should.be.equal(server)
						setTimeout(function () {
							done()
						}, 10)
						server.handshakeDone.should.be.false
						client.handshakeDone.should.be.false
					}
				}, serverConn)
			MockConnection.link(clientConn, serverConn)

			server.on('connect', function () {
				server.handshakeDone.should.be.true
				client.handshakeDone.should.be.true
				server.closed.should.be.false
				done()
			})
		})
	})

	describe('using no auth handler', function () {

	})
})