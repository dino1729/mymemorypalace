#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");

const createPaths = (cwd) => {
  const runtimeDir = path.join(cwd, ".runtime");
  return {
    runtimeDir,
    pidFile: path.join(runtimeDir, "memorypalace-server.pid"),
    logFile: path.join(runtimeDir, "memorypalace-server.log"),
    dataFile: path.join(cwd, "data", "memory-palace-ingested.json"),
    memoryRoot: path.join(cwd, "memory_palace"),
  };
};

const resolveNpmCommand = (platform = process.platform) => ({
  command: platform === "win32" ? "npm.cmd" : "npm",
  args: [],
});

const loadLocalEnv = (cwd = process.cwd(), fileSystem = fs) => {
  const envPath = path.join(cwd, ".env.local");
  if (!fileSystem.existsSync(envPath)) {
    return {};
  }

  return fileSystem
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .reduce((accumulator, line) => {
      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      accumulator[key] = value;
      return accumulator;
    }, {});
};

const removeFileIfPresent = (filePath, fileSystem = fs) => {
  if (fileSystem.existsSync(filePath)) {
    fileSystem.rmSync(filePath, { force: true });
  }
};

const readPid = (pidFile, fileSystem = fs) => {
  if (!fileSystem.existsSync(pidFile)) {
    return null;
  }

  const raw = fileSystem.readFileSync(pidFile, "utf8").trim();
  if (!raw) {
    return null;
  }

  const pid = Number.parseInt(raw, 10);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
};

const isProcessRunning = (pid, kill = process.kill) => {
  try {
    kill(pid, 0);
    return true;
  } catch (error) {
    if (error && error.code === "EPERM") {
      return true;
    }
    if (error && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
};

const getServerState = ({ cwd = process.cwd(), fileSystem = fs, kill = process.kill } = {}) => {
  const paths = createPaths(cwd);
  const pid = readPid(paths.pidFile, fileSystem);

  if (!pid) {
    removeFileIfPresent(paths.pidFile, fileSystem);
    return { running: false, pid: null, ...paths };
  }

  if (!isProcessRunning(pid, kill)) {
    removeFileIfPresent(paths.pidFile, fileSystem);
    return { running: false, pid: null, ...paths };
  }

  return { running: true, pid, ...paths };
};

const ensureDatasetReady = ({
  cwd = process.cwd(),
  fileSystem = fs,
  execFileSyncImpl = execFileSync,
  execFileSync: execFileSyncOverride,
  platform = process.platform,
} = {}) => {
  const paths = createPaths(cwd);
  const execImpl = execFileSyncOverride || execFileSyncImpl;

  if (fileSystem.existsSync(paths.dataFile)) {
    return { ready: true, ingested: false, ...paths };
  }

  if (!fileSystem.existsSync(paths.memoryRoot)) {
    return { ready: false, ingested: false, ...paths };
  }

  const npmCommand = resolveNpmCommand(platform);
  execImpl(npmCommand.command, [...npmCommand.args, "run", "ingest-memory-palace"], {
    cwd,
    stdio: "inherit",
  });

  return {
    ready: fileSystem.existsSync(paths.dataFile) || true,
    ingested: true,
    ...paths,
  };
};

const startServer = ({
  cwd = process.cwd(),
  fileSystem = fs,
  spawnImpl = spawn,
  spawn: spawnOverride,
  kill = process.kill,
  execFileSyncImpl = execFileSync,
  execFileSync: execFileSyncOverride,
  platform = process.platform,
  env = process.env,
} = {}) => {
  const existing = getServerState({ cwd, fileSystem, kill });
  if (existing.running) {
    return { action: "already-running", ...existing };
  }

  const datasetState = ensureDatasetReady({
    cwd,
    fileSystem,
    execFileSyncImpl,
    execFileSync: execFileSyncOverride,
    platform,
  });

  if (!datasetState.ready) {
    throw new Error(
      "No local memory dataset found. Add memory files under `memory_palace/` or generate `data/memory-palace-ingested.json` first.",
    );
  }

  const paths = createPaths(cwd);
  fileSystem.mkdirSync(paths.runtimeDir, { recursive: true });
  const localEnv = loadLocalEnv(cwd, fileSystem);

  const logFd = fileSystem.openSync(paths.logFile, "a");
  const npmCommand = resolveNpmCommand(platform);
  const spawnFn = spawnOverride || spawnImpl;

  const child = spawnFn(npmCommand.command, [...npmCommand.args, "run", "dev"], {
    cwd,
    env: { ...env, ...localEnv },
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });

  if (typeof child.unref === "function") {
    child.unref();
  }

  fileSystem.closeSync(logFd);
  fileSystem.writeFileSync(paths.pidFile, `${child.pid}\n`, "utf8");

  return {
    action: "started",
    pid: child.pid,
    ingested: datasetState.ingested,
    ...paths,
  };
};

const stopServer = ({
  cwd = process.cwd(),
  fileSystem = fs,
  kill = process.kill,
} = {}) => {
  const paths = createPaths(cwd);
  const pid = readPid(paths.pidFile, fileSystem);

  if (!pid) {
    removeFileIfPresent(paths.pidFile, fileSystem);
    return { action: "not-running", pid: null, ...paths };
  }

  try {
    kill(pid, "SIGTERM");
  } catch (error) {
    if (!error || error.code !== "ESRCH") {
      throw error;
    }
  }

  removeFileIfPresent(paths.pidFile, fileSystem);
  return { action: "stopped", pid, ...paths };
};

const printStatus = (state) => {
  if (state.running) {
    console.log(`Memory Palace server is running on PID ${state.pid}.`);
  } else {
    console.log("Memory Palace server is stopped.");
  }
  console.log(`PID file: ${state.pidFile}`);
  console.log(`Log file: ${state.logFile}`);
};

const main = () => {
  const command = process.argv[2];

  switch (command) {
    case "start": {
      const result = startServer();
      if (result.action === "already-running") {
        console.log(`Memory Palace server is already running on PID ${result.pid}.`);
      } else {
        console.log(`Started Memory Palace server on PID ${result.pid}.`);
      }
      console.log(`Log file: ${result.logFile}`);
      break;
    }
    case "stop": {
      const result = stopServer();
      if (result.action === "not-running") {
        console.log("Memory Palace server is not running.");
      } else {
        console.log(`Stopped Memory Palace server on PID ${result.pid}.`);
      }
      break;
    }
    case "status": {
      printStatus(getServerState());
      break;
    }
    default: {
      console.error("Usage: node scripts/server-control.js <start|stop|status>");
      process.exitCode = 1;
    }
  }
};

module.exports = {
  createPaths,
  loadLocalEnv,
  resolveNpmCommand,
  ensureDatasetReady,
  getServerState,
  startServer,
  stopServer,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
