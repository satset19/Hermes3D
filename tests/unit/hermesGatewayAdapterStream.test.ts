// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter: any = await import("../../server/hermes-gateway-adapter.js");
const { createThrottledDeltaEmitter, CHAT_STREAM_THROTTLE_MS } = adapter;

describe("hermes gateway adapter websocket chat stream throttling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports default throttle interval of 50ms", () => {
    expect(CHAT_STREAM_THROTTLE_MS).toBe(50);
  });

  it("emits the leading delta frame immediately without delay", () => {
    const emitted: string[] = [];
    const throttled = createThrottledDeltaEmitter((text: string) => emitted.push(text), 50);

    throttled("H");
    expect(emitted).toEqual(["H"]);
  });

  it("throttles intermediate frames within 50ms interval and emits the latest text", () => {
    const emitted: string[] = [];
    const throttled = createThrottledDeltaEmitter((text: string) => emitted.push(text), 50);

    throttled("H");
    expect(emitted).toEqual(["H"]);

    // Multiple rapid chunks arrive within 50ms
    vi.advanceTimersByTime(10);
    throttled("He");
    vi.advanceTimersByTime(10);
    throttled("Hel");
    vi.advanceTimersByTime(10);
    throttled("Hell");
    vi.advanceTimersByTime(10);
    throttled("Hello");

    // Before 50ms timer completes, intermediate frames are buffered
    expect(emitted).toEqual(["H"]);

    // Advance to 50ms mark: only the latest text "Hello" is emitted
    vi.advanceTimersByTime(10);
    expect(emitted).toEqual(["H", "Hello"]);
  });

  it("handles successive throttle intervals properly across prolonged streaming", () => {
    const emitted: string[] = [];
    const throttled = createThrottledDeltaEmitter((text: string) => emitted.push(text), 50);

    // Initial burst at t=0
    throttled("Token1");
    expect(emitted).toEqual(["Token1"]);

    // Burst between t=0 and t=50
    vi.advanceTimersByTime(15);
    throttled("Token1 Token2");
    vi.advanceTimersByTime(35); // Reaches t=50
    expect(emitted).toEqual(["Token1", "Token1 Token2"]);

    // Next burst between t=50 and t=100
    vi.advanceTimersByTime(10);
    throttled("Token1 Token2 Token3");
    vi.advanceTimersByTime(20);
    throttled("Token1 Token2 Token3 Token4");
    expect(emitted).toEqual(["Token1", "Token1 Token2"]);

    vi.advanceTimersByTime(20); // Reaches t=100
    expect(emitted).toEqual(["Token1", "Token1 Token2", "Token1 Token2 Token3 Token4"]);
  });

  it("flushes pending buffered delta text immediately on flush()", () => {
    const emitted: string[] = [];
    const throttled = createThrottledDeltaEmitter((text: string) => emitted.push(text), 50);

    throttled("Part 1");
    expect(emitted).toEqual(["Part 1"]);

    vi.advanceTimersByTime(20);
    throttled("Part 1 + pending");
    expect(emitted).toEqual(["Part 1"]);

    // Flush immediately sends pending text without waiting for remainder of 50ms
    throttled.flush();
    expect(emitted).toEqual(["Part 1", "Part 1 + pending"]);

    // Advancing timers further does not emit duplicate text
    vi.advanceTimersByTime(100);
    expect(emitted).toEqual(["Part 1", "Part 1 + pending"]);
  });

  it("cancels pending delta timer on cancel() so no trailing delta fires", () => {
    const emitted: string[] = [];
    const throttled = createThrottledDeltaEmitter((text: string) => emitted.push(text), 50);

    throttled("Start");
    expect(emitted).toEqual(["Start"]);

    vi.advanceTimersByTime(15);
    throttled("Start + pending");

    // Cancel pending buffer and timer
    throttled.cancel();

    // Advance time past the throttle interval: nothing additional should be emitted
    vi.advanceTimersByTime(100);
    expect(emitted).toEqual(["Start"]);
  });

  it("delivers chat.final frame immediately without delay and without trailing delta frames", () => {
    const wsFrames: Array<{ event: string; state: string; text: string }> = [];

    const sendEvent = (state: string, text: string) => {
      wsFrames.push({ event: "chat", state, text });
    };

    const throttledDelta = createThrottledDeltaEmitter((text: string) => {
      sendEvent("delta", text);
    }, 50);

    // SSE streaming commences
    throttledDelta("Thinking");
    expect(wsFrames).toEqual([
      { event: "chat", state: "delta", text: "Thinking" },
    ]);

    // Fast chunks arrive at t=10ms, t=20ms, t=30ms
    vi.advanceTimersByTime(10);
    throttledDelta("Thinking complete. Final");
    vi.advanceTimersByTime(10);
    throttledDelta("Thinking complete. Final answer");
    vi.advanceTimersByTime(10);
    throttledDelta("Thinking complete. Final answer is 42.");

    // Turn finishes at t=30ms (before the 50ms throttle timer fires):
    // Cancel any pending throttled delta timer and emit final frame immediately
    throttledDelta.cancel();
    sendEvent("final", "Thinking complete. Final answer is 42.");

    expect(wsFrames).toEqual([
      { event: "chat", state: "delta", text: "Thinking" },
      { event: "chat", state: "final", text: "Thinking complete. Final answer is 42." },
    ]);

    // Verify advancing past the 50ms window does not leak any stale trailing delta frame
    vi.advanceTimersByTime(200);
    expect(wsFrames).toHaveLength(2);
    expect(wsFrames[1].state).toBe("final");
  });
});
