import type { CaptureProvider } from "./providers/CaptureProvider";
import { MockCaptureProvider } from "./providers/MockCaptureProvider";
import type { ExtractedFrame, FrameListener, SimRead } from "./types";

export type CreateSimReadOptions = {
  provider?: CaptureProvider;
  intervalMs?: number;
};

export const createSimRead = (options: CreateSimReadOptions = {}): SimRead => {
  const provider = options.provider ?? new MockCaptureProvider();
  const intervalMs = options.intervalMs ?? 1000;
  const listeners = new Set<FrameListener>();
  let timer: NodeJS.Timeout | null = null;
  let isRunning = false;
  let inFlight: Promise<void> | null = null;

  const emitFrame = (frame: ExtractedFrame) => {
    listeners.forEach((listener) => listener(frame));
  };

  const extractOnce = async () => {
    const frame = await provider.capture();
    emitFrame(frame);
    return frame;
  };

  const loopOnce = async () => {
    if (inFlight) {
      return inFlight;
    }

    inFlight = extractOnce()
      .then(() => undefined)
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };

  const start = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    await loopOnce();
    timer = setInterval(() => {
      void loopOnce();
    }, intervalMs);
  };

  const stop = () => {
    isRunning = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const onFrame = (callback: FrameListener) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  };

  return {
    start,
    stop,
    extractOnce,
    onFrame,
  };
};
