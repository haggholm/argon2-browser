'use strict';

var Module = require('./argon2-asm.min');

/**
 * @enum
 */
var ArgonType = {
	Argon2d: 0,
	Argon2i: 1,
	Argon2id: 2
};

function loadScript(src) {
	return new Promise(function(resolve, reject) {
		if (typeof importScripts === 'function') {
			importScripts(src);
			resolve();
		} else {
			var el = document.createElement("script");
			el.src = src;
			el.onload = function() { resolve(); };
			el.onerror = function() { reject('Error loading script'); };
			document.body.appendChild(el);
		}
	});
}

function allocateArray(strOrArr) {
	var arr = strOrArr instanceof Uint8Array || strOrArr instanceof Array ? strOrArr
		: Module.intArrayFromString(strOrArr);
	return Module.allocate(arr, 'i8', Module.ALLOC_NORMAL);
}

/**
 * Argon2 hash
 * @param {string|Uint8Array} params.pass - password string
 * @param {string|Uint8Array} params.salt - salt string
 * @param {number} [params.time=1] - the number of iterations
 * @param {number} [params.mem=1024] - used memory, in KiB
 * @param {number} [params.hashLen=24] - desired hash length
 * @param {number} [params.parallelism=1] - desired parallelism
 * @param {number} [params.type=argon2.ArgonType.Argon2d] - hash type:
 *      argon2.ArgonType.Argon2d
 *      argon2.ArgonType.Argon2i
 *      argon2.ArgonType.Argon2id
 * @param {number} [params.distPath=.] - asm.js script location, without trailing slash
 *
 * @return Promise
 *
 * @example
 *  argon2.hash({ pass: 'password', salt: 'somesalt' })
 *      .then(h => console.log(h.hash, h.hashHex, h.encoded))
 *      .catch(e => console.error(e.message, e.code))
 */
function argon2Hash(params) {
	var tCost = params.time || 1;
	var mCost = params.mem || 1024;
	var parallelism = params.parallelism || 1;
	var pwd = allocateArray(params.pass);
	var pwdlen = params.pass.length;
	var salt = allocateArray(params.salt);
	var saltlen = params.salt.length;
	var hash = Module.allocate(new Array(params.hashLen || 24), 'i8', Module.ALLOC_NORMAL);
	var hashlen = params.hashLen || 24;
	var encoded = Module.allocate(new Array(512), 'i8', Module.ALLOC_NORMAL);
	var encodedlen = 512;
	var argon2Type = params.type || argon2.ArgonType.Argon2d;
	var version = 0x13;
	var err;
	try {
		var res = Module._argon2_hash(tCost, mCost, parallelism, pwd, pwdlen, salt, saltlen,
			hash, hashlen, encoded, encodedlen, argon2Type, version);
	} catch (e) {
		err = e;
	}
	var result;
	if (res === 0 && !err) {
		var hashStr = '';
		var hashArr = new Uint8Array(hashlen);
		for (var i = 0; i < hashlen; i++) {
			var byte = Module.HEAP8[hash + i];
			hashArr[i] = byte;
			hashStr += ('0' + (0xFF & byte).toString(16)).slice(-2);
		}
		var encodedStr = Module.Pointer_stringify(encoded);
		result = { hash: hashArr, hashHex: hashStr, encoded: encodedStr };
	} else {
		try {
			if (!err) {
				err = Module.Pointer_stringify(Module._argon2_error_message(res))
			}
		} catch (e) {
		}
		result = { message: err, code: res };
	}
	try {
		Module._free(pwd);
		Module._free(salt);
		Module._free(hash);
		Module._free(encoded);
	} catch (e) { }
	if (err) {
		throw result;
	} else {
		return result;
	}
}

/**
 * Argon2 verify function
 * @param {string} params.pass - password string
 * @param {string|Uint8Array} params.encoded - encoded hash
 * @param {number} [params.type=argon2.ArgonType.Argon2d] - hash type:
 *      argon2.ArgonType.Argon2d
 *      argon2.ArgonType.Argon2i
 *      argon2.ArgonType.Argon2id
 *
 * @returns Promise
 *
 * @example
 *  argon2.verify({ pass: 'password', encoded: 'encoded-hash' })
 *      .then(() => console.log('OK'))
 *      .catch(e => console.error(e.message, e.code))
 */
function argon2Verify(params) {
	var pwd = allocateArray(params.pass);
	var pwdlen = params.pass.length;
	var enc = allocateArray(params.encoded);
	var argon2Type = params.type;
	if (argon2Type === undefined) {
		var typeStr = params.encoded.split('$')[1];
		if (typeStr) {
			typeStr = typeStr.replace('a', 'A');
			argon2Type = ArgonType[typeStr] || ArgonType.Argon2d;
		}
	}
	var err;
	try {
		var res = Module._argon2_verify(enc, pwd, pwdlen, argon2Type);
	} catch (e) {
		err = e;
	}
	var result;
	if (res || err) {
		try {
			if (!err) {
				err = Module.Pointer_stringify(Module._argon2_error_message(res))
			}
		} catch (e) {
		}
		result = { message: err, code: res };
	}
	try {
		Module._free(pwd);
		Module._free(enc);
	} catch (e) { }
	if (err) {
		throw result;
	} else {
		return result;
	}
}

module.exports = {
	ArgonType: ArgonType,
	hash: argon2Hash,
	verify: argon2Verify
};
