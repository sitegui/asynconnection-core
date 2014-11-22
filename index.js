'use strict'

var aP = require('async-protocol-node'),
	fs = require('fs')

aP.addClientCall({
	id: 12,
	name: 'add',
	input: {
		a: 'int',
		b: ['int'],
		c: [{
			'd?': 'string'
		}]
	}
}, function (data, done) {
	done(null)
})

aP.addClientCall(12, 'add', {
	a: 'int',
	b: ['int'],
	c: [{
		'd?': 'string'
	}]
}, null, function (data, done) {
	done(null)
})

aP.connect('ap://admin:12345@localhost:1717')

aP.createServer({
	key: fs.readFileSync('server-key.pem'),
	cert: fs.readFileSync('server-cert.pem'),
	port: 1717
}, function () {
	console.log('Listening')
})