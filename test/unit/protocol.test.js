"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const protocol = require("../../src/python/protocol");
const errors = require("../../src/util/errors");

test("serializeRequest builds stage/payload/options envelope JSON", function () {
  const json = protocol.serializeRequest("pos_tagged", { tokenCount: 4 }, { strict: true });
  const parsed = JSON.parse(json);

  assert.equal(parsed.stage, "pos_tagged");
  assert.deepEqual(parsed.payload, { tokenCount: 4 });
  assert.deepEqual(parsed.options, { strict: true });
});

test("parseResponse accepts valid success envelope", function () {
  const response = protocol.parseResponse('{"ok":true,"result":{"k":1}}');
  assert.equal(response.ok, true);
  assert.deepEqual(response.result, { k: 1 });
});

test("parseResponse rejects invalid JSON with E_PYTHON_PROTOCOL_INVALID_JSON", function () {
  assert.throws(
    function () {
      protocol.parseResponse("not-json");
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON);
      return true;
    }
  );
});

test("parseResponse rejects incomplete envelopes with E_PYTHON_PROTOCOL_INVALID_JSON", function () {
  assert.throws(
    function () {
      protocol.parseResponse('{"ok":true}');
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON);
      return true;
    }
  );

  assert.throws(
    function () {
      protocol.parseResponse('{"ok":false,"error":{"code":"X"}}');
    },
    function (error) {
      assert.equal(error.code, errors.ERROR_CODES.E_PYTHON_PROTOCOL_INVALID_JSON);
      return true;
    }
  );
});
