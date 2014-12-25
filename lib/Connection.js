/**
 * This class documents the interface between the core and the fragmentation/connection layer
 * @class Connection
 * @extends EventEmitter
 */

/**
 * @event Connection#frame
 * @type {Buffer}
 */

/**
 * @event Connection#error
 * @type {Error}
 */

/**
 * @event Connection#close
 */

/**
 * @event Connection#connect
 */

/**
 * @member {boolean} Connection#hasConnected
 */

/**
 * @function Connection#close
 */

/**
 * @function Connection#sendFrame
 * @param {Buffer} frame
 */