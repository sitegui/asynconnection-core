/*globals describe, it*/
'use strict'

var Context = require('../lib/Context'),
	should = require('should')

describe('Context', function () {
	var cntxt = new Context

	it('should accept adding calls', function () {
		cntxt.addClientCall(1, 'add', {
			a: 'int',
			b: 'int'
		}, 'int')

		cntxt.addServerCall(1, 'sort', {
			v: ['int'],
			'desc?': 'boolean'
		}, {
			v: ['int']
		})

		cntxt.addServerCall(2, 'random', null, 'float')
	})

	it('should accept calls with the same id or name', function () {
		should(function () {
			cntxt.addClientCall(1, 'double', 'int', 'int')
		}).throw()

		should(function () {
			cntxt.addServerCall(3, 'random', null, 'int')
		}).throw()
	})

	it('should create a Peer', function () {
		var conn = {
				// Mock
				on: function () {},
				sendFrame: function () {}
			},
			serverPeer = cntxt._createPeer(true, {}, conn),
			clientPeer = cntxt._createPeer(false, {}, conn)
		serverPeer._calls.local.list.should.be.equal(cntxt._calls.server.list)
		serverPeer._calls.remote.list.should.be.equal(cntxt._calls.client.list)

		clientPeer._calls.local.list.should.be.equal(cntxt._calls.client.list)
		clientPeer._calls.remote.list.should.be.equal(cntxt._calls.server.list)
	})
})