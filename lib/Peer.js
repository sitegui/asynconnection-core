'use strict'

var EventEmitter = require('events').EventEmitter,
	FrameEncoder

/**
 * Fired when the connection is ready
 * @event Peer#connect
 */

/**
 * @event Peer#error
 * @type {Error}
 */

/**
 * Emited when the connection is closed and no more activity will happen
 * @event Peer#close
 */

/**
 * @callback Peer~AuthHandler
 * @this {Peer}
 * @param {string} user
 * @param {string} password
 * @param {function(?Error)} done
 */

/**
 * @typedef {Object} Peer~Auth
 * @property {string} user
 * @property {boolean} required
 * @property {Peer~AuthHandler} handler
 * @property {string} remoteUser
 */

/**
 * @typedef {Object} Peer~PendingCall
 * @property {Function} callback
 * @property {Call} call
 * @property {?Timer} timer - timeout timer
 */

/**
 * Represent one of the sides in the protocol.
 * This class exposes most of the interface the final user will interact with
 * NOTE: This class should not instantiated directly. See {@link Context#_createPeer}
 * @class
 * @extends EventEmitter
 * @param {Object} calls
 * @param {Object} messages
 * @param {Object} auth
 * @param {string} [auth.user='']
 * @param {string} [auth.password='']
 * @param {boolean} [auth.required=false] - if true, will require remote authentication
 * @param {Peer~AuthHandler} [auth.handler] - the default handler accepts any user/password
 * @param {Connection} connection
 */
function Peer(calls, messages, auth, connection) {
	var that = this
	EventEmitter.call(this)

	/**
	 * @member {Peer~Auth}
	 */
	this.auth = {
		user: auth.user || '',
		required: Boolean(auth.required),
		handler: auth.handler || function (user, password, done) {
			done()
		},
		remoteUser: ''
	}

	/**
	 * Whether the connection has been closed and nothing more can be done.
	 * Note that 'error' events may still be raised after 'close'
	 * @member {boolean}
	 * @readonly
	 */
	this.closed = false

	/**
	 * Whether the handshake has been completed
	 * @member {boolean} Peer#handshakeDone
	 * @readonly
	 */
	Object.defineProperty(this, 'handshakeDone', {
		enumerable: true,
		get: function () {
			return this._localHandshake === Peer._HANDSHAKE_STATE.DONE &&
				this._remoteHandshake === Peer._HANDSHAKE_STATE.DONE
		}
	})

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
	 * @member {Array<Peer~PendingCall>}
	 * @private
	 */
	this._pendingCalls = []

	/**
	 * @member {Peer.HANDSHAKE_STATE}
	 * @private
	 */
	this._localHandshake = Peer._HANDSHAKE_STATE.STARTING

	/**
	 * @member {Peer.HANDSHAKE_STATE}
	 * @private
	 */
	this._remoteHandshake = Peer._HANDSHAKE_STATE.STARTING

	// Set up listeners
	connection.once('close', this.close.bind(this))
	connection.on('frame', this._processFrame.bind(this))
	connection.on('error', this._error.bind(this))

	// Start the handshake process (or wait for connect)
	if (connection.hasConnected) {
		start()
	} else {
		connection.once('connect', start)
	}
	
	function start() {
		var password = auth.password || ''
		that._encoder.doHandshake(that.auth.user, password, calls.remote.list, messages.remote.list)
		that._localHandshake = Peer._HANDSHAKE_STATE.WAITING
	}
}

require('util').inherits(Peer, EventEmitter)
module.exports = Peer

FrameEncoder = require('./FrameEncoder')

/**
 * Protocol error codes
 * Negative codes are always generated locally. Codes 1xxx are reserved for protocol use
 * @enum {number}
 */
Peer.ERROR = {
	/**
	 * The call has timed out.
	 * If the answer is received after the timeout, it will be ignored
	 */
	TIMEOUT: -1,
	/**
	 * The connection was closed before this call could be answer.
	 */
	CLOSED: -2,
	/**
	 * The remote has not attached a handler to this call type
	 */
	NOT_IMPLEMENTED: 1000,
	/**
	 * The call input data was badly formatted.
	 * You should never see this error, since the local code validates the data before sending it
	 */
	INVALID_DATA: 1001,
	/**
	 * The remote misbehaved and could not answer the call correctly
	 * It's caused by invalid answer format
	 */
	INTERNAL: 1002
}

/**
 * @enum {number}
 * @private
 */
Peer._HANDSHAKE_STATE = {
	STARTING: 0,
	WAITING: 1,
	DONE: 2
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
	var sequenceId, timer

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

	var localCall = this._calls.local.map[name]
	if (this.closed) {
		return asyncError(this._createLocalError('Connection is closed', Peer.ERROR.CLOSED))
	} else if (!this.handshakeDone) {
		return asyncError(this._createLocalError('Connection is not ready'))
	} else if (!localCall) {
		return asyncError(this._createLocalError('Local call ' + name + ' not found'))
	} else if (!this.canCall(name)) {
		return asyncError(this._createLocalError('The remote does not give support for call ' + name))
	}

	sequenceId = this._pendingCalls.length

	// Encode the data
	try {
		this._encoder.doCall(sequenceId, localCall.id, data, localCall.input)
	} catch (e) {
		e.isLocal = true
		return asyncError(e)
	}

	// Set timeout
	if (timeout) {
		timer = setTimeout(this._timeoutCall.bind(this, sequenceId), timeout)
	}

	// Save call info
	this._pendingCalls.push({
		callback: callback,
		call: localCall,
		timer: timer
	})

	/**
	 * Mixing async and sync is a bad idea, so we make sure the callback is called async-ly
	 * @param {Error} err
	 */
	function asyncError(err) {
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
 * This is a fire-and-forget operation, any error will not be informed
 * If it is important to know whether the remote has received the message, consider using calls
 * By default (strict=false), no feedback is given
 * @param {string} name - message name
 * @param {*} [data] - must follow the message format
 * @param {boolean} [strict=false] - whether to throw error if the operation is invalid
 * @throws if strict and some error occurs locally
 */
Peer.prototype.send = function (name, data, strict) {
	var localMessage = this._messages.local.map[name],
		that = this

	if (strict) {
		// Let errors be thrown
		return _send()
	}
	try {
		_send()
	} catch (e) {
		// Ignore errors
	}

	function _send() {
		if (that.closed) {
			throw new Error('Connection is closed')
		} else if (!that.handshakeDone) {
			throw new Error('Connection is not ready')
		} else if (!localMessage) {
			throw new Error('Local message ' + name + ' not found. Have you added it?')
		} else if (!that.canSend(name)) {
			throw new Error('The remote does not give support for message ' + name)
		}

		// Encode and send (let errors be thrown)
		that._encoder.doSend(localMessage.id, data, localMessage.input)
	}
}

/**
 * Close the connection and drop all pending calls
 */
Peer.prototype.close = function () {
	if (this.closed) {
		return
	}

	this.closed = true
	this._connection.close()

	// Send closed error to all pending calls
	this._pendingCalls.forEach(function (pendingCall) {
		var err = this._createLocalError('Connection has closed', Peer.ERROR.CLOSED)
		process.nextTick(pendingCall.callback.bind(this, err))
		pendingCall.timer && clearTimeout(pendingCall.timer)
	}, this)
	this._pendingCalls = []

	// Clean up events
	this._connection.removeAllListeners('close').removeAllListeners('frame').removeAllListeners('connect')

	this.emit('close')
	this.removeAllListeners('close')
}

/**
 * Process the timeout of a call
 * @param {number} sid - sequential id
 * @private
 */
Peer.prototype._timeoutCall = function (sid) {
	var pendingCall = this._pendingCalls[sid],
		err = this._createLocalError('Timed out', Peer.ERROR.TIMEOUT)
	if (pendingCall) {
		delete this._pendingCalls[sid]
		process.nextTick(pendingCall.callback.bind(this, err))
	}
}

/**
 * Process each incoming frame (called by the Connection)
 * @param {Buffer} frame
 * @private
 */
Peer.prototype._processFrame = function (frame) {
	if (this.closed) {
		return
	}
	try {
		if (this.handshakeDone) {
			this._encoder.processFrame(frame)
		} else if (this._remoteHandshake === Peer._HANDSHAKE_STATE.STARTING) {
			this._processHandshake(this._encoder.readHandshake(frame))
		} else if (this._localHandshake === Peer._HANDSHAKE_STATE.WAITING) {
			this._processHandshakeAnswer(this._encoder.readHandshakeAnswer(frame))
		} else {
			throw new Error('Unexpected frame before handshake is completed')
		}
	} catch (e) {
		this._error(e)
	}
}

/**
 * Emit an error event and close the connection
 * @param {Error} error
 * @private
 */
Peer.prototype._error = function (error) {
	this.close()
	this.emit('error', error)
}

/**
 * @param {string} message
 * @param {number} [code] - protocol errors are negative
 * @return {Error}
 * @private
 */
Peer.prototype._createLocalError = function (message, code) {
	var err = new Error(message)
	err.isLocal = true
	if (code) {
		err.code = code
	}
	return err
}

/**
 * Process incoming handshake data
 * @param {Object} data
 * @param {Object} data.auth
 * @param {string} data.auth.user
 * @param {string} data.auth.password
 * @param {Array} data.calls
 * @param {number} data.calls.id
 * @param {Buffer} data.calls.hash
 * @param {Array} data.messages
 * @param {number} data.messages.id
 * @param {Buffer} data.messages.hash
 * @private
 */
Peer.prototype._processHandshake = function (data) {
	var that = this

	this._remoteHandshake = Peer._HANDSHAKE_STATE.WAITING

	// Check if remote has authenticated when we want it to
	if (this.auth.required && !(data.auth.user || data.auth.password)) {
		this._encoder.doAnswerHandshake('Authentication is required')
		this._remoteHandshake = Peer._HANDSHAKE_STATE.DONE
		return this._error(new Error('Remote authentication was expected'))
	}

	this.auth.remoteUser = data.auth.user

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

	// Execute handshake handler
	process.nextTick(this.auth.handler.bind(this, data.auth.user, data.auth.password, function (err) {
		that._remoteHandshake = Peer._HANDSHAKE_STATE.DONE
		if (that.closed) {
			// Nothing to do here
			return
		}
		that._encoder.doAnswerHandshake(err)
		if (err) {
			that._error(err)
		} else if (that.handshakeDone) {
			that.emit('connect')
			that.removeAllListeners('connect')
		}
	}))
}

/**
 * Check if two hashes are equal
 * @param {Buffer} a
 * @param {Buffer} b
 * @return {boolean}
 * @priavate
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

/**
 * Process the handshake answer
 * @param {Object} data
 * @param {boolean} data.ok
 * @private
 */
Peer.prototype._processHandshakeAnswer = function (data) {
	this._localHandshake = Peer._HANDSHAKE_STATE.DONE
	if (data.error !== undefined) {
		this._error(new Error('Handshake failed: ' + data.error))
	} else if (this.handshakeDone) {
		this.emit('connect')
		this.removeAllListeners('connect')
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
	var remoteCall = this._calls.remote.map[id],
		inputData = null,
		done
	if (!remoteCall || !remoteCall.handler) {
		return this._encoder.doAnswerError(sid, 'Not implemented', Peer.ERROR.NOT_IMPLEMENTED)
	}

	if (remoteCall.input) {
		try {
			inputData = remoteCall.input.read(data)
		} catch (e) {
			// This should not happen normally, because signatures are checked on handshake
			// and data format is checked by remote peer
			return this._encoder.doAnswerError(sid, 'Invalid input data', Peer.ERROR.INVALID_DATA)
		}
	}

	done = this._encoder.doAnswer.bind(this._encoder, sid, remoteCall)
	process.nextTick(remoteCall.handler.bind(this, inputData, done))
}

/**
 * Process incoming message (called by FrameEncoder)
 * @param {number} id
 * @param {ReadState} data
 * @private
 */
Peer.prototype._processMessage = function (id, data) {
	var remoteMessage = this._messages.remote.map[id],
		inputData = null
	if (!remoteMessage || !remoteMessage.handler) {
		// Not implemented
		return
	}

	if (remoteMessage.input) {
		try {
			inputData = remoteMessage.input.read(data)
		} catch (e) {
			// Encoding errors are ignored for messages
			return
		}
	}

	process.nextTick(remoteMessage.handler.bind(this, inputData))
}

/**
 * Process incoming call success response (called by FrameEncoder)
 * @param {number} sid
 * @param {ReadState} data
 * @private
 */
Peer.prototype._processResponse = function (sid, data) {
	var pendingCall = this._pendingCalls[sid],
		outputData = null
	if (!pendingCall) {
		// Not found (may have already been answered or timed out)
		return
	}

	// Remove it from the list of pending calls
	delete this._pendingCalls[sid]
	pendingCall.timer && clearTimeout(pendingCall.timer)

	if (pendingCall.call.output) {
		try {
			outputData = pendingCall.call.output.read(data)
		} catch (e) {
			e.isLocal = true
			return process.nextTick(pendingCall.callback.bind(this, e))
		}
	}

	process.nextTick(pendingCall.callback.bind(this, null, outputData))
}

/**
 * Process incoming call error response (called by FrameEncoder)
 * @param {number} sid
 * @param {string} reason
 * @param {number} code
 * @private
 */
Peer.prototype._processError = function (sid, reason, code) {
	var pendingCall = this._pendingCalls[sid],
		err
	if (!pendingCall) {
		// Not found (may have already been answered or timed out)
		return
	}

	// Remove it from the list of pending calls
	delete this._pendingCalls[sid]
	pendingCall.timer && clearTimeout(pendingCall.timer)

	// Call with error
	err = new Error(reason)
	err.isLocal = false
	if (code) {
		err.code = code
	}
	process.nextTick(pendingCall.callback.bind(this, err))
}