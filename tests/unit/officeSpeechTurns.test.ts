// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  drainExpiredSpeechTurns,
  enqueueSpeechTurns,
  filterUnreadArrivals,
  getSpeechTextKey,
  getTurnTimestamp,
  isSpeechBubbleVisible,
  loadReadSpeechKeys,
  markInitialSnapshotAsRead,
  persistReadSpeechKey,
  persistReadSpeechKeys,
  READ_SPEECH_KEYS_STORAGE_KEY,
  SPEECH_MESSAGE_MAX_AGE_MS,
  SPEECH_QUEUE_MAX,
  SPEECH_TURN_MAX_MS,
  SPEECH_TURN_MIN_MS,
  speechTurnDurationMs,
  type SpeechTurn,
} from "../../src/features/retro-office/core/speechTurns";

const turn = (agentId: string, key: string): SpeechTurn => ({
  agentId,
  key,
  durationMs: SPEECH_TURN_MIN_MS,
});

describe("speechTurnDurationMs", () => {
  it("stays long enough to read and short enough to pass the floor on", () => {
    for (const length of [0, 1, 40, 180, 2_000]) {
      const duration = speechTurnDurationMs(length);
      expect(duration).toBeGreaterThanOrEqual(SPEECH_TURN_MIN_MS);
      expect(duration).toBeLessThanOrEqual(SPEECH_TURN_MAX_MS);
    }
  });

  it("gives a longer reply more time than a shorter one", () => {
    expect(speechTurnDurationMs(150)).toBeGreaterThan(speechTurnDurationMs(20));
  });
});

describe("enqueueSpeechTurns", () => {
  it("queues a burst in arrival order rather than showing it at once", () => {
    const queue = enqueueSpeechTurns(
      [],
      [turn("a", "a:1"), turn("b", "b:1"), turn("c", "c:1")],
    );
    expect(queue.map((entry) => entry.agentId)).toEqual(["a", "b", "c"]);
  });

  it("ignores a reply it has already queued", () => {
    const first = enqueueSpeechTurns([], [turn("a", "a:1")]);
    const second = enqueueSpeechTurns(first, [turn("a", "a:1")]);
    expect(second).toHaveLength(1);
  });

  it("replaces an agent's waiting reply instead of making it speak twice", () => {
    const queue = enqueueSpeechTurns(
      [turn("a", "a:1"), turn("b", "b:1")],
      [turn("a", "a:2")],
    );
    expect(queue.map((entry) => entry.key)).toEqual(["b:1", "a:2"]);
  });

  it("drops the oldest waiting replies once the line is full", () => {
    const incoming = Array.from({ length: SPEECH_QUEUE_MAX + 3 }, (_, index) =>
      turn(`agent-${index}`, `agent-${index}:1`),
    );
    const queue = enqueueSpeechTurns([], incoming);
    expect(queue).toHaveLength(SPEECH_QUEUE_MAX);
    // The survivors are the freshest: a reply that waited out the whole burst
    // is no longer news by the time its turn would arrive.
    expect(queue.map((entry) => entry.agentId)).toEqual(
      incoming.slice(-SPEECH_QUEUE_MAX).map((entry) => entry.agentId),
    );
  });
});

describe("persistent read speech keys", () => {
  it("loads empty set when window/storage is unavailable", () => {
    const keys = loadReadSpeechKeys();
    expect(keys).toBeInstanceOf(Set);
  });

  it("persists keys and retrieves them from localStorage", () => {
    const storage: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
    };
    const originalWindow = globalThis.window;
    globalThis.window = {
      localStorage: mockStorage as unknown as Storage,
    } as unknown as Window & typeof globalThis;

    try {
      const keys = persistReadSpeechKey("agent-1:100", new Set());
      expect(keys.has("agent-1:100")).toBe(true);
      expect(storage[READ_SPEECH_KEYS_STORAGE_KEY]).toBe(
        JSON.stringify(["agent-1:100"]),
      );

      const loaded = loadReadSpeechKeys();
      expect(loaded.has("agent-1:100")).toBe(true);
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it("persists multiple keys and retrieves them from localStorage", () => {
    const storage: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
    };
    const originalWindow = globalThis.window;
    globalThis.window = {
      localStorage: mockStorage as unknown as Storage,
    } as unknown as Window & typeof globalThis;

    try {
      // Calling without existingKeys loads from storage first
      persistReadSpeechKey("agent-1:100");
      persistReadSpeechKey(["agent-2:200", "agent-3:300"]);
      const loaded = loadReadSpeechKeys();
      expect(loaded.has("agent-1:100")).toBe(true);
      expect(loaded.has("agent-2:200")).toBe(true);
      expect(loaded.has("agent-3:300")).toBe(true);
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it("caps persisted keys at MAX_READ_SPEECH_KEYS", () => {
    const storage: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
    };
    const originalWindow = globalThis.window;
    globalThis.window = {
      localStorage: mockStorage as unknown as Storage,
    } as unknown as Window & typeof globalThis;

    try {
      let keys = new Set<string>();
      for (let i = 0; i < 220; i++) {
        keys = persistReadSpeechKey(`agent:${i}`, keys);
      }
      const loaded = loadReadSpeechKeys();
      expect(loaded.size).toBe(200);
      expect(loaded.has("agent:0")).toBe(false);
      expect(loaded.has("agent:219")).toBe(true);
    } finally {
      globalThis.window = originalWindow;
    }
  });
});

describe("filterUnreadArrivals", () => {
  it("ignores replies from activeChatAgentId and marks them read", () => {
    const now = Date.now();
    const events = [
      { id: "agent-1", ts: now - 2000, text: "Hello from 1", kind: "reply" as const },
      { id: "agent-2", ts: now - 1000, text: "Hello from 2", kind: "reply" as const },
    ];
    const seen = new Set<string>();
    const read = new Set<string>();
    const { arrivals, keysToMarkRead } = filterUnreadArrivals({
      events,
      seenKeys: seen,
      readKeys: read,
      activeChatAgentId: "agent-1",
      now,
    });

    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]?.agentId).toBe("agent-2");
    expect(arrivals[0]?.text).toBe("Hello from 2");
    expect(keysToMarkRead).toContain(`agent-1:${now - 2000}`);
    expect(seen.has(`agent-1:${now - 2000}`)).toBe(true);
    expect(seen.has(`agent-2:${now - 1000}`)).toBe(true);
  });

  it("skips replies that are already in readKeys", () => {
    const now = Date.now();
    const events = [
      { id: "agent-1", ts: now - 1000, text: "Already read", kind: "reply" as const },
    ];
    const seen = new Set<string>();
    const read = new Set<string>([`agent-1:${now - 1000}`]);
    const { arrivals, keysToMarkRead } = filterUnreadArrivals({
      events,
      seenKeys: seen,
      readKeys: read,
      activeChatAgentId: null,
      now,
    });

    expect(arrivals).toHaveLength(0);
    expect(keysToMarkRead).toHaveLength(0);
  });

  it("enqueues unread replies in chronological order (oldest first)", () => {
    const now = Date.now();
    const events = [
      { id: "agent-2", ts: now - 1000, text: "Newer reply", kind: "reply" as const },
      { id: "agent-1", ts: now - 2000, text: "Older reply", kind: "reply" as const },
    ];
    const seen = new Set<string>();
    const read = new Set<string>();
    const { arrivals } = filterUnreadArrivals({
      events,
      seenKeys: seen,
      readKeys: read,
      activeChatAgentId: null,
      now,
    });

    expect(arrivals).toHaveLength(2);
    expect(arrivals[0]?.agentId).toBe("agent-1");
    expect(arrivals[0]?.text).toBe("Older reply");
    expect(arrivals[1]?.agentId).toBe("agent-2");
    expect(arrivals[1]?.text).toBe("Newer reply");
  });

  it("skips replies whose textKey is already in readKeys even if timestamp differs (reload scenario)", () => {
    const text = "A message that was read in previous session";
    const textKey = getSpeechTextKey("agent-1", text);
    const read = new Set<string>([textKey]);
    const seen = new Set<string>();

    const events = [
      { id: "agent-1", ts: Date.now(), text, kind: "reply" as const },
    ];
    const { arrivals } = filterUnreadArrivals({
      events,
      seenKeys: seen,
      readKeys: read,
      activeChatAgentId: null,
    });

    expect(arrivals).toHaveLength(0);
  });

  it("pre-existing messages on page reload do not produce new arrivals", () => {
    const storage: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
    };
    const originalWindow = globalThis.window;
    globalThis.window = {
      localStorage: mockStorage as unknown as Storage,
    } as unknown as Window & typeof globalThis;

    try {
      const now = Date.now();
      const preExistingEvent = {
        id: "agent-1",
        ts: now - 5000,
        text: "Pre-existing speech turn before reload",
        kind: "reply" as const,
      };

      // Before reload: persisted to storage as read
      persistReadSpeechKey(`${preExistingEvent.id}:${preExistingEvent.ts}`, new Set());
      persistReadSpeechKey(
        getSpeechTextKey(preExistingEvent.id, preExistingEvent.text),
        new Set(JSON.parse(storage[READ_SPEECH_KEYS_STORAGE_KEY] || "[]")),
      );

      // On reload: fresh seenKeys, but readKeys restored from storage
      const reloadedReadKeys = loadReadSpeechKeys();
      const freshSeenKeys = new Set<string>();

      const { arrivals } = filterUnreadArrivals({
        events: [preExistingEvent],
        seenKeys: freshSeenKeys,
        readKeys: reloadedReadKeys,
        activeChatAgentId: null,
        now,
      });

      expect(arrivals).toHaveLength(0);
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it("tab switch / visibilitychange does not re-emit or re-queue speech turns", () => {
    const now = Date.now();
    const events = [
      { id: "agent-1", ts: now - 3000, text: "Status update 1", kind: "reply" as const },
      { id: "agent-2", ts: now - 2000, text: "Status update 2", kind: "reply" as const },
    ];
    const seenKeys = new Set<string>();
    const readKeys = new Set<string>();
    let speechQueue: SpeechTurn[] = [];

    // First arrival: tab active
    const firstPass = filterUnreadArrivals({
      events,
      seenKeys,
      readKeys,
      activeChatAgentId: null,
      now,
    });
    expect(firstPass.arrivals).toHaveLength(2);
    speechQueue = enqueueSpeechTurns(speechQueue, firstPass.arrivals);
    expect(speechQueue).toHaveLength(2);

    // Tab switch occurs: effect re-evaluates same events
    const tabSwitchPass = filterUnreadArrivals({
      events,
      seenKeys,
      readKeys,
      activeChatAgentId: null,
      now,
    });
    expect(tabSwitchPass.arrivals).toHaveLength(0);

    speechQueue = enqueueSpeechTurns(speechQueue, tabSwitchPass.arrivals);
    expect(speechQueue).toHaveLength(2);

    // Re-enqueuing original turns is deduplicated by turn key
    const deduplicated = enqueueSpeechTurns(speechQueue, firstPass.arrivals);
    expect(deduplicated).toHaveLength(2);
    expect(deduplicated.map((t) => t.key)).toEqual(firstPass.arrivals.map((t) => t.key));
  });

  it("stale timestamps (> 60s) are ignored", () => {
    const now = 1_700_000_000_000;
    const staleEvent = {
      id: "agent-1",
      ts: now - 65_000, // 65s old (> 60s)
      text: "Old response from long ago",
      kind: "reply" as const,
    };
    const freshEvent = {
      id: "agent-2",
      ts: now - 15_000, // 15s old (< 60s)
      text: "Recent response",
      kind: "reply" as const,
    };

    const seenKeys = new Set<string>();
    const readKeys = new Set<string>();

    const { arrivals } = filterUnreadArrivals({
      events: [staleEvent, freshEvent],
      seenKeys,
      readKeys,
      now,
      maxAgeMs: 60_000,
    });

    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]?.agentId).toBe("agent-2");
    expect(arrivals[0]?.text).toBe("Recent response");
  });
});

describe("isSpeechBubbleVisible", () => {
  it("hides speech bubble when showSpeech is false and not bumpTalking", () => {
    expect(
      isSpeechBubbleVisible({
        showSpeech: false,
        bumpTalking: false,
      }),
    ).toBe(false);

    // Empty text
    expect(
      isSpeechBubbleVisible({
        showSpeech: true,
        speechText: "",
      }),
    ).toBe(false);

    // Whitespace text
    expect(
      isSpeechBubbleVisible({
        showSpeech: true,
        speechText: "   ",
      }),
    ).toBe(false);

    // Null text
    expect(
      isSpeechBubbleVisible({
        showSpeech: true,
        speechText: null,
      }),
    ).toBe(false);
  });

  it("shows speech bubble when speech is active with text", () => {
    expect(
      isSpeechBubbleVisible({
        showSpeech: true,
        speechText: "Hello office!",
      }),
    ).toBe(true);
  });

  it("shows speech bubble during collision bump talking", () => {
    expect(
      isSpeechBubbleVisible({
        showSpeech: false,
        bumpTalking: true,
      }),
    ).toBe(true);
  });

  it("shows speech bubble for active speaker during in_progress standup meeting", () => {
    expect(
      isSpeechBubbleVisible({
        showSpeech: false,
        isStandupActiveSpeaker: true,
      }),
    ).toBe(true);
  });

  it("suppressSpeechBubble hides speech bubble regardless of active speech", () => {
    expect(
      isSpeechBubbleVisible({
        showSpeech: true,
        speechText: "Hello",
        suppressSpeechBubble: true,
      }),
    ).toBe(false);

    expect(
      isSpeechBubbleVisible({
        bumpTalking: true,
        suppressSpeechBubble: true,
      }),
    ).toBe(false);

    expect(
      isSpeechBubbleVisible({
        isStandupActiveSpeaker: true,
        suppressSpeechBubble: true,
      }),
    ).toBe(false);
  });
});

describe("getTurnTimestamp & drainExpiredSpeechTurns", () => {
  it("extracts timestamp from createdAt, key, or falls back", () => {
    expect(getTurnTimestamp({ agentId: "a", key: "a:123", durationMs: 1000, createdAt: 999 })).toBe(999);
    expect(getTurnTimestamp({ agentId: "a", key: "a:1710000000000", durationMs: 1000 })).toBe(1710000000000);
    const fallback = getTurnTimestamp({ agentId: "a", key: "invalid", durationMs: 1000 });
    expect(fallback).toBeGreaterThan(0);
  });

  it("drains expired turns older than their duration and keeps fresh turns", () => {
    const now = 10_000;
    const queue: SpeechTurn[] = [
      { agentId: "old", key: "old:1", durationMs: 3_000, createdAt: 5_000 }, // age 5000 > 3000 -> expired
      { agentId: "fresh", key: "fresh:1", durationMs: 4_000, createdAt: 8_000 }, // age 2000 <= 4000 -> keep
    ];

    const { remaining, expired } = drainExpiredSpeechTurns({ queue, now });
    expect(expired).toHaveLength(1);
    expect(expired[0]?.agentId).toBe("old");
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.agentId).toBe("fresh");
  });

  it("drains turns that are already in readKeys", () => {
    const now = 10_000;
    const queue: SpeechTurn[] = [
      { agentId: "a", key: "a:9000", text: "hello", durationMs: 5_000, createdAt: 9_000 },
    ];
    const readKeys = new Set(["a:9000"]);

    const { remaining, expired } = drainExpiredSpeechTurns({ queue, now, readKeys });
    expect(expired).toHaveLength(1);
    expect(remaining).toHaveLength(0);
  });
});

describe("markInitialSnapshotAsRead helper", () => {
  it("marks all initial snapshot events as read so they are never treated as new arrivals", () => {
    const storage: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
    };
    const originalWindow = globalThis.window;
    globalThis.window = {
      localStorage: mockStorage as unknown as Storage,
    } as unknown as Window & typeof globalThis;

    try {
      const now = Date.now();
      const snapshotEvents = [
        { id: "agent-1", ts: now - 10000, text: "Initial history message 1", kind: "reply" as const },
        { id: "agent-2", ts: now - 5000, text: "Initial history message 2", kind: "reply" as const },
      ];

      const seenKeys = new Set<string>();
      const readKeys = markInitialSnapshotAsRead({
        events: snapshotEvents,
        seenKeys,
      });

      // Keys should be in readKeys and seenKeys
      expect(readKeys.has(`agent-1:${now - 10000}`)).toBe(true);
      expect(readKeys.has(`agent-2:${now - 5000}`)).toBe(true);
      expect(readKeys.has(getSpeechTextKey("agent-1", "Initial history message 1"))).toBe(true);
      expect(readKeys.has(getSpeechTextKey("agent-2", "Initial history message 2"))).toBe(true);
      expect(seenKeys.has(`agent-1:${now - 10000}`)).toBe(true);

      // Now passing these snapshot events to filterUnreadArrivals should yield 0 arrivals
      const { arrivals } = filterUnreadArrivals({
        events: snapshotEvents,
        seenKeys,
        readKeys,
        now,
      });
      expect(arrivals).toHaveLength(0);

      // An actual new arrival arriving after mount should still be accepted
      const newEvent = {
        id: "agent-1",
        ts: now,
        text: "Brand new message after mount",
        kind: "reply" as const,
      };
      const newArrivals = filterUnreadArrivals({
        events: [newEvent],
        seenKeys,
        readKeys,
        now,
      });
      expect(newArrivals.arrivals).toHaveLength(1);
      expect(newArrivals.arrivals[0]?.text).toBe("Brand new message after mount");
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it("handles duplicate arrival text and timestamps in the same batch", () => {
    const now = Date.now();
    const duplicateEvents = [
      { id: "agent-1", ts: now - 2000, text: "Same text", kind: "reply" as const },
      { id: "agent-1", ts: now - 1000, text: "Same text", kind: "reply" as const }, // duplicate text for same agent
    ];
    const seen = new Set<string>();
    const read = new Set<string>();
    const { arrivals } = filterUnreadArrivals({
      events: duplicateEvents,
      seenKeys: seen,
      readKeys: read,
      now,
    });

    // Only one arrival should be admitted
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0]?.text).toBe("Same text");
  });
});
