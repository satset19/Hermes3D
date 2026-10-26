"use strict";
/**
 * One Hermes3D team turn. History is written at the start (user message) and on
 * every exit (answer, or partial text plus the stop reason), so a page reload or a
 * timeout still shows the task in chat.history.
 */
const DANGLING_NOTE = "[Run stopped: the adapter restarted before this task finished]";

function createRunAgentTurn({ getAgent, getHistory, saveHistory, resolveModel, buildSystemMessages, streamOneTurn, mainKey = "main" }) {
  return async function runAgentTurn({ agentId, message, onDelta, signal }) {
    const agent = getAgent(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    const sessionKey = `agent:${agentId}:${mainKey}`;
    const history = getHistory(sessionKey);
    const keep = agent.settings?.continuity !== false;
    const messages = [
      ...buildSystemMessages(agentId, agent),
      ...(agent.settings?.wipe ? [] : history),
      { role: "user", content: message },
    ];
    if (keep) {
      history.push({ role: "user", content: message });
      saveHistory();
    }
    let partial = "";
    const track = (text) => {
      partial = text;
      if (onDelta) onDelta(text);
    };
    try {
      const { textContent } = await streamOneTurn(messages, resolveModel(sessionKey, agent), [], track, null, signal);
      if (signal && signal.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error("Run aborted");
      }
      if (keep) {
        history.push({ role: "assistant", content: textContent });
        saveHistory();
      }
      return textContent;
    } catch (err) {
      if (keep) {
        const reason = err && err.message ? err.message : String(err);
        const content = partial ? `${partial}\n\n[Run stopped: ${reason}]` : `[Run stopped: ${reason}]`;
        history.push({ role: "assistant", content });
        saveHistory();
      }
      throw err;
    }
  };
}

function closeDanglingTurns(conversationHistory) {
  let closed = 0;
  for (const [key, messages] of conversationHistory.entries()) {
    if (!key.startsWith("agent:") || !Array.isArray(messages) || messages.length === 0) continue;
    if (messages[messages.length - 1].role !== "user") continue;
    messages.push({ role: "assistant", content: DANGLING_NOTE });
    closed += 1;
  }
  return closed;
}

module.exports = { createRunAgentTurn, closeDanglingTurns, DANGLING_NOTE };
