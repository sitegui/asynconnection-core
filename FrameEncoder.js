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
	types = require('./types')

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

	this._connection.sendFrame(FrameEncoder._handshakeType.write(data))
}

/**
 * Read and route and incoming frame
 * @param {Buffer} frame
 */
FrameEncoder.prototype.processFrame = function (frame) {
	var state = new ReadState(frame),
		frameKind, sid, id, error

	if (!this._peer.handshakeDone) {
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