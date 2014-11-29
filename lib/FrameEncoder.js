'use strict'

/**
 * Help encode/decode protocol frames
 * @class
 * @param {Peer} peer
 * @param {Connection} connection
 * @private
 */
function FrameEncoder(peer, connection) {
	/**
	 * @member {Peer}
	 * @private
	 */
	this._peer = peer

	/**
	 * @member {Connection}
	 * @private
	 */
	this._connection = connection
}

module.exports = FrameEncoder

var Type = require('./Type'),
	ReadState = require('./ReadState'),
	types = require('./types'),
	Data = require('./Data')

/**
 * @property {Type}
 * @private
 */
FrameEncoder._handshakeType = new Type({
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
 * @property {Type}
 * @private
 */
FrameEncoder._errorType = new Type({
	reason: 'string',
	code: 'uint'
})

/**
 * Generate the handshake frame and send it
 * This must be the very first frame in the connection
 * @param {Object} auth
 * @param {Array<Call>} calls
 * @param {Array<Message>} messages
 */
FrameEncoder.prototype.doHandshake = function (auth, calls, messages) {
	var data = {
		auth: {
			user: auth.user,
			password: auth.password,
			required: auth.required
		},
		calls: calls.map(function (call) {
			return {
				id: call.id,
				hash: call.hash
			}
		}),
		messages: messages.map(function (message) {
			return {
				id: message.id,
				hash: message.hash
			}
		})
	}

	this._connection.sendFrame(FrameEncoder._handshakeType.writeIntoBuffer(data))
}

/**
 * Generate the call frame and send it
 * @param {number} sid
 * @param {number} id
 * @param {?*} data
 * @param {?Type} type
 * @throws if badly formatted data
 */
FrameEncoder.prototype.doCall = function (sid, id, data, type) {
	// 0x00 <sid:uint> <id:uint> <data>
	var frame = new Data
	frame.writeUInt8(0)
	types.uint.write(sid, frame)
	types.uint.write(id, frame)
	if (type !== null) {
		type.write(data, frame)
	}
	this._connection.sendFrame(frame.toBuffer())
}

/**
 * Generate the message frame and send it
 * @param {number} id
 * @param {?*} data
 * @param {?Type} type
 * @throws if badly formatted data
 */
FrameEncoder.prototype.doSend = function (id, data, type) {
	// 0x01 <id:uint> <data>
	var frame = new Data
	frame.writeUInt8(1)
	types.uint.write(id, frame)
	if (type !== null) {
		type.write(data, frame)
	}
	this._connection.sendFrame(frame.toBuffer())
}

/**
 * Generate the answer frame and send it
 * This function was designed to be binded:
 * doAnswer.bind(frameEncoder, sid, type)
 * to act like an async callback function(err,response)
 * @param {number} sid
 * @param {?Type} type
 * @param {?Error} err
 * @param {*} data
 */
FrameEncoder.prototype.doAnswer = function (sid, type, err, data) {
	var reason, code
	if (err) {
		reason = String(err.message || err)
		code = typeof err.code === 'number' && err.code > 0 ? err.code : 0
		return this.doAnswerError(sid, reason, code)
	}
	this.doAnswerSuccess(sid, data, type)
}

/**
 * Generate the answer frame and send it
 * If any enconding errors occur:
 * * the call will be answer with error instead and
 * * 'error' event will be fired on Peer
 * @param {number} sid
 * @param {*} data
 * @param {Type} type
 */
FrameEncoder.prototype.doAnswerSuccess = function (sid, data, type) {
	// 0x02 <sid:uint> <data>
	var frame = new Data
	frame.writeUInt8(2)
	types.uint.write(sid, frame)
	if (type !== null) {
		try {
			type.write(data, frame)
		} catch (e) {
			// Answer with error and fire 'error' event
			this.doAnswerError(sid, 'Encoding error', 0)
			return this._peer.emit('error', e)
		}
	}
	this._connection.sendFrame(frame.toBuffer())
}

/**
 * Generate the answer frame and send it
 * @param {number} sid
 * @param {string} reason
 * @param {number} [code=0]
 */
FrameEncoder.prototype.doAnswerError = function (sid, reason, code) {
	// 0x03 <sid:uint> <data>
	var frame = new Data
	frame.writeUInt8(3)
	types.uint.write(sid, frame)
	FrameEncoder._errorType.write({
		reason: reason,
		code: code || 0
	}, frame)
	this._connection.sendFrame(frame.toBuffer())
}

/**
 * Read and route and incoming frame
 * @param {Buffer} frame
 */
FrameEncoder.prototype.processFrame = function (frame) {
	var state = new ReadState(frame),
		frameKind, sid, id, error

	if (!this._peer._handshakeReceived) {
		return this._peer._processHandshake(FrameEncoder._handshakeType.read(state))
	}

	frameKind = state.readUInt8()
	if (frameKind === 0) {
		// Call
		sid = types.uint.read(state)
		id = types.uint.read(state)
		this._peer._processCall(sid, id, state)
	} else if (frameKind === 1) {
		// Message
		id = types.uint.read(state)
		this._peer._processMessage(id, state)
	} else if (frameKind === 2) {
		// Success response
		sid = types.uint.read(state)
		this._peer._processResponse(sid, state)
	} else if (frameKind === 3) {
		// Error response
		sid = types.uint.read(state)
		error = FrameEncoder._errorType.read(state)
		this._peer._processError(sid, error.reason, error.code)
	} else {
		throw new Error('Protocol error, invalid frame kind: ' + frameKind)
	}
}