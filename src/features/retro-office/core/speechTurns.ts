/**
 * One speaking turn at a time for scene speech bubbles.
 *
 * A group chat answered by four agents used to raise four full-size bubbles in
 * the same second. They overlap into an unreadable stack, and the office reads
 * as noise rather than a conversation. Replies are therefore queued and granted
 * the floor one at a time, the way people actually take turns.
 *
 * Pure so the ordering and timing rules are testable without a scene.
 */

/** Shortest a bubble stays up — below this it flashes past unread. */
export const SPEECH_TURN_MIN_MS = 3_400;

/** Longest a single reply may hold the floor while others are waiting. */
export const SPEECH_TURN_MAX_MS = 9_000;

/**
 * How many replies may wait for the floor.
 *
 * A burst larger than this would keep the office narrating a conversation long
 * after it ended, so the oldest waiting replies are dropped: by the time their
 * turn arrived they would no longer be news.
 */
export const SPEECH_QUEUE_MAX = 4;

export const SPEECH_MESSAGE_MAX_AGE_MS = 60_000;

export interface SpeechTurn {
  agentId: string;
  /** Identifies one reply, so the same event is never queued twice. */
  key: string;
  durationMs: number;
  text?: string;
  createdAt?: number;
}

export interface SpeechFeedEventLike {
  id: string;
  ts: number;
  text: string;
  kind?: string;
}

export interface SpeechBubbleVisibilityParams {
  showSpeech?: boolean;
  speechText?: string | null;
  suppressSpeechBubble?: boolean;
  bumpTalking?: boolean;
  isStandupActiveSpeaker?: boolean;
}

export const isSpeechBubbleVisible = ({
  showSpeech = false,
  speechText = null,
  suppressSpeechBubble = false,
  bumpTalking = false,
  isStandupActiveSpeaker = false,
}: SpeechBubbleVisibilityParams): boolean => {
  if (suppressSpeechBubble) return false;
  const hasSpeech = Boolean(showSpeech && speechText?.trim());
  return Boolean(
    hasSpeech ||
      bumpTalking ||
      isStandupActiveSpeaker,
  );
};

export const getSpeechTextKey = (agentId: string, text: string): string => {
  const normalized = text.trim().slice(0, 48).replace(/\s+/g, "_");
  return `${agentId}:text:${normalized}`;
};

export interface FilterUnreadArrivalsParams {
  events: SpeechFeedEventLike[];
  seenKeys: Set<string>;
  readKeys: Set<string>;
  activeChatAgentId?: string | null;
  now?: number;
  maxAgeMs?: number;
}

export const filterUnreadArrivals = ({
  events,
  seenKeys,
  readKeys,
  activeChatAgentId,
  now = Date.now(),
  maxAgeMs = SPEECH_MESSAGE_MAX_AGE_MS,
}: FilterUnreadArrivalsParams): {
  arrivals: SpeechTurn[];
  keysToMarkRead: string[];
} => {
  const arrivals: SpeechTurn[] = [];
  const keysToMarkRead: string[] = [];

  // Track texts and timestamps already recorded among accepted arrivals in this run
  const recordedArrivalTexts = new Set<string>();
  const recordedArrivalTimestamps = new Set<string>();

  // Oldest first: the queue is a waiting line, and events is newest-first.
  for (const event of [...events].reverse()) {
    if (event.kind !== "reply") continue;
    const text = event.text?.trim?.() ?? "";
    if (!text) continue;

    const eventTs = event.ts;
    const key = `${event.id}:${eventTs}`;
    const textKey = getSpeechTextKey(event.id, text);
    const tsKey = `${event.id}:ts:${eventTs}`;

    // Max age check: ignore replies whose timestamp is older than maxAgeMs (default 60s)
    if (
      maxAgeMs > 0 &&
      typeof eventTs === "number" &&
      eventTs > 0 &&
      now - eventTs > maxAgeMs
    ) {
      seenKeys.add(key);
      seenKeys.add(textKey);
      continue;
    }

    // If an arrival text or timestamp is already recorded or if textKey is in readKeys, do not add to arrivals.
    if (readKeys.has(key) || readKeys.has(textKey)) {
      seenKeys.add(key);
      seenKeys.add(textKey);
      continue;
    }

    if (seenKeys.has(key) || seenKeys.has(textKey)) {
      continue;
    }

    if (
      recordedArrivalTexts.has(textKey) ||
      recordedArrivalTexts.has(text) ||
      recordedArrivalTimestamps.has(key) ||
      recordedArrivalTimestamps.has(tsKey)
    ) {
      seenKeys.add(key);
      seenKeys.add(textKey);
      continue;
    }

    seenKeys.add(key);
    seenKeys.add(textKey);

    if (activeChatAgentId && event.id === activeChatAgentId) {
      keysToMarkRead.push(key);
      keysToMarkRead.push(textKey);
      continue;
    }

    recordedArrivalTexts.add(textKey);
    recordedArrivalTexts.add(text);
    recordedArrivalTimestamps.add(key);
    recordedArrivalTimestamps.add(tsKey);

    arrivals.push({
      agentId: event.id,
      key,
      text,
      durationMs: speechTurnDurationMs(text.length),
      createdAt: typeof eventTs === "number" && eventTs > 0 ? eventTs : now,
    });
  }

  return { arrivals, keysToMarkRead };
};

/** Reading time for a reply of this length, bounded at both ends. */
export const speechTurnDurationMs = (textLength: number): number =>
  Math.min(
    SPEECH_TURN_MAX_MS,
    Math.max(SPEECH_TURN_MIN_MS, 1_800 + textLength * 34),
  );

/**
 * Add replies to the waiting line.
 *
 * An agent holds at most one place in the queue: when it speaks again before
 * its earlier reply reached the floor, the newer text replaces the older one
 * rather than making the same character say two things in a row.
 */
export const enqueueSpeechTurns = (
  queue: SpeechTurn[],
  incoming: SpeechTurn[],
  max: number = SPEECH_QUEUE_MAX,
): SpeechTurn[] => {
  const next = [...queue];
  for (const turn of incoming) {
    if (next.some((queued) => queued.key === turn.key)) continue;
    const supersedes = next.findIndex(
      (queued) => queued.agentId === turn.agentId,
    );
    if (supersedes >= 0) next.splice(supersedes, 1);
    next.push(turn);
  }
  return next.length > max ? next.slice(next.length - max) : next;
};

export const getTurnTimestamp = (turn: SpeechTurn): number => {
  if (typeof turn.createdAt === "number" && !Number.isNaN(turn.createdAt) && turn.createdAt > 0) {
    return turn.createdAt;
  }
  const lastColon = turn.key.lastIndexOf(":");
  if (lastColon !== -1) {
    const rawTs = Number(turn.key.slice(lastColon + 1));
    if (!Number.isNaN(rawTs) && rawTs > 0) {
      return rawTs;
    }
  }
  return Date.now();
};

export const drainExpiredSpeechTurns = ({
  queue,
  now = Date.now(),
  readKeys,
}: {
  queue: SpeechTurn[];
  now?: number;
  readKeys?: Set<string>;
}): {
  remaining: SpeechTurn[];
  expired: SpeechTurn[];
} => {
  const remaining: SpeechTurn[] = [];
  const expired: SpeechTurn[] = [];

  for (const turn of queue) {
    const turnTs = getTurnTimestamp(turn);
    const isExpired = now - turnTs > turn.durationMs;
    const textKey = turn.text ? getSpeechTextKey(turn.agentId, turn.text) : "";
    const isAlreadyRead = Boolean(
      readKeys &&
        (readKeys.has(turn.key) || (textKey && readKeys.has(textKey))),
    );

    if (isExpired || isAlreadyRead) {
      expired.push(turn);
    } else {
      remaining.push(turn);
    }
  }

  return { remaining, expired };
};

export const READ_SPEECH_KEYS_STORAGE_KEY = "hermes3d_read_speech_keys";
export const MAX_READ_SPEECH_KEYS = 200;

const getSafeLocalStorage = (): Storage | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

export const loadReadSpeechKeys = (): Set<string> => {
  const storage = getSafeLocalStorage();
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(READ_SPEECH_KEYS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (k): k is string => typeof k === "string" && k.trim().length > 0,
      );
      return new Set(valid);
    }
  } catch {
    // Ignore storage read or JSON parsing errors
  }
  return new Set();
};

export const persistReadSpeechKey = (
  keyOrKeys: string | string[],
  existingKeys?: Set<string>,
): Set<string> => {
  const keysToAdd = (Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]).filter(
    (k): k is string => typeof k === "string" && k.trim().length > 0,
  );

  if (keysToAdd.length === 0) {
    return existingKeys ? new Set(existingKeys) : loadReadSpeechKeys();
  }

  const next = existingKeys ? new Set(existingKeys) : loadReadSpeechKeys();
  for (const k of keysToAdd) {
    next.add(k);
  }

  const storage = getSafeLocalStorage();
  if (!storage) return next;

  try {
    const arr = Array.from(next).slice(-MAX_READ_SPEECH_KEYS);
    storage.setItem(
      READ_SPEECH_KEYS_STORAGE_KEY,
      JSON.stringify(arr),
    );
  } catch {
    try {
      const arr = Array.from(next).slice(-Math.floor(MAX_READ_SPEECH_KEYS / 2));
      storage.setItem(
        READ_SPEECH_KEYS_STORAGE_KEY,
        JSON.stringify(arr),
      );
    } catch {
      // Ignore fallback write errors
    }
  }

  return next;
};

export const persistReadSpeechKeys = (
  keys: string[],
  existingKeys?: Set<string>,
): Set<string> => persistReadSpeechKey(keys, existingKeys);

export interface MarkInitialSnapshotOptions {
  events: SpeechFeedEventLike[];
  existingReadKeys?: Set<string>;
  seenKeys?: Set<string>;
  persist?: boolean;
}

/**
 * Marks all initial snapshot events as read at mount time so pre-existing history
 * is never treated as a new arrival.
 */
export const markInitialSnapshotAsRead = (
  optionsOrEvents: SpeechFeedEventLike[] | MarkInitialSnapshotOptions,
  existingReadKeys?: Set<string>,
  seenKeys?: Set<string>,
): Set<string> => {
  let events: SpeechFeedEventLike[];
  let currentReadKeys: Set<string> | undefined;
  let currentSeenKeys: Set<string> | undefined;
  let shouldPersist = true;

  if (Array.isArray(optionsOrEvents)) {
    events = optionsOrEvents;
    currentReadKeys = existingReadKeys;
    currentSeenKeys = seenKeys;
  } else {
    events = optionsOrEvents.events ?? [];
    currentReadKeys = optionsOrEvents.existingReadKeys;
    currentSeenKeys = optionsOrEvents.seenKeys;
    shouldPersist = optionsOrEvents.persist !== false;
  }

  const nextReadKeys = currentReadKeys
    ? new Set(currentReadKeys)
    : loadReadSpeechKeys();
  const keysToPersist: string[] = [];

  for (const event of events) {
    if (!event || !event.id) continue;
    const key = `${event.id}:${event.ts}`;
    nextReadKeys.add(key);
    keysToPersist.push(key);
    if (currentSeenKeys) {
      currentSeenKeys.add(key);
    }

    if (event.text) {
      const text = event.text.trim();
      if (text) {
        const textKey = getSpeechTextKey(event.id, text);
        nextReadKeys.add(textKey);
        keysToPersist.push(textKey);
        if (currentSeenKeys) {
          currentSeenKeys.add(textKey);
        }
      }
    }
  }

  if (shouldPersist && keysToPersist.length > 0) {
    return persistReadSpeechKey(keysToPersist, nextReadKeys);
  }

  return nextReadKeys;
};

export const markInitialSpeechEventsRead = markInitialSnapshotAsRead;
