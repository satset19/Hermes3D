"use strict";

const assert = require("assert");
const mongo = require("./mongo");

async function runTests() {
  console.log("[TEST] Starting MongoDB integration and CRUD tests...");
  let passedCount = 0;
  let totalTests = 0;

  function pass(name) {
    passedCount++;
    console.log(`[PASS] ${name}`);
  }

  function fail(name, err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }

  const testSessionKey = `test:session:${Date.now()}`;
  const testAgentId = `test-agent-${Date.now()}`;

  try {
    // 1. Connection & Ping
    totalTests++;
    try {
      const db = await mongo.getDb();
      assert(db, "Database handle must not be null");
      const pingRes = await db.command({ ping: 1 });
      assert.strictEqual(pingRes.ok, 1, "Ping response ok must be 1");
      pass("Database connection and ping");
    } catch (err) {
      fail("Database connection and ping", err);
    }

    // 2. Save Chat Messages
    totalTests++;
    try {
      const msg1 = await mongo.saveChatMessage({
        sessionKey: testSessionKey,
        agentId: testAgentId,
        role: "user",
        content: "Test prompt from user",
        runId: "run-test-001",
        metadata: { client: "unit-test" }
      });
      assert(msg1 && msg1._id, "Message 1 must have an _id");
      assert.strictEqual(msg1.content, "Test prompt from user");

      const msg2 = await mongo.saveChatMessage({
        sessionKey: testSessionKey,
        agentId: testAgentId,
        role: "assistant",
        content: "Test response from agent",
        runId: "run-test-001",
        metadata: { confidence: 0.99 }
      });
      assert(msg2 && msg2._id, "Message 2 must have an _id");
      assert.strictEqual(msg2.content, "Test response from agent");

      pass("saveChatMessage for user and assistant");
    } catch (err) {
      fail("saveChatMessage for user and assistant", err);
    }

    // 3. Get Latest Chat Messages
    totalTests++;
    try {
      const msgs = await mongo.getLatestMessages(testSessionKey, 10);
      assert(Array.isArray(msgs), "Messages must be an array");
      assert.strictEqual(msgs.length, 2, "Must return exactly 2 messages");
      assert.strictEqual(msgs[0].role, "user", "Oldest of the latest must be user");
      assert.strictEqual(msgs[1].role, "assistant", "Newest must be assistant");

      // Test limit = 1
      const limited = await mongo.getLatestMessages(testSessionKey, 1);
      assert.strictEqual(limited.length, 1, "Limited query must return 1 message");
      assert.strictEqual(limited[0].role, "assistant", "Single latest message must be assistant");

      pass("getLatestMessages with limit and ordering");
    } catch (err) {
      fail("getLatestMessages with limit and ordering", err);
    }

    // 4. Delete Chat Messages
    totalTests++;
    try {
      const deletedCount = await mongo.deleteChatMessages(testSessionKey);
      assert(deletedCount >= 2, "Deleted count should be at least 2");

      const msgsAfter = await mongo.getLatestMessages(testSessionKey, 10);
      assert.strictEqual(msgsAfter.length, 0, "Messages count after delete must be 0");

      pass("deleteChatMessages deletes session messages");
    } catch (err) {
      fail("deleteChatMessages deletes session messages", err);
    }

    // 5. Agent Record Upsert
    totalTests++;
    try {
      const insertRes = await mongo.upsertAgentRecord({
        id: testAgentId,
        name: "Test Specialist",
        role: "Researcher",
        workspace: `/home/harnet/.hermes/workspace-${testAgentId}`,
      });
      assert(insertRes, "Upsert result must be returned");

      // Update same agent
      await mongo.upsertAgentRecord({
        id: testAgentId,
        name: "Test Specialist Senior",
        role: "Lead Researcher",
      });

      const agents = await mongo.getAgentsFromDb();
      assert(Array.isArray(agents), "Agents must be an array");
      const found = agents.find((a) => a.id === testAgentId);
      assert(found, "Updated agent must exist in DB");
      assert.strictEqual(found.name, "Test Specialist Senior");
      assert.strictEqual(found.role, "Lead Researcher");

      pass("upsertAgentRecord and getAgentsFromDb");
    } catch (err) {
      fail("upsertAgentRecord and getAgentsFromDb", err);
    }

    // 6. Brain Files Upsert and Get
    totalTests++;
    try {
      const filePath1 = `/home/harnet/.hermes/workspace-${testAgentId}/IDENTITY.md`;
      const content1 = "# Identity\nYou are an autonomous researcher.";
      await mongo.upsertBrainFile(testAgentId, "IDENTITY.md", content1, filePath1);

      const filePath2 = `/home/harnet/.hermes/workspace-${testAgentId}/SOUL.md`;
      const content2 = "# Soul\nTone: direct, analytical.";
      await mongo.upsertBrainFile(testAgentId, "SOUL.md", content2, filePath2);

      const file1 = await mongo.getBrainFileFromDb(testAgentId, "IDENTITY.md");
      assert(file1, "IDENTITY.md must exist in DB");
      assert.strictEqual(file1.content, content1);
      assert.strictEqual(file1.filePath, filePath1);

      const allFiles = await mongo.getAllBrainFilesForAgent(testAgentId);
      assert(Array.isArray(allFiles), "getAllBrainFilesForAgent must return an array");
      assert.strictEqual(allFiles.length, 2, "Must return 2 brain files for agent");

      pass("upsertBrainFile, getBrainFileFromDb, and getAllBrainFilesForAgent");
    } catch (err) {
      fail("upsertBrainFile, getBrainFileFromDb, and getAllBrainFilesForAgent", err);
    }

    // 7. Session CRUD
    totalTests++;
    try {
      await mongo.upsertSessionRecord(testSessionKey, {
        model: "hermes-test-model",
        thinkingLevel: "medium",
        execSecurity: "full",
      });

      const session = await mongo.getSessionRecord(testSessionKey);
      assert(session, "Session record must exist in DB");
      assert.strictEqual(session.model, "hermes-test-model");
      assert.strictEqual(session.thinkingLevel, "medium");

      const allSessions = await mongo.getSessionsFromDb();
      assert(Array.isArray(allSessions), "getSessionsFromDb must return an array");
      assert(allSessions.some(s => s.sessionKey === testSessionKey), "test session must be in allSessions");

      const delSessionCount = await mongo.deleteSessionRecord(testSessionKey);
      assert.strictEqual(delSessionCount, 1, "Deleted session count must be 1");

      const sessionAfter = await mongo.getSessionRecord(testSessionKey);
      assert.strictEqual(sessionAfter, null, "Session must be null after deletion");

      pass("upsertSessionRecord, getSessionRecord, getSessionsFromDb, and deleteSessionRecord");
    } catch (err) {
      fail("upsertSessionRecord, getSessionRecord, getSessionsFromDb, and deleteSessionRecord", err);
    }

    // 8. Agent Delete
    totalTests++;
    try {
      const delAgentCount = await mongo.deleteAgentRecord(testAgentId);
      assert.strictEqual(delAgentCount, 1, "Deleted agent count must be 1");

      const agentsAfter = await mongo.getAgentsFromDb();
      assert(!agentsAfter.some(a => a.id === testAgentId), "Agent must not exist in DB after delete");

      const brainFilesAfter = await mongo.getAllBrainFilesForAgent(testAgentId);
      assert.strictEqual(brainFilesAfter.length, 0, "Brain files must be deleted along with agent");

      pass("deleteAgentRecord deletes agent and associated brain files");
    } catch (err) {
      fail("deleteAgentRecord deletes agent and associated brain files", err);
    }

    // 9. Cleanup test data
    totalTests++;
    try {
      const db = await mongo.getDb();
      await db.collection("agents").deleteOne({ id: testAgentId });
      await db.collection("brain_configs").deleteMany({ agentId: testAgentId });
      await db.collection("chat_messages").deleteMany({ sessionKey: testSessionKey });
      await db.collection("sessions").deleteOne({ sessionKey: testSessionKey });
      pass("Cleanup test records");
    } catch (err) {
      fail("Cleanup test records", err);
    }

    console.log(`\n[SUMMARY] All ${passedCount}/${totalTests} tests passed successfully.`);
  } finally {
    await mongo.closeDb();
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("[FATAL] Test suite failed:", err);
    process.exit(1);
  });
