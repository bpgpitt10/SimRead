import { WindowsCaptureProvider } from "./providers/WindowsCaptureProvider";
import type { ExtractedFrame, PracticeState } from "./types";

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_EVERY_POLLS = 4;
const SETTLE_WINDOW_MS = 3000;

type ResolvedShot = NonNullable<PracticeState["resolvedShot"]>;

const coreIdentityFields = [
  "carry",
  "totalDistance",
  "offline",
  "ballSpeed",
  "spin",
] as const satisfies readonly (keyof ResolvedShot)[];

const completenessFields = [
  ...coreIdentityFields,
  "vla",
  "hla",
  "spinAxis",
  "peakHeight",
  "descentAngle",
] as const satisfies readonly (keyof ResolvedShot)[];

type ShotEventName = "provisional-shot" | "shot-update" | "final-shot";

type AcceptedFrame = {
  frame: ExtractedFrame;
  shot: ResolvedShot;
  coreIdentity: string;
  completenessScore: number;
  presentFields: string[];
};

type PendingShot = {
  finalizeAtMs: number;
  best: AcceptedFrame;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const isGsproWindowLostError = (message: string) => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("selected hwnd is no longer a valid window") ||
    normalized.includes("selected hwnd is not visible") ||
    normalized.includes("selected hwnd is minimized") ||
    normalized.includes("window not found or not visible")
  );
};

const hasRequiredShotFields = (shot: ResolvedShot) =>
  shot.carry !== undefined &&
  shot.totalDistance !== undefined &&
  shot.offline !== undefined;

const buildCoreIdentity = (shot: ResolvedShot) =>
  JSON.stringify(
    Object.fromEntries(
      coreIdentityFields.map((field) => [field, shot[field] ?? null]),
    ),
  );

const getPresentCompletenessFields = (shot: ResolvedShot) =>
  completenessFields.filter((field) => shot[field] !== undefined);

const scoreShotCompleteness = (frame: ExtractedFrame, shot: ResolvedShot) =>
  getPresentCompletenessFields(shot).length +
  (frame.practice?.gsproVisibility?.visibleFields.length ?? 0) / 100;

const hasSameRequiredIdentity = (left: ResolvedShot, right: ResolvedShot) =>
  left.carry === right.carry &&
  left.totalDistance === right.totalDistance &&
  left.offline === right.offline;

const hasCompatibleCoreIdentity = (left: ResolvedShot, right: ResolvedShot) =>
  hasSameRequiredIdentity(left, right) &&
  coreIdentityFields.every(
    (field) =>
      left[field] === undefined ||
      right[field] === undefined ||
      left[field] === right[field],
  );

const getAcceptedShot = (frame: ExtractedFrame) => {
  const practice = frame.practice;
  if (!practice?.layoutSupport?.isSupported) {
    return undefined;
  }

  const shot = practice.resolvedShot;
  if (!shot || !hasRequiredShotFields(shot)) {
    return undefined;
  }

  return shot;
};

const toAcceptedFrame = (frame: ExtractedFrame, shot: ResolvedShot): AcceptedFrame => ({
  frame,
  shot,
  coreIdentity: buildCoreIdentity(shot),
  completenessScore: scoreShotCompleteness(frame, shot),
  presentFields: getPresentCompletenessFields(shot),
});

const getAddedFields = (previous: AcceptedFrame, next: AcceptedFrame) => {
  const previousFields = new Set(previous.presentFields);

  return next.presentFields.filter((field) => !previousFields.has(field));
};

const isBetterFrame = (previous: AcceptedFrame, next: AcceptedFrame) =>
  next.completenessScore > previous.completenessScore;

const emitShotEvent = (
  event: ShotEventName,
  accepted: AcceptedFrame,
  sequence: number,
  addedFields: readonly string[] = [],
) => {
  console.log(
    JSON.stringify(
      {
        event,
        timestamp: new Date().toISOString(),
        sequence,
        coreIdentity: accepted.coreIdentity,
        ...(addedFields.length > 0 ? { addedFields } : {}),
        resolvedShot: accepted.shot,
        visibleFields: accepted.frame.practice?.gsproVisibility?.visibleFields ?? [],
        ogcEligibility: accepted.frame.practice?.ogcEligibility ?? null,
        layoutSupport: accepted.frame.practice?.layoutSupport ?? null,
      },
      null,
      2,
    ),
  );
};

async function main() {
  const provider = new WindowsCaptureProvider({
    logLatestCapture: process.env.SIMREAD_SAVE_DEBUG_CAPTURES === "1",
  });
  let stopped = false;
  let pollCount = 0;
  let shotSequence = 0;
  let pendingShot: PendingShot | undefined;
  let lastFinalizedShot: AcceptedFrame | undefined;

  const stop = () => {
    stopped = true;
  };

  const finalizePendingShot = () => {
    if (!pendingShot) {
      return;
    }

    emitShotEvent("final-shot", pendingShot.best, shotSequence);
    lastFinalizedShot = pendingShot.best;
    pendingShot = undefined;
  };

  process.once("SIGINT", () => {
    console.log("[simread:live] stopping");
    stop();
  });

  const selection = await provider.selectBestGsproWindow();

  if (selection.status === "not_found") {
    console.log("[simread:live] GSPro window not found. Open GSPro with a visible shot and try again.");
    return;
  }

  if (selection.status === "ambiguous") {
    console.log("[simread:live] multiple GSPro windows found; close extras or use simread:windows to inspect candidates.");
    for (const candidate of selection.candidates) {
      console.log(
        `[simread:live] candidate id=${candidate.id} match=${candidate.gsproMatchStrength} title=${candidate.title}`,
      );
    }
    return;
  }

  console.log(
    `[simread:live] selected GSPro window id=${selection.selectedWindow?.id ?? "unknown"} match=${
      selection.selectedWindow?.gsproMatchStrength ?? "unknown"
    }`,
  );
  console.log(`[simread:live] polling every ${POLL_INTERVAL_MS}ms`);

  while (!stopped) {
    pollCount += 1;
    const nowMs = Date.now();

    if (pendingShot && nowMs >= pendingShot.finalizeAtMs) {
      finalizePendingShot();
    }

    try {
      const frame = await provider.capture();
      const shot = getAcceptedShot(frame);

      if (!shot) {
        if (pollCount % HEARTBEAT_EVERY_POLLS === 0) {
          console.log("[simread:live] heartbeat: waiting for supported shot fields");
        }

        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const accepted = toAcceptedFrame(frame, shot);
      if (
        lastFinalizedShot &&
        !pendingShot &&
        hasCompatibleCoreIdentity(lastFinalizedShot.shot, accepted.shot)
      ) {
        if (pollCount % HEARTBEAT_EVERY_POLLS === 0) {
          console.log(`[simread:live] heartbeat: no new shot (${shotSequence} finalized)`);
        }
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      if (!pendingShot) {
        shotSequence += 1;
        const startedAtMs = Date.now();
        pendingShot = {
          finalizeAtMs: startedAtMs + SETTLE_WINDOW_MS,
          best: accepted,
        };
        emitShotEvent("provisional-shot", accepted, shotSequence);
      } else if (hasCompatibleCoreIdentity(pendingShot.best.shot, accepted.shot)) {
        const addedFields = getAddedFields(pendingShot.best, accepted);

        if (isBetterFrame(pendingShot.best, accepted)) {
          pendingShot = {
            ...pendingShot,
            best: accepted,
          };

          if (addedFields.length > 0) {
            emitShotEvent("shot-update", accepted, shotSequence, addedFields);
          }
        }
      } else {
        finalizePendingShot();
        shotSequence += 1;
        const startedAtMs = Date.now();
        pendingShot = {
          finalizeAtMs: startedAtMs + SETTLE_WINDOW_MS,
          best: accepted,
        };
        emitShotEvent("provisional-shot", accepted, shotSequence);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`[simread:live] capture error: ${message}`);

      if (isGsproWindowLostError(message)) {
        console.error("[simread:live] GSPro window lost; stopping live polling.");
        break;
      }
    }

    if (pendingShot && Date.now() >= pendingShot.finalizeAtMs) {
      finalizePendingShot();
    }

    await sleep(POLL_INTERVAL_MS);
  }

  finalizePendingShot();
  await provider.stop?.();
  console.log("[simread:live] stopped");
}

main().catch((error) => {
  console.error(
    "[simread:live] error",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
