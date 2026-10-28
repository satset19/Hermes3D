#!/usr/bin/env node
/**
 * ws-probe.js — Probe WebSocket connectivity to Hermes3D or Hermes Adapter
 * Usage:
 *   node ws-probe.js <url> [cookie_string]
 */

const targetUrl = process.argv[2];
const cookie = process.argv[3];

if (!targetUrl) {
  console.error("Usage: node ws-probe.js <ws_url> [cookie]");
  process.exit(1);
}

let WebSocketClient;
try {
  WebSocketClient = require("ws");
} catch {
  try {
    WebSocketClient = require("/home/harnet/hermes3d/node_modules/ws");
  } catch {
    if (typeof WebSocket !== "undefined") {
      WebSocketClient = WebSocket;
    } else {
      console.error("No WebSocket implementation found");
      process.exit(1);
    }
  }
}

const timeoutMs = 12000;
let done = false;

const options = {
  rejectUnauthorized: false,
};

if (cookie) {
  options.headers = {
    Cookie: cookie,
  };
}

let ws;
try {
  ws = new WebSocketClient(targetUrl, options);
} catch (e) {
  console.error("FAIL to create WebSocket:", e.message);
  process.exit(1);
}

const timer = setTimeout(() => {
  if (!done) {
    done = true;
    console.error("FAIL: timeout waiting for WebSocket response");
    try {
      if (ws.terminate) ws.terminate();
      else ws.close();
    } catch {}
    process.exit(1);
  }
}, timeoutMs);

const succeed = () => {
  if (!done) {
    done = true;
    clearTimeout(timer);
    console.log("OK");
    try {
      if (ws.terminate) ws.terminate();
      else ws.close();
    } catch {}
    process.exit(0);
  }
};

ws.on("open", () => {
  try {
    ws.send(JSON.stringify({ type: "req", id: "probe-1", method: "connect", params: {} }));
  } catch {}
  // Also set a short fallback timer in case message doesn't arrive but connection opened
  setTimeout(() => {
    succeed();
  }, 1000);
});

ws.on("message", (data) => {
  succeed();
});

ws.on("error", (err) => {
  if (!done) {
    done = true;
    clearTimeout(timer);
    console.error("FAIL:", err.message || err);
    process.exit(1);
  }
});

ws.on("close", (code, reason) => {
  if (!done) {
    done = true;
    clearTimeout(timer);
    if (code === 1000) {
      console.log("OK");
      process.exit(0);
    } else {
      console.error(`FAIL: closed with code ${code}`);
      process.exit(1);
    }
  }
});
