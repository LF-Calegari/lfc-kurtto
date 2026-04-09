import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";

import app from "../src/app.js";

test("GET /api/v1/health returns service status", async () => {
  const response = await request(app).get("/api/v1/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.environment, process.env.NODE_ENV);
  assert.ok(response.body.timestamp);
  assert.equal(typeof response.body.uptime, "number");
});

test("GET /api/v1/documentation returns swagger ui page", async () => {
  const response = await request(app).get("/api/v1/documentation");

  assert.equal(response.status, 301);
  assert.match(response.headers.location ?? "", /\/api\/v1\/documentation\/$/);
});
