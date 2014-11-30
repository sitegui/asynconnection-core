/*globals describe, it*/
'use strict'

var Context = require('../lib/Context'),
	MockConnection = require('./utils/MockConnection'),
	cntxt = new Context

// Prepare context
cntxt.addClientCall(1, 'add', {
	a: 'int',
	b: 'int'
}, 'int', function (data, done) {
	done(null, data.a + data.b)
})

describe('Peer', function () {
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

	describe('required authentication', function () {
		// In this example, the server requires the client to authenticate
		// Since the client doesn't do this, the connection is closed right after the handshake

		it('should end the handshake and close the connection if no auth is given', function (done) {
			var clientConn = new MockConnection,
				serverConn = new MockConnection,
				client = cntxt._createPeer(false, {}, clientConn),
				server = cntxt._createPeer(true, {
					required: true
				}, serverConn),
				half = false,
				cb = function () {
					this.closed.should.be.true
					if (!half) {
						return (half = true)
					}
					done()
				}
			client.on('error', cb)
			server.on('error', cb)
			MockConnection.link(clientConn, serverConn)
		})

		it('should accept any non-empty user/password', function (done) {
			var clientConn = new MockConnection,
				serverConn = new MockConnection,
				client = cntxt._createPeer(false, {}, clientConn),
				server = cntxt._createPeer(true, {}, serverConn),
				half = false,
				cb = function () {
					this.closed.should.be.false
					this.handshakeDone.should.be.true
					if (!half) {
						return (half = true)
					}
					done()
				}
			client.on('connect', cb)
			server.on('connect', cb)
			MockConnection.link(clientConn, serverConn)
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
					handler: function (user, password, done) {
						user.should.be.equal('u')
						password.should.be.equal('p')
						this.should.be.equal(server)
						server.handshakeDone.should.be.false
						client.handshakeDone.should.be.false
						setTimeout(function () {
							done(new Error('Invalid credentials, for some reason'))
						}, 10)
					}
				}, serverConn),
				half = false,
				cb = function () {
					this.closed.should.be.true
					if (!half) {
						return (half = true)
					}
					done()
				}
			MockConnection.link(clientConn, serverConn)

			server.on('error', cb)
			client.on('error', cb)
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
					handler: function (user, password, done) {
						user.should.be.equal('u')
						password.should.be.equal('p')
						this.should.be.equal(server)
						server.handshakeDone.should.be.false
						client.handshakeDone.should.be.false
						setTimeout(function () {
							done()
						}, 10)
					}
				}, serverConn),
				half = false,
				cb = function () {
					this.closed.should.be.false
					this.handshakeDone.should.be.true
					if (!half) {
						return (half = true)
					}
					done()
				}
			MockConnection.link(clientConn, serverConn)

			server.on('connect', cb)
			client.on('connect', cb)
		})
	})

	describe('using no auth handler', function () {

	})
})