"use strict";

const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, "utf8");
    const env = {};
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        env[match[1]] = value;
      }
    }
    return env;
  } catch {
    return {};
  }
}

function resolveConfig() {
  const fileEnv = {
    ...loadEnvFile(path.join(__dirname, "..", "..", ".env.hermes")),
    ...loadEnvFile(path.join(process.cwd(), ".env.hermes")),
  };

  const uri =
    process.env.MONGODB_URI ||
    fileEnv.MONGODB_URI ||
    "mongodb://admin:secretpassword123@127.0.0.1:27017/hermes3d_db?authSource=admin";

  const dbName =
    process.env.MONGODB_DB_NAME ||
    fileEnv.MONGODB_DB_NAME ||
    "hermes3d_db";

  return { uri, dbName };
}

const clientOptions = {
  maxPoolSize: 20,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

let client = null;
let db = null;
let connectPromise = null;
let indexesEnsured = false;

async function ensureIndexes(database) {
  try {
    await Promise.all([
      database.collection("chat_messages").createIndex({ sessionKey: 1, createdAt: -1 }),
      database.collection("chat_messages").createIndex({ agentId: 1, createdAt: -1 }),
      database.collection("chat_messages").createIndex({ runId: 1 }, { sparse: true }),
      database.collection("agents").createIndex({ id: 1 }, { unique: true }),
      database.collection("brain_configs").createIndex({ agentId: 1, fileName: 1 }, { unique: true }),
      database.collection("sessions").createIndex({ sessionKey: 1 }, { unique: true }),
      database.collection("teams").createIndex({ id: 1 }, { unique: true }),
    ]);
  } catch (err) {
    console.error("[Mongo] Error creating indexes:", err.message);
  }
}

async function getDb() {
  if (db && client) {
    return db;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    try {
      const { uri, dbName } = resolveConfig();
      client = new MongoClient(uri, clientOptions);

      client.on("close", () => {
        db = null;
        connectPromise = null;
        indexesEnsured = false;
      });

      client.on("error", (err) => {
        console.error("[Mongo] Client error:", err.message);
      });

      await client.connect();
      const database = client.db(dbName);

      if (!indexesEnsured) {
        await ensureIndexes(database);
        indexesEnsured = true;
      }

      db = database;
      return db;
    } catch (err) {
      if (client) {
        try {
          await client.close();
        } catch {}
      }
      db = null;
      client = null;
      connectPromise = null;
      indexesEnsured = false;
      console.error("[Mongo] Connection error, falling back to local memory/disk:", err.message);
      return null;
    }
  })();

  return connectPromise;
}

function getClient() {
  return client;
}

async function closeDb() {
  if (client) {
    const c = client;
    client = null;
    db = null;
    connectPromise = null;
    indexesEnsured = false;
    await c.close();
  }
}

async function saveChatMessage({ sessionKey, agentId, role, content, runId, metadata = {} }) {
  const database = await getDb();
  if (!database) return null;
  const now = new Date();
  const doc = {
    sessionKey: sessionKey || "agent:hermes:main",
    agentId: agentId || "hermes",
    role: role || "user",
    content: content !== undefined ? content : "",
    runId: runId || null,
    createdAt: now.getTime(),
    timestamp: now,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };
  const res = await database.collection("chat_messages").insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

async function getLatestMessages(sessionKey, limit = 10) {
  const database = await getDb();
  if (!database) return null;
  const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
  const docs = await database
    .collection("chat_messages")
    .find({ sessionKey })
    .sort({ createdAt: -1 })
    .limit(parsedLimit)
    .toArray();
  return docs.reverse();
}

async function deleteChatMessages(sessionKey) {
  const database = await getDb();
  if (!database) return 0;
  const res = await database.collection("chat_messages").deleteMany({ sessionKey });
  return res.deletedCount;
}

async function upsertAgentRecord(agentData) {
  const database = await getDb();
  if (!database || !agentData) return null;
  const id = agentData.id || agentData.agentId;
  if (!id) return null;
  const now = new Date();
  const { _id, createdAt, ...rest } = agentData;
  const record = {
    ...rest,
    id: String(id),
    updatedAt: now,
  };
  const res = await database.collection("agents").updateOne(
    { id: String(id) },
    {
      $set: record,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  return res;
}

async function getAgentsFromDb() {
  const database = await getDb();
  if (!database) return null;
  return await database.collection("agents").find({}).toArray();
}

async function upsertBrainFile(agentId, fileName, content, filePath) {
  const database = await getDb();
  if (!database || !agentId || !fileName) return null;
  const now = new Date();
  const res = await database.collection("brain_configs").updateOne(
    { agentId: String(agentId), fileName: String(fileName) },
    {
      $set: {
        agentId: String(agentId),
        fileName: String(fileName),
        content: content !== undefined ? String(content) : "",
        filePath: filePath || null,
        path: filePath || null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  return res;
}

async function getBrainFileFromDb(agentId, fileName) {
  const database = await getDb();
  if (!database || !agentId || !fileName) return null;
  return await database.collection("brain_configs").findOne({
    agentId: String(agentId),
    fileName: String(fileName),
  });
}

async function getAllBrainFilesForAgent(agentId) {
  const database = await getDb();
  if (!database || !agentId) return null;
  return await database.collection("brain_configs").find({ agentId: String(agentId) }).toArray();
}

async function deleteAgentRecord(agentId) {
  const database = await getDb();
  if (!database || !agentId) return 0;
  const res = await database.collection("agents").deleteOne({ id: String(agentId) });
  await database.collection("brain_configs").deleteMany({ agentId: String(agentId) });
  return res.deletedCount;
}

async function upsertSessionRecord(sessionKey, sessionData) {
  const database = await getDb();
  if (!database || !sessionKey) return null;
  const now = new Date();
  const { _id, createdAt, ...rest } = sessionData || {};
  const doc = {
    ...rest,
    sessionKey: String(sessionKey),
    updatedAt: now,
  };
  const res = await database.collection("sessions").updateOne(
    { sessionKey: String(sessionKey) },
    {
      $set: doc,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  return res;
}

async function getSessionRecord(sessionKey) {
  const database = await getDb();
  if (!database || !sessionKey) return null;
  return await database.collection("sessions").findOne({ sessionKey: String(sessionKey) });
}

async function getSessionsFromDb() {
  const database = await getDb();
  if (!database) return [];
  return await database.collection("sessions").find({}).toArray();
}

async function deleteSessionRecord(sessionKey) {
  const database = await getDb();
  if (!database || !sessionKey) return 0;
  const res = await database.collection("sessions").deleteOne({ sessionKey: String(sessionKey) });
  return res.deletedCount;
}

async function upsertTeam(teamData) {
  const database = await getDb();
  if (!database || !teamData || !teamData.id) return null;
  const now = new Date();
  const { _id, createdAt, ...rest } = teamData;
  const record = { ...rest, id: String(teamData.id), updatedAt: now };
  return database.collection("teams").updateOne(
    { id: String(teamData.id) },
    { $set: record, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}

async function getTeamsFromDb() {
  const database = await getDb();
  if (!database) return null;
  return database.collection("teams").find({}).toArray();
}

async function deleteTeam(teamId) {
  const database = await getDb();
  if (!database) return 0;
  const res = await database.collection("teams").deleteOne({ id: String(teamId) });
  return res.deletedCount;
}

module.exports = {
  getDb,
  getClient,
  closeDb,
  saveChatMessage,
  getLatestMessages,
  deleteChatMessages,
  upsertAgentRecord,
  getAgentsFromDb,
  deleteAgentRecord,
  upsertBrainFile,
  getBrainFileFromDb,
  getAllBrainFilesForAgent,
  upsertSessionRecord,
  getSessionRecord,
  getSessionsFromDb,
  deleteSessionRecord,
  upsertTeam,
  getTeamsFromDb,
  deleteTeam,
};
