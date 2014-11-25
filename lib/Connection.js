/**
 * @file This class documents the interface between the core and the fragmentation/connection layer
 */
'use strict'

/**
 * @class
 * @extends EventEmitter
 */
function Connection() {}

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
 * @function Connection#close
 */

/**
 * @function Connection#sendFrame
 * @param {Buffer} frame
 */