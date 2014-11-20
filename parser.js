/**
 * @file Parse a signature string
 * <signature>:
 *     <id> <name><input><output>
 *
 * <id>: '#' \d+
 *
 * <name>: \w+
 *
 * <input>:
 *     '(' <type> ')'
 *     ''
 *
 * <output>:
 *     ' -> ' <type>
 *     ''
 *
 * <type>:
 *     <basic>
 *     <object>
 *
 * <basic>:
 *     'uint'
 *     'int'
 *     'float'
 *     'string'
 *     'Buffer'
 *     'boolean'
 *     'json'
 *     'oid'
 *     'regex'
 *     'date'
 *
 * <object>:
 *     <field> ', ' <object>
 *     <field>
 *
 * <field>:
 *     <field_name> '[]: ' <field_type>
 *     <field_name> ': ' <field_type>
 *
 * <field_name>:
 *     <name> '?'
 *     <name>
 *
 * <field_type>:
 *     <basic>
 *     '(' <object> ')'
 */
'use strict'

/**
 * @var {Object<Function>}
 */
var nonTerminals = Object.create(null),
	Type = require('./Type'),
	Field = require('./Field'),
	Signature = require('./Signature')

/**
 * @param {string} str
 * @returns {?Signature}
 */
module.exports = function (str) {
	return parse('signature', str)
}

/**
 * @param {string} nonTerminal
 * @param {string} str
 * @return {?Object} - AST
 */
function parse(nonTerminal, str) {
	var state = {
			str: str,
			pos: 0
		},
		tree = {
			els: []
		},
		fn = nonTerminals[nonTerminal]
	return (fn(state, tree) && state.pos === str.length) ? tree.els[0] : null
}

/**
 * @typedef {Object} Tree
 * @property {string} name
 * @property {Array<Tree>} els
 */

/**
 * Create a now terminal matcher
 * @param {string} name
 * @param {function(Tree)} filterTree - null to use default
 * @param {...string|Function|Array<Function|string>} fns
 * @return {Function}
 */
function createNT(name, filterTree /*, ...fns*/ ) {
	var fns = [].slice.call(arguments, 2).map(createRule)
	return (nonTerminals[name] = function (s, t) {
		var save = s.pos,
			me = {
				name: name,
				els: []
			}
		return fns.some(function (fn) {
			s.pos = save
			me.els.length = 0
			return fn(s, me)
		}) && t.els.push(filterTree ? filterTree(me) : me)
	})
}

/**
 * Create a rule
 * @param {string|Function|Array<Function|string>} fns
 * @return {Function}
 */
function createRule(fns) {
	if (!Array.isArray(fns)) {
		fns = [fns]
	}
	return function (s, t) {
		return fns.every(function (fn, i) {
			return (typeof fn === 'string' ? fns[i] = nonTerminals[fn] : fn)(s, t)
		})
	}
}

/**
 * Match one of chars
 * @param {string} chars
 * @returns {Function}
 */
function char(chars) {
	return function (s, t) {
		t.els.push(s.str[s.pos])
		return chars.indexOf(s.str[s.pos++]) !== -1
	}
}

/**
 * Match a string
 * @param {string} str
 * @returns {Function}
 */
function string(str) {
	return function (s, t) {
		t.els.push(str)
		return s.str.substr(s.pos).indexOf(str) === 0 && (s.pos += str.length)
	}
}

/**
 * Match with a regex
 * @param {RegExp} rg
 * @returns {Function}
 */
function regex(rg) {
	return function (s, t) {
		var match = s.str.substr(s.pos).match(rg)
		return match && t.els.push(match[0]) && (s.pos += match[0].length)
	}
}

// <id> <name><input><output>
// Signature
createNT('signature', function (t) {
	return new Signature(t.els[0], t.els[2], t.els[3], t.els[4])
}, ['id', char(' '), 'name', 'input', 'output'])

// '#' \d+
// number
createNT('id', function (t) {
	return Number(t.els[1])
}, [char('#'), regex(/\d+/)])

// \w+
// string
createNT('name', function (t) {
	return t.els[0]
}, regex(/\w+/))

// '(' <type> ')' | ''
// ?Type
createNT('input', function (t) {
	return t.els[1] || null
}, [char('('), 'type', char(')')], [])

// ' -> ' <type> | ''
// ?Type
createNT('output', function (t) {
	return t.els[1] || null
}, [string(' -> '), 'type'], [])

// <basic> | <object>
// Type
createNT('type', function (t) {
	return t.els[0]
}, 'basic', 'object')

// 'uint' | 'int' | 'float' | 'string' | 'Buffer' | 'boolean' | 'json' | 'oid' | 'regex' | 'date'
// Type
createNT('basic', function (t) {
	return new Type(Type[t.els[0].toUpperCase()])
}, string('uint'), string('int'), string('float'), string('string'), string('Buffer'), string('boolean'), string('json'), string('oid'), string('regex'), string('date'))

// <field> ', ' <object> | <field>
// Type
createNT('object', function (t) {
	if (t.els.length === 3) {
		t.els[2].fields.unshift(t.els[0])
		return t.els[2]
	} else {
		var type = new Type(Type.OBJECT)
		type.fields = t.els
		return type
	}
}, ['field', string(', '), 'object'], 'field')

// <field_name> '[]: ' <field_type> | <field_name> ': ' <field_type>
// Field
createNT('field', function (t) {
	var field = new Field()
	field.name = t.els[0].name
	field.optional = t.els[0].optional
	field.array = t.els[1].indexOf('[]') !== -1
	field.type = t.els[2]
	return field
}, ['field_name', string('[]: '), 'field_type'], ['field_name', string(': '), 'field_type'])

// <name> '?' | <name>
// {name: string, optional: boolean}
createNT('field_name', function (t) {
	return {
		name: t.els[0],
		optional: t.els.length === 2
	}
}, ['name', char('?')], 'name')

// <basic> | '(' <object> ')'
// Type
createNT('field_type', function (t) {
	return t.els[1] || t.els[0]
}, 'basic', [char('('), 'object', char(')')])