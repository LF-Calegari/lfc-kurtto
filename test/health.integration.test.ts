import assert from "node:assert/strict";
import test from "node:test";

import express from "express";
import request from "supertest";

import app from '../src/app.js';
import { env } from '../src/config/env.js';
import errorHandler from '../src/middlewares/errorHandler.js';

test("GET /api/v1/health returns 200 with expected contract", async () => {
  const response = await request(app).get("/api/v1/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.environment, "test");
  assert.equal(typeof response.body.uptime, "number");
  assert.ok(Number.isFinite(response.body.uptime));
  assert.ok(!Number.isNaN(Date.parse(response.body.timestamp)));
});

test("GET unknown route returns 404 contract", async () => {
  const response = await request(app).get("/api/v1/unknown");

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    message: "Route not found"
  });
});

test("error handler returns 500 with details outside production", async () => {
  const errorApp = express();
  const consoleErrorCalls: unknown[][] = [];
  const originalConsoleError = console.error;

  errorApp.get("/boom", () => {
    throw new Error("boom");
  });
  errorApp.use(errorHandler);

  console.error = (...args: unknown[]): void => {
    consoleErrorCalls.push(args);
  };

  try {
    const response = await request(errorApp).get("/boom");

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      message: "Internal server error",
      details: "boom"
    });
    assert.equal(consoleErrorCalls.length, 1);
    assert.equal(consoleErrorCalls[0][0], "[error]");
  } finally {
    console.error = originalConsoleError;
  }
});

test('error handler omits details in production', async () => {
  const originalNodeEnv = env.NODE_ENV;
  const errorApp = express();
  const consoleErrorCalls: unknown[][] = [];
  const originalConsoleError = console.error;

  errorApp.get('/boom', () => {
    throw new Error('boom');
  });
  errorApp.use(errorHandler);

  env.NODE_ENV = 'production';
  console.error = (...args: unknown[]): void => {
    consoleErrorCalls.push(args);
  };

  try {
    const response = await request(errorApp).get('/boom');

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      message: 'Internal server error',
    });
    assert.equal(consoleErrorCalls.length, 1);
    assert.equal(consoleErrorCalls[0][0], '[error]');
  } finally {
    env.NODE_ENV = originalNodeEnv;
    console.error = originalConsoleError;
  }
});
