import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { issueOtp } from "./issueOtp.js";
import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import routes from "../routes/users.js";

function store() {
  let record = { _id: "test-user", email: "otp@example.test", role: "user" };
  return {
    get record() { return record; },
    async findOneAndUpdate(_filter, update) {
      if (record.otpExpiresAt > new Date(Date.now() + 555_000)) return null;
      Object.assign(record, update.$set);
      return record;
    },
    async updateOne(filter) {
      if (record.otpHash === filter.otpHash) {
        delete record.otpHash;
        delete record.otpExpiresAt;
      }
    },
    async create(fields) { record = { _id: "pending", ...fields }; return record; },
    async deleteOne(filter) { if (record.otpHash === filter.otpHash) record = null; },
  };
}

test("OTP is persisted before delivery and overlapping resends do not replace it", async () => {
  const Model = store();
  let release;
  const sent = new Promise(resolve => { release = resolve; });
  const first = issueOtp({ Model, account: Model.record, email: Model.record.email, send: async (_email, code) => {
    assert.equal(Model.record.otpHash, createHash("sha256").update(code).digest("hex"));
    await sent;
  } });
  await assert.rejects(issueOtp({ Model, account: Model.record, email: Model.record.email, send: () => assert.fail("Second email must not be sent") }), { status: 429 });
  release();
  await first;
});

test("SMTP failure clears the undelivered code and permits retry", async () => {
  const Model = store();
  await assert.rejects(issueOtp({ Model, account: Model.record, email: Model.record.email, send: async () => { throw new Error("SMTP failed"); } }), /SMTP failed/);
  assert.equal(Model.record.otpHash, undefined);
  await issueOtp({ Model, account: Model.record, email: Model.record.email, send: async () => {} });
  assert.ok(Model.record.otpHash);
});

test("signup OTP is stored before its email is delivered", async () => {
  const Model = store();
  await issueOtp({ Model, email: "new@example.test", details: { mobile: "9999999999", username: "test" }, send: async (_email, code) => {
    assert.equal(Model.record.email, "new@example.test");
    assert.equal(Model.record.otpHash, createHash("sha256").update(code).digest("hex"));
  } });
});

test("real verify handler accepts delivered OTP, rejects wrong code, expiry and replay", async () => {
  const Model = store();
  let code;
  await issueOtp({ Model, account: Model.record, email: Model.record.email, send: async (_email, otp) => { code = otp; } });
  Model.record.save = async () => {};
  const originalFind = User.findOne;
  const originalState = mongoose.connection.readyState;
  User.findOne = () => ({ select: async () => Model.record });
  mongoose.connection.readyState = 1;
  const app = express();
  app.use(express.json());
  app.use("/api/users", routes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const verify = otp => fetch(`http://127.0.0.1:${server.address().port}/api/users/otp/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: " OTP@example.test ", otp }),
  });
  try {
    assert.equal((await verify("000000")).status, 401);
    const expiry = Model.record.otpExpiresAt;
    Model.record.otpExpiresAt = new Date(0);
    assert.equal((await verify(code)).status, 401);
    Model.record.otpExpiresAt = expiry;
    const response = await verify(code);
    assert.equal(response.status, 200);
    assert.ok((await response.json()).token);
    assert.equal((await verify(code)).status, 401);
  } finally {
    User.findOne = originalFind;
    mongoose.connection.readyState = originalState;
    await new Promise(resolve => server.close(resolve));
  }
});
