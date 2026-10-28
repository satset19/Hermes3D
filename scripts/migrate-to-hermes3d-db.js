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

const COLLECTIONS_TO_MIGRATE = [
  "agents",
  "brain_configs",
  "chat_messages",
  "sessions",
];

const PROTECTED_COLLECTIONS = [
  "meals",
  "loans",
  "expenses",
  "paylater_schedules",
  "budgets",
  "profiles",
  "body_metrics",
];

async function ensureTargetIndexes(targetDb) {
  console.log("[Index] Ensuring indexes on target database hermes3d_db...");
  await Promise.all([
    targetDb.collection("chat_messages").createIndex({ sessionKey: 1, createdAt: -1 }),
    targetDb.collection("chat_messages").createIndex({ agentId: 1, createdAt: -1 }),
    targetDb.collection("chat_messages").createIndex({ runId: 1 }, { sparse: true }),
    targetDb.collection("agents").createIndex({ id: 1 }, { unique: true }),
    targetDb.collection("brain_configs").createIndex({ agentId: 1, fileName: 1 }, { unique: true }),
    targetDb.collection("sessions").createIndex({ sessionKey: 1 }, { unique: true }),
  ]);
  console.log("[Index] Target indexes successfully ensured.");
}

async function migrateCollections(sourceDb, targetDb) {
  const existingSourceColls = (await sourceDb.listCollections().toArray()).map((c) => c.name);

  // Validate protected collections are present
  for (const collName of PROTECTED_COLLECTIONS) {
    if (existingSourceColls.includes(collName)) {
      console.log(`[SafeGuard] Protected collection '${collName}' is present in source and will not be touched.`);
    }
  }

  // Ensure indexes on target DB
  await ensureTargetIndexes(targetDb);

  // Copy documents
  for (const collName of COLLECTIONS_TO_MIGRATE) {
    const sourceColl = sourceDb.collection(collName);
    const targetColl = targetDb.collection(collName);

    if (!existingSourceColls.includes(collName)) {
      console.log(`[Skip] Collection '${collName}' does not exist in source database.`);
      continue;
    }

    const sourceCount = await sourceColl.countDocuments();
    console.log(`[Copy] Migrating '${collName}' (${sourceCount} documents)...`);

    if (sourceCount > 0) {
      const docs = await sourceColl.find({}).toArray();
      for (const doc of docs) {
        await targetColl.replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
    }

    const targetCount = await targetColl.countDocuments();
    console.log(`[Verify] '${collName}' source count: ${sourceCount}, target count: ${targetCount}`);
    if (sourceCount !== targetCount) {
      throw new Error(`Count mismatch on '${collName}': source ${sourceCount} vs target ${targetCount}`);
    }
  }
}

async function verifyIntegrity(sourceDb, targetDb) {
  console.log("\n[Verify] Validating document ID and count parity between databases...");
  for (const collName of COLLECTIONS_TO_MIGRATE) {
    const sourceColl = sourceDb.collection(collName);
    const targetColl = targetDb.collection(collName);

    const sourceDocs = await sourceColl.find({}).sort({ _id: 1 }).toArray();
    const targetDocs = await targetColl.find({}).sort({ _id: 1 }).toArray();

    if (sourceDocs.length !== targetDocs.length) {
      throw new Error(`Integrity check failed: length mismatch for '${collName}' (${sourceDocs.length} vs ${targetDocs.length})`);
    }

    for (let i = 0; i < sourceDocs.length; i++) {
      const sId = String(sourceDocs[i]._id);
      const tId = String(targetDocs[i]._id);
      if (sId !== tId) {
        throw new Error(`Document ID mismatch in '${collName}' at index ${i}: ${sId} !== ${tId}`);
      }
    }
    console.log(`[Integrity] Collection '${collName}' verified: ${sourceDocs.length} documents match.`);
  }
}

async function cleanupSource(sourceDb, targetDb) {
  console.log("\n[Cleanup] Dropping migrated collections from source database (hermes_db)...");
  const existingSourceColls = (await sourceDb.listCollections().toArray()).map((c) => c.name);

  // Pre-drop sanity check: Target must have non-zero documents for expected collections
  const targetAgentsCount = await targetDb.collection("agents").countDocuments();
  const targetBrainCount = await targetDb.collection("brain_configs").countDocuments();
  if (targetAgentsCount !== 7 || targetBrainCount !== 49) {
    throw new Error(`Refusing to drop source: Target DB sanity check failed (agents: ${targetAgentsCount}, brain_configs: ${targetBrainCount})`);
  }

  for (const collName of COLLECTIONS_TO_MIGRATE) {
    if (PROTECTED_COLLECTIONS.includes(collName)) {
      throw new Error(`FATAL: Attempted to drop protected collection '${collName}'! Aborting.`);
    }

    if (existingSourceColls.includes(collName)) {
      await sourceDb.collection(collName).drop();
      console.log(`[Cleanup] Dropped '${collName}' from source database.`);
    } else {
      console.log(`[Cleanup] Collection '${collName}' was not in source database.`);
    }
  }

  const remainingColls = (await sourceDb.listCollections().toArray()).map((c) => c.name);
  console.log("[Cleanup] Remaining collections in hermes_db:", remainingColls.sort());
}

async function main() {
  const args = process.argv.slice(2);
  const isVerifyOnly = args.includes("--verify-only");
  const isCleanupSource = args.includes("--cleanup-source");

  const envFile = loadEnvFile(path.join(__dirname, "..", ".env.hermes"));
  const rawUri = process.env.MONGODB_URI || envFile.MONGODB_URI || "mongodb://admin:secretpassword123@127.0.0.1:27017/admin?authSource=admin";

  // Build clean base URI with authSource=admin
  const parsedUri = new URL(rawUri);
  parsedUri.pathname = "/";
  parsedUri.search = "?authSource=admin";
  const baseUri = parsedUri.toString();

  const sourceDbName = "hermes_db";
  const targetDbName = "hermes3d_db";

  console.log(`[DB] Connecting to MongoDB instance at ${parsedUri.host}...`);
  const client = new MongoClient(baseUri);
  await client.connect();

  try {
    const sourceDb = client.db(sourceDbName);
    const targetDb = client.db(targetDbName);

    if (isCleanupSource) {
      await verifyIntegrity(sourceDb, targetDb);
      await cleanupSource(sourceDb, targetDb);
      console.log("[Success] Cleanup completed successfully.");
      return;
    }

    if (isVerifyOnly) {
      await verifyIntegrity(sourceDb, targetDb);
      console.log("[Success] Verification completed successfully.");
      return;
    }

    // Default action: Migrate and verify
    await migrateCollections(sourceDb, targetDb);
    await verifyIntegrity(sourceDb, targetDb);
    console.log("\n[Success] Migration completed. Next steps:");
    console.log("1. Update .env.hermes and server/db/mongo.js to point to hermes3d_db.");
    console.log("2. Run server/db/test-mongo.js and restart hermes3d-adapter.service.");
    console.log("3. Run 'node scripts/migrate-to-hermes3d-db.js --cleanup-source' after service verification.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
