'use strict'

/**
 * Represent a collection of registered calls and messages
 * Many peers can be linked to a context
 * @class
 */
function Context() {
	/**
	 * A map from call id and call name to signature
	 * @member {Object<Call>}
	 * @private
	 */
	this._clientCalls = Object.create(null)

	/**
	 * A map from call id and call name to signature
	 * @member {Object<Call>}
	 * @private
	 */
	this._serverCalls = Object.create(null)

	/**
	 * A map from msg id and msg name to signature
	 * @member {Object<Message>}
	 * @private
	 */
	this._clientMessages = Object.create(null)

	/**
	 * A map from msg id and msg name to signature
	 * @member {Object<Message>}
	 * @private
	 */
	this._serverMessages = Object.create(null)
}

module.exports = Context

var Call = require('./Call'),
	Message = require('./Message')

/**
 * Register a call a client can send to a server
 * @param {number} id
 * @param {string} name
 * @param {?string|Object} input - see Type constructor
 * @param {?string|Object} output - see Type constructor
 * @param {function(*,function(?Error,*))} [handler] - required in the server side
 */
Context.prototype.addClientCall = function (id, name, input, output, handler) {
	if (id in this._clientCalls) {
		throw new Error('Client call id ' + id + ' is already in use')
	} else if (name in this._clientCalls) {
		throw new Error('Client call name ' + name + ' is already in use')
	}

	this._clientCalls[id] = this._clientCalls[name] = new Call(id, name, input, output, handler)
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
	if (id in this._serverCalls) {
		throw new Error('Server call id ' + id + ' is already in use')
	} else if (name in this._serverCalls) {
		throw new Error('Server call name ' + name + ' is already in use')
	}

	this._serverCalls[id] = this._serverCalls[name] = new Call(id, name, input, output, handler)
}

/**
 * Register a message a cllient can send to a server
 * @param {number} id
 * @param {string} name
 * @param {?string|Object} input - see Type constructor
 * @param {function(*)} [handler] - required in the server side
 */
Context.prototype.addClientMessage = function (id, name, input, handler) {
	if (id in this._clientMessages) {
		throw new Error('Client message id ' + id + ' is already in use')
	} else if (name in this._clientMessages) {
		throw new Error('Client message name ' + name + ' is already in use')
	}

	this._clientMessages[id] = this._clientMessages[name] = new Message(id, name, input, handler)
}

/**
 * Register a message a server can send to a client
 * @param {number} id
 * @param {string} name
 * @param {?string|Object} input - see Type constructor
 * @param {function(*)} [handler] - required in the client side
 */
Context.prototype.addServerMessage = function (id, name, input, handler) {
	if (id in this._serverMessages) {
		throw new Error('Server message id ' + id + ' is already in use')
	} else if (name in this._serverMessages) {
		throw new Error('Server message name ' + name + ' is already in use')
	}

	this._serverMessages[id] = this._serverMessages[name] = new Message(id, name, input, handler)
}