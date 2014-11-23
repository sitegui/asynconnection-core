'use strict'

/**
 * @class
 * @extends EventEmitter
 * @param {Object} calls
 * @param {Object<Call>} calls.local - calls this side can make
 * @param {Object<Call>} calls.remote - calls this side can receive
 * @param {Object} messages
 * @param {Object<Message>} messages.local - messages this side can send
 * @param {Object<Message>} messages.remote - messages this side can receive
 * @param {Object} auth
 * @param {string} [auth.user='']
 * @param {string} [auth.password='']
 * @param {boolean} [auth.required=false] - if true, will require remote authentication
 * @param {EventEmitter} connection
 */
function Peer(calls, messages, auth, connection) {
	/** @member {{local: Object<Call>, remote: Object<Call>}} */
	this.calls = calls

	/** @member {{local: Object<Message>, remote: Object<Message>}} */
	this.messages = messages

	/** @member {Object} */
	this.auth = {}
	/** @member {string} */
	this.auth.user = auth.user || ''
	/** @member {string} */
	this.auth.password = auth.password || ''
	/** @member {boolean} */
	this.auth.required = Boolean(auth.required)
	/** @member {string} */
	this.auth.remoteUser = null
	/** @member {string} */
	this.auth.remotePassword = null
	/** @member {boolean} */
	this.auth.remoteRequired = null

	this._sendHandShake()
}

module.exports = Peer

var Type = require('./Type')

Peer._handShake = new Type({
	version: 'uint', // 1
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
 * Make a call to the other side (remote)
 * @param {string} name - call name
 * @param {*} [data=null] - must follow the call input format
 * @param {number} [timeout=10e3] - call timeout in ms
 * @param {function(?Error,*)} callback - required
 */
Peer.prototype.call = function (name, data, timeout, callback) {

}

/**
 * Send a message to the other side (remote)
 * @param {string} name - message name
 * @param {*} [data] - must follow the message format
 */
Peer.prototype.send = function (name, data) {

}

/**
 * This method should be called by the fragmentation layer
 * @param {Buffer} frame
 * @private
 */
Peer.prototype._processFrame = function (frame) {

}

/**
 * Generate the handshake frame and send it
 * This must be the very first frame in the connection
 */
Peer.prototype._sendHandShake = function () {
	var calls = [],
		messages = [],
		key

	for (key in this.calls.local) {

	}

	Peer._handShake.write({
		version: 1,
		auth: {
			user: this.auth.user,
			password: this.auth.password,
			required: this.auth.required
		},
		calls: calls,
		messages: messages
	})
}