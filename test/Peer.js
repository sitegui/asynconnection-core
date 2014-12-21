/*globals describe, it*/
'use strict'

var Context = require('../lib/Context'),
	Peer = require('../lib/Peer'),
	MockConnection = require('./utils/MockConnection'),
	should = require('should'),
	cntxt = new Context

// Prepare context
cntxt.addClientCall(1, 'add', {
	a: 'int',
	b: 'int'
}, 'int', function (data, done) {
	if (data.a + data.b > 100) {
		return done(new Error('Result is too large'))
	}
	done(null, data.a + data.b)
})
cntxt.addClientCall(2, 'hang', null, null, function () {
	// Never call done
})
cntxt.addServerMessage(1, 'ignored', 'string')

function createPeers(clientAuth, serverAuth, onconnect) {
	var clientConn = new MockConnection,
		serverConn = new MockConnection,
		client = cntxt._createPeer(false, clientAuth, clientConn),
		server = cntxt._createPeer(true, serverAuth, serverConn),
		half = false,
		cb = function () {
			if (half) {
				return onconnect && onconnect(client, server)
			}
			half = true
		}
	MockConnection.link(clientConn, serverConn)
	client.on('connect', cb)
	server.on('connect', cb)
	return {
		clientConn: clientConn,
		serverConn: serverConn,
		client: client,
		server: server
	}
}

describe('Peer', function () {
	describe('no authentication', function () {
		it('should be simple to connect without auth', function (done) {
			createPeers({}, {}, function (client, server) {
				client.handshakeDone.should.be.true
				server.handshakeDone.should.be.true
				client.closed.should.be.false
				server.closed.should.be.false
				done()
			})
		})
	})

	describe('required authentication', function () {
		// In this example, the server requires the client to authenticate
		// Since the client doesn't do this, the connection is closed right after the handshake

		it('should end the handshake and close the connection if no auth is given', function (done) {
			var peers = createPeers({}, {
					required: true
				}),
				half = false,
				cb = function () {
					this.closed.should.be.true
					if (!half) {
						return (half = true)
					}
					done()
				}
			peers.client.once('error', cb)
			peers.server.once('error', cb)
		})

		it('should accept any non-empty user/password', function (done) {
			createPeers({
				user: 'u',
				password: 'p'
			}, {
				required: true
			}, function (client, server) {
				client.closed.should.be.false
				client.handshakeDone.should.be.true
				server.closed.should.be.false
				server.handshakeDone.should.be.true
				server.auth.remoteUser.should.be.equal('u')
				client.auth.user.should.be.equal('u')
				done()
			})
		})
	})

	describe('using auth handler', function () {
		it('should be able to check credentials and block the connection', function (done) {
			var peers = createPeers({
					user: 'u',
					password: 'p'
				}, {
					required: true,
					handler: function (user, password, done) {
						user.should.be.equal('u')
						password.should.be.equal('p')
						this.handshakeDone.should.be.false
						setTimeout(function () {
							done(new Error('Invalid credentials, for some reason'))
						}, 10)
					}
				}, function (client, server) {
					client.closed.should.be.false
					client.handshakeDone.should.be.true
					server.closed.should.be.false
					server.handshakeDone.should.be.true
					done()
				}),
				half = false,
				cb = function (err) {
					err.should.an.Error
					this.closed.should.be.true
					if (!half) {
						return (half = true)
					}
					done()
				}

			peers.server.once('error', cb)
			peers.client.once('error', cb)
		})

		it('should be able to check credentials and allow the connection', function (done) {
			createPeers({
				user: 'u',
				password: 'p'
			}, {
				required: true,
				handler: function (user, password, done) {
					user.should.be.equal('u')
					password.should.be.equal('p')
					this.handshakeDone.should.be.false
					setTimeout(function () {
						done()
					}, 10)
				}
			}, function (client, server) {
				client.closed.should.be.false
				client.handshakeDone.should.be.true
				server.closed.should.be.false
				server.handshakeDone.should.be.true
				done()
			})
		})
	})

	it('should know which calls and messages the other side implements', function (done) {
		createPeers({}, {}, function (client, server) {
			client.canCall('add').should.be.true
			client.canCall('anotherCall').should.be.false
			server.canCall('add').should.be.false

			server.canSend('ignored').should.be.true
			done()
		})
	})

	it('should send and answer calls with success', function (done) {
		createPeers({}, {}, function (client) {
			client.call('add', {
				a: 12,
				b: 13
			}, function (err, result) {
				should(err).be.null
				result.should.be.equal(25)
				done()
			})
		})
	})

	it('should send and answer calls with error', function (done) {
		createPeers({}, {}, function (client) {
			client.call('add', {
				a: 120,
				b: 130
			}, function (err) {
				err.message.should.be.equal('Result is too large')
				err.isLocal.should.be.false
				done()
			})
		})
	})

	it('should alert about local errors on call', function (done) {
		createPeers({}, {}, function (client) {
			client.call('nonExist', '', function (err) {
				err.should.be.an.Error
				err.isLocal.should.be.true

				client.call('add', 'notTheExpectedFormat', function (err) {
					err.should.be.an.Error
					err.isLocal.should.be.true
					done()
				})
			})
		})
	})

	it('should timeout calls', function (done) {
		createPeers({}, {}, function (client) {
			client.call('hang', null, 100, function (err) {
				err.isLocal.should.be.true
				err.code.should.be.equal(Peer.ERROR.TIMEOUT)
				done()
			})
		})
	})

	it('should end pending calls on disconnect', function (done) {
		createPeers({}, {}, function (client, server) {
			client.call('hang', null, function (err) {
				err.isLocal.should.be.true
				err.code.should.be.equal(Peer.ERROR.CLOSED)
				done()
			})
			server.close()
		})
	})

	it('should send messages', function (done) {
		cntxt.addClientMessage(2, 'msg', 'uint', function (data) {
			data.should.be.equal(17)
			done()
		})
		createPeers({}, {}, function (client) {
			client.send('msg', 17)
		})
	})
	
	it('should alert about bad response format', function (done) {
		cntxt.addClientCall(3, 'internalError', null, 'uint', function (data, done) {
			done(null, -2) // not a uint
		})
		createPeers({}, {}, function (client, server) {
			server.once('error', function (err) {
				err.should.be.an.Error
				err.message.should.match(/Expected unsigned integer/)
			})
			client.call('internalError', function (err) {
				err.should.be.an.Error
				err.isLocal.should.be.false
				err.code.should.be.equal(Peer.ERROR.INTERNAL)
				done()
			})
		})
	})
})