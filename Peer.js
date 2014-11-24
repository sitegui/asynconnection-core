'use strict'

var FrameEncoder

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
	 * @member {boolean}
	 * @readonly
	 */
	this.handshakeDone = false

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
	 * @member {Connection}
	 * @private
	 */
	this._connection = connection

	/**
	 * @member {FrameEncoder}
	 * @private
	 */
	this._encoder = new FrameEncoder(this, connection)

	/**
	 * @typedef {Object} Peer~PendingCall
	 * @property {Function} callback
	 * @property {?Timer} timer - timeout timer
	 */

	/**
	 * @member {Array<Peer~PendingCall>}
	 * @private
	 */
	this._pendingCalls = []

	// Set up listeners
	connection.on('frame', this._processFrame.bind(this))
	connection.on('close', this._close.bind(this))
	connection.on('error', this._error.bind(this))

	this._sendHandshake()
}

require('util').inherits(Peer, require('events').EventEmitter)
module.exports = Peer

var Data = require('./Data'),
	types = require('./types')
FrameEncoder = require('./FrameEncoder')

/**
 * Protocol errors
 * @enum {number}
 */
Peer.ERROR = {
	OTHER: 0,
	TIMEOUT: -1,
	CLOSED: -2
}

/**
 * Check if the remote can answer to a call
 * @param {string} name
 */
Peer.prototype.canCall = function (name) {
	return Boolean(this._calls.local.available[name])
}

/**
 * Make a call to the other side (remote)
 * The callback will be executed asynchronously and only once
 * Making an unsupported call is considered error
 * If the remote answers the call after the timeout has fired, the response will be ignored
 * If no response is expected, you should send messages, not make calls!
 * All errors related to this call will be routed to the callback (including invalid input format)
 * One can check if the error was raised locally or by the remote (as a response) by checking the `isLocal` flag in the Error object
 * @param {string} name - call name
 * @param {*} [data=null] - must follow the call input format
 * @param {number} [timeout=10e3] - call timeout in ms (0 means no timeout)
 * @param {function(?Error,*)} callback - required
 */
Peer.prototype.call = function (name, data, timeout, callback) {
	var that = this

	if (typeof data === 'function') {
		callback = data
		data = null
		timeout = 10e3
	} else if (typeof timeout === 'function') {
		callback = timeout
		timeout = 10e3
	} else if (typeof callback !== 'function') {
		throw new TypeError('A callback must be supplied. ' +
			'If no response is expected, you should send messages, not make calls')
	}
	data = data === undefined ? null : data

	var localCall = this._calls.local.map[name]
	if (this.closed) {
		return asyncError('Connection is closed', Peer.ERROR.CLOSED)
	} else if (!localCall) {
		return asyncError('Local call ' + name + ' not found. Have you added it?', Peer.ERROR.OTHER)
	} else if (!this.canCall(name)) {
		return asyncError('The remote does not give support for call ' + name, Peer.ERROR.OTHER)
	} else if (localCall.input && data === null) {
		return asyncError('This call expects some input, null was given', Peer.ERROR.OTHER)
	} else if (!localCall.input && data !== null) {
		return asyncError('This call does not expect input, but got ' + data, Peer.ERROR.OTHER)
	}

	// Encode the data
	try {
		data = data === null ? new Buffer(0) : localCall.input.write(data)
	} catch (e) {
		return asyncError(e.message, Peer.ERROR.OTHER)
	}

	this._doCall(localCall.id, data, timeout, callback)

	/**
	 * Mixing async and sync is a bad idea, so we make sure the callback is called async-ly
	 * @param {string} message
	 * @param {number} code
	 */
	function asyncError(message, code) {
		var err = that._createLocalError(message, code)
		process.nextTick(function () {
			callback(err)
		})
	}
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
 * @param {number} id
 * @param {Buffer} data
 * @param {number} timeout
 * @param {Function} callback
 * @private
 */
Peer.prototype._doCall = function (id, data, timeout, callback) {
	var sequenceId = this._pendingCalls.length,
		frame = new Data,
		timer

	// Create the call frame
	// 0x00 <sid:uint> <id:uint> <data>
	frame.writeUInt8(0)
	types.uint.write(sequenceId, frame)
	types.uint.write(id, frame)
	frame.appendBuffer(data)
	this._connection.sendFrame(frame.toBuffer())

	// Set timeout
	if (timeout) {
		timer = setTimeout(this._timeoutCall.bind(this, sequenceId), timeout)
	}

	// Save call data
	this._pendingCalls.push({
		callback: callback,
		timer: timer
	})
}

/**
 * Process the timeout of a call
 * @param {number} sid - sequential id
 * @private
 */
Peer.prototype._timeoutCall = function (sid) {
	var pendingCall = this._pendingCalls[sid]
	if (pendingCall) {
		delete this._pendingCalls[sid]
		pendingCall.callback(this._createLocalError('Timed out', Peer.ERROR.TIMEOUT))
	}
}

/**
 * @param {Buffer} frame
 * @private
 */
Peer.prototype._processFrame = function (frame) {
	try {
		this._encoder.processFrame(frame)
	} catch (e) {
		return this._error(e)
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
 * @param {string} message
 * @param {number} code - protocol errors are negative
 * @return {Error}
 * @private
 */
Peer.prototype._createLocalError = function (message, code) {
	var err = new Error(message)
	err.isLocal = true
	err.code = code
	return err
}

/**
 * @private
 */
Peer.prototype._close = function () {
	this._connection.close()
	if (!this.closed) {
		this.closed = true

		// Send closed error to all pending calls
		this._pendingCalls.forEach(function (pendingCall) {
			pendingCall.callback(this._createLocalError('Connection has closed', Peer.ERROR.CLOSED))
			pendingCall.timer && clearTimeout(pendingCall.timer)
		}, this)
		this._pendingCalls = []
	}
}

/**
 * Generate the handshake frame and send it
 * This must be the very first frame in the connection
 * @private
 */
Peer.prototype._sendHandshake = function () {
	try {
		this._encoder.doHandshake(this.auth, this._calls.remote.list, this._messages.remote.list)
	} catch (e) {
		this._error(e)
	}
}

/**
 * Process incoming handshake data (called by FrameEncoder)
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

	this.handshakeDone = true

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

/**
 * Process incoming call (called by FrameEncoder)
 * @param {number} sid
 * @param {number} id
 * @param {ReadState} data
 * @private
 */
Peer.prototype._processCall = function (sid, id, data) {

}

/**
 * Process incoming message (called by FrameEncoder)
 * @param {number} id
 * @param {ReadState} data
 * @private
 */
Peer.prototype._processMessage = function (id, data) {

}

/**
 * Process incoming call success response (called by FrameEncoder)
 * @param {number} sid
 * @param {ReadState} data
 * @private
 */
Peer.prototype._processResponse = function (sid, data) {

}

/**
 * Process incoming call error response (called by FrameEncoder)
 * @param {number} sid
 * @param {string} reason
 * @param {number} code
 * @private
 */
Peer.prototype._processError = function (sid, reason, code) {

}