const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  loadLocalEnv,
  resolveNpmCommand,
  ensureDatasetReady,
  getServerState,
  startServer,
  stopServer,
} = require("../scripts/server-control");

const makeWorkspace = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "memorypalace-server-control-"));

test("resolveNpmCommand picks the platform-specific npm executable", () => {
  assert.deepEqual(resolveNpmCommand("darwin"), { command: "npm", args: [] });
  assert.deepEqual(resolveNpmCommand("win32"), { command: "npm.cmd", args: [] });
});

test("loadLocalEnv parses .env.local and returns key-value pairs", () => {
  const cwd = makeWorkspace();
  fs.writeFileSync(
    path.join(cwd, ".env.local"),
    "LITELLM_BASE_URL=http://litellm.example.test\nLITELLM_MODEL=gemini-3-flash-preview\n",
  );

  assert.deepEqual(loadLocalEnv(cwd), {
    LITELLM_BASE_URL: "http://litellm.example.test",
    LITELLM_MODEL: "gemini-3-flash-preview",
  });
});

test("ensureDatasetReady skips ingestion when the local dataset already exists", () => {
  const cwd = makeWorkspace();
  fs.mkdirSync(path.join(cwd, "data"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "data", "memory-palace-ingested.json"), "{}");

  let called = false;
  const result = ensureDatasetReady({
    cwd,
    execFileSync: () => {
      called = true;
    },
  });

  assert.equal(called, false);
  assert.equal(result.ingested, false);
  assert.equal(result.ready, true);
});

test("ensureDatasetReady runs ingestion when memory sources exist but the dataset is missing", () => {
  const cwd = makeWorkspace();
  fs.mkdirSync(path.join(cwd, "memory_palace"), { recursive: true });

  const calls = [];
  const result = ensureDatasetReady({
    cwd,
    execFileSync: (command, args, options) => {
      calls.push({ command, args, options });
    },
  });

  assert.equal(result.ingested, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "npm");
  assert.deepEqual(calls[0].args, ["run", "ingest-memory-palace"]);
  assert.equal(calls[0].options.cwd, cwd);
});

test("getServerState clears a stale pid file when the tracked process is gone", () => {
  const cwd = makeWorkspace();
  const runtimeDir = path.join(cwd, ".runtime");
  const pidFile = path.join(runtimeDir, "memorypalace-server.pid");

  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(pidFile, "999999\n");

  const state = getServerState({
    cwd,
    kill: () => {
      const error = new Error("process not found");
      error.code = "ESRCH";
      throw error;
    },
  });

  assert.equal(state.running, false);
  assert.equal(fs.existsSync(pidFile), false);
});

test("startServer launches the dev server in the background and records the pid", () => {
  const cwd = makeWorkspace();
  fs.mkdirSync(path.join(cwd, "data"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "data", "memory-palace-ingested.json"), "{}");
  fs.writeFileSync(path.join(cwd, ".env.local"), "LITELLM_MODEL=gemini-3-flash-preview\n");

  const spawnCalls = [];
  let unrefCalled = false;

  const result = startServer({
    cwd,
    spawn: (command, args, options) => {
      spawnCalls.push({ command, args, options });
      return {
        pid: 4321,
        unref() {
          unrefCalled = true;
        },
      };
    },
  });

  const pidFile = path.join(cwd, ".runtime", "memorypalace-server.pid");

  assert.equal(result.action, "started");
  assert.equal(result.pid, 4321);
  assert.equal(unrefCalled, true);
  assert.equal(fs.readFileSync(pidFile, "utf8").trim(), "4321");
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].command, "npm");
  assert.deepEqual(spawnCalls[0].args, ["run", "dev"]);
  assert.equal(spawnCalls[0].options.cwd, cwd);
  assert.equal(spawnCalls[0].options.detached, true);
  assert.equal(spawnCalls[0].options.env.LITELLM_MODEL, "gemini-3-flash-preview");
});

test("stopServer sends SIGTERM to the tracked process and removes the pid file", () => {
  const cwd = makeWorkspace();
  const runtimeDir = path.join(cwd, ".runtime");
  const pidFile = path.join(runtimeDir, "memorypalace-server.pid");

  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(pidFile, "5432\n");

  const signals = [];
  const result = stopServer({
    cwd,
    kill: (pid, signal) => {
      signals.push({ pid, signal });
    },
  });

  assert.equal(result.action, "stopped");
  assert.deepEqual(signals, [{ pid: 5432, signal: "SIGTERM" }]);
  assert.equal(fs.existsSync(pidFile), false);
});
