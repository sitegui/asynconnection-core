'use strict'

/**
 * @class
 * @extends EventEmitter
 * @param {Object} calls
 * @param {Object} calls.local - calls this side can make
 * @param {Object<Call>} calls.local.map
 * @param {Array<Call>} calls.local.list
 * @param {Object} calls.remote - calls this side can receive
 * @param {Object<Call>} calls.remote.map
 * @param {Array<Call>} calls.remote.list
 * @param {Object} messages
 * @param {Object} messages.local - messages this side can send
 * @param {Object<Message>} messages.local.map
 * @param {Array<Message>} messages.local.list
 * @param {Object} messages.remote - messages this side can receive
 * @param {Object<Message>} messages.remote.map
 * @param {Array<Message>} messages.remote.list
 * @param {Object} auth
 * @param {string} [auth.user='']
 * @param {string} [auth.password='']
 * @param {boolean} [auth.required=false] - if true, will require remote authentication
 * @param {Connection} connection
 */
function Peer(calls, messages, auth, connection) {
	/**
	 * @member {Object}
	 * @property {string} user
	 * @property {string} password
	 * @property {boolean} required
	 * @property {string} remoteUser
	 * @property {string} remotePassword
	 * @property {boolean} remoteRequired
	 */
	this.auth = {
		user: auth.user || '',
		password: auth.password || '',
		required: Boolean(auth.required)
	}

	/**
	 * @member {boolean}
	 * @readonly
	 */
	this.closed = false

	/**
	 * @member {Object}
	 * @property {Object} local
	 * @property {Object<Call>} local.map
	 * @property {Array<Call>} local.list
	 * @property {Object<boolean>} local.available - a map of available calls (true=compatible)
	 * @property {Object} remote
	 * @property {Object<Call>} remote.map
	 * @property {Array<Call>} remote.list
	 * @private
	 */
	this._calls = {
		local: {
			map: calls.local.map,
			list: calls.local.list,
			available: Object.create(null)
		},
		remote: {
			map: calls.remote.map,
			list: calls.remote.list
		}
	}

	/**
	 * @member {Object}
	 * @property {Object} local
	 * @property {Object<Message>} local.map
	 * @property {Array<Message>} local.list
	 * @property {Object<boolean>} local.available - a map of available messages (true=compatible)
	 * @property {Object} remote
	 * @property {Object<Message>} remote.map
	 * @property {Array<Message>} remote.list
	 * @private
	 */
	this._messages = {
		local: {
			map: messages.local.map,
			list: messages.local.list,
			available: Object.create(null)
		},
		remote: {
			map: messages.remote.map,
			list: messages.remote.list
		}
	}

	/**
	 * @member {boolean}
	 * @private
	 */
	this._handshakeDone = false

	/**
	 * @member {Connection}
	 * @private
	 */
	this._connection = connection

	// Set up listeners
	connection.on('frame', this._processFrame.bind(this))
	connection.on('close', this._close.bind(this))
	connection.on('error', this._error.bind(this))

	this._sendHandshake()
}

require('util').inherits(Peer, require('events').EventEmitter)
module.exports = Peer

var Type = require('./Type')

/**
 * @property {Type}
 * @private
 */
Peer._handshake = new Type({
	auth: {
		user: 'string',
		password: 'string',
		required: 'boolean'
	},
	calls: [{ // local calls
		id: 'uint',
		hash: 'Buffer'
	}],
	messages: [{ // local messages
		id: 'uint',
		hash: 'Buffer'
	}]
})

/**
 * Check if the remote can answer to a call
 * @param {string} name
 */
Peer.prototype.canCall = function (name) {
	return Boolean(this._calls.local.available[name])
}

/**
 * Make a call to the other side (remote)
 * @param {string} name - call name
 * @param {*} [data=null] - must follow the call input format
 * @param {number} [timeout=10e3] - call timeout in ms
 * @param {function(?Error,*)} callback - required
 */
Peer.prototype.call = function (name, data, timeout, callback) {

}

/**
 * Check if the remote accepts a message
 * @param {string} name
 */
Peer.prototype.canSend = function (name) {
	return Boolean(this._messages.local.available[name])
}

/**
 * Send a message to the other side (remote)
 * @param {string} name - message name
 * @param {*} [data] - must follow the message format
 */
Peer.prototype.send = function (name, data) {

}

/**
 * @param {Buffer} frame
 * @private
 */
Peer.prototype._processFrame = function (frame) {
	var data

	if (!this._handshakeDone) {
		try {
			data = Peer._handshake.read(frame)
		} catch (e) {
			return this._error(e)
		}
		return this._processHandshake(data)
	}


}

/**
 * @param {Error} error
 * @private
 */
Peer.prototype._error = function (error) {
	this._close()
	this.emit('error', error)
}

/**
 * @private
 */
Peer.prototype._close = function () {
	this._connection.close()
	this.closed = true
}

/**
 * Generate the handshake frame and send it
 * This must be the very first frame in the connection
 * @private
 */
Peer.prototype._sendHandshake = function () {
	var data = {
		auth: {
			user: this.auth.user,
			password: this.auth.password,
			required: this.auth.required
		},
		calls: this._calls.remote.list.map(function (call) {
			return {
				id: call.id,
				hash: call.hash
			}
		}),
		messages: this._messages.remote.list.map(function (message) {
			return {
				id: message.id,
				hash: message.hash
			}
		})
	}

	try {
		this._connection.sendFrame(Peer._handshake.write(data))
	} catch (e) {
		this._error(e)
	}
}

/**
 * Process incoming handshake data
 * @param {Object} data
 * @param {Object} data.auth
 * @param {string} data.auth.user
 * @param {string} data.auth.password
 * @param {boolean} data.auth.required
 * @param {Array} data.calls
 * @param {number} data.calls.id
 * @param {Buffer} data.calls.hash
 * @param {Array} data.messages
 * @param {number} data.messages.id
 * @param {Buffer} data.messages.hash
 * @private
 */
Peer.prototype._processHandshake = function (data) {
	// Check if both sides agree on authentication requirement
	if (this.auth.required && !(data.auth.user || data.auth.password)) {
		return this._error(new Error('Remote authentication was expected'))
	} else if (data.auth.required && !(this.auth.user || this.auth.password)) {
		return this._error(new Error('Remote expected authentication'))
	}

	this.auth.remoteUser = data.auth.user
	this.auth.remotePassword = data.auth.password
	this.auth.remoteRequired = data.auth.required

	// Save available calls and messages
	var localCalls = this._calls.local,
		localMessages = this._messages.local
	data.calls.forEach(function (call) {
		var localCall = localCalls.map[call.id]
		if (localCall) {
			localCalls.available[localCall.name] = checkHash(call.hash, localCall.hash)
		}
	})
	data.messages.forEach(function (message) {
		var localMessage = localMessages.map[message.id]
		if (localMessage) {
			localMessages.available[localMessage.name] = checkHash(message.hash, localMessage.hash)
		}
	}, this)

	/**
	 * @param {Buffer} a
	 * @param {Buffer} b
	 * @return {boolean}
	 */
	function checkHash(a, b) {
		var i, len
		if (a.length !== b.length) {
			return false
		}
		for (i = 0, len = a.length; i < len; i++) {
			if (a[i] !== b[i]) {
				return false
			}
		}
		return true
	}
}