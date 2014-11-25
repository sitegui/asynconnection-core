'use strict'

/**
 * A collection of registered calls and messages.
 * Many `peers` can be linked to a context.
 * @class
 */
function Context() {
	/**
	 * @member {Object}
	 * @property {Object} client
	 * @property {Object<Call>} client.map - map from call name and call id
	 * @property {Array<Call>} client.list
	 * @property {Object} server
	 * @property {Object<Call>} server.map - map from call name and call id
	 * @property {Array<Call>} server.list
	 * @private
	 */
	this._calls = {
		client: {
			map: Object.create(null),
			list: []
		},
		server: {
			map: Object.create(null),
			list: []
		}
	}

	/**
	 * @member {Object}
	 * @property {Object} client
	 * @property {Object<Message>} client.map - map from message name and message id
	 * @property {Array<Message>} client.list
	 * @property {Object} server
	 * @property {Object<Message>} server.map - map from message name and message id
	 * @property {Array<Message>} server.list
	 * @private
	 */
	this._messages = {
		client: {
			map: Object.create(null),
			list: []
		},
		server: {
			map: Object.create(null),
			list: []
		}
	}
}

module.exports = Context

var Call = require('./Call'),
	Message = require('./Message'),
	Peer = require('./Peer')

/**
 * Register a call a client can send to a server
 * @param {number} id
 * @param {string} name
 * @param {?string|Object} input - see Type constructor
 * @param {?string|Object} output - see Type constructor
 * @param {function(*,function(?Error,*))} [handler] - required in the server side
 */
Context.prototype.addClientCall = function (id, name, input, output, handler) {
	var map = this._calls.client.map,
		list = this._calls.client.list
	if (id in map) {
		throw new Error('Client call id ' + id + ' is already in use')
	} else if (name in map) {
		throw new Error('Client call name ' + name + ' is already in use')
	}

	list.push(map[id] = map[name] = new Call(id, name, input, output, handler))
}

/**
 * Register a call a server can send to a client
 * @param {number} id
 * @param {string} name
 * @param {?string|Object} input - see Type constructor
 * @param {?string|Object} output - see Type constructor
 * @param {function(*,function(?Error,*))} [handler] - required in the client side
 */
Context.prototype.addServerCall = function (id, name, input, output, handler) {
	var map = this._calls.server.map,
		list = this._calls.server.list
	if (id in map) {
		throw new Error('Server call id ' + id + ' is already in use')
	} else if (name in map) {
		throw new Error('Server call name ' + name + ' is already in use')
	}

	list.push(map[id] = map[name] = new Call(id, name, input, output, handler))
}

/**
 * Register a message a cllient can send to a server
 * @param {number} id
 * @param {string} name
 * @param {?string|Object} input - see Type constructor
 * @param {function(*)} [handler] - required in the server side
 */
Context.prototype.addClientMessage = function (id, name, input, handler) {
	var map = this._messages.client.map,
		list = this._messages.client.list
	if (id in map) {
		throw new Error('Client message id ' + id + ' is already in use')
	} else if (name in map) {
		throw new Error('Client message name ' + name + ' is already in use')
	}

	list.push(map[id] = map[name] = new Message(id, name, input, handler))
}

/**
 * Register a message a server can send to a client
 * @param {number} id
 * @param {string} name
 * @param {?string|Object} input - see Type constructor
 * @param {function(*)} [handler] - required in the client side
 */
Context.prototype.addServerMessage = function (id, name, input, handler) {
	var map = this._messages.server.map,
		list = this._messages.server.list
	if (id in map) {
		throw new Error('Server message id ' + id + ' is already in use')
	} else if (name in map) {
		throw new Error('Server message name ' + name + ' is already in use')
	}

	list.push(map[id] = map[name] = new Message(id, name, input, handler))
}

/**
 * Create a peer from this context
 * This is intended to be called by the fragmentation layer
 * @param {boolean} isServer - which side to create (true=server-side, false=client-side)
 * @param {Object} auth
 * @param {string} [auth.user='']
 * @param {string} [auth.password='']
 * @param {boolean} [auth.required=false] - if true, will require remote authentication
 * @param {Connection} connection
 * @return {Peer}
 * @private
 */
Context.prototype._createPeer = function (isServer, auth, connection) {
	return new Peer({
		local: isServer ? this._calls.server : this._calls.client,
		remote: isServer ? this._calls.client : this._calls.server
	}, {
		local: isServer ? this._messages.server : this._messages.client,
		remote: isServer ? this._messages.client : this._messages.server
	}, auth, connection)
}