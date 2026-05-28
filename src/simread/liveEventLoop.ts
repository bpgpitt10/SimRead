import { readGsproRangeShots } from "../extraction/gspro/files/readGsproRangeShots";
import { WindowsCaptureProvider } from "./providers/WindowsCaptureProvider";
import type { ExtractedFrame, PracticeState } from "./types";

const DEFAULT_RANGE_DB_POLL_MS = 500;
const MIN_RANGE_DB_POLL_MS = 200;
const DEFAULT_OCR_FALLBACK_POLL_MS = 3000;
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

type RangeDbTiming = {
  rowId: number;
  dateCreated: string | number | null;
  emitTimestamp: string;
  ageMs?: number;
};

type AcceptedFrame = {
  frame: ExtractedFrame;
  shot: ResolvedShot;
  coreIdentity: string;
  completenessScore: number;
  presentFields: string[];
  source: ExtractedFrame["frame"]["source"];
  rowId?: number;
  rangeDbTiming?: RangeDbTiming;
};

type PendingShot = {
  finalizeAtMs: number;
  best: AcceptedFrame;
};

export type SimReadShotEvent = {
  event: ShotEventName;
  timestamp: string;
  sequence: number;
  source: ExtractedFrame["frame"]["source"];
  coreIdentity: string;
  rowId?: number;
  rangeDbTiming?: RangeDbTiming;
  addedFields?: readonly string[];
  resolvedShot: ResolvedShot;
  visibleFields: string[];
  ogcEligibility: PracticeState["ogcEligibility"] | null;
  layoutSupport: PracticeState["layoutSupport"] | null;
};

export type SimReadStatusEvent = {
  event: "status";
  timestamp: string;
  message: string;
};

export type SimReadErrorEvent = {
  event: "error";
  timestamp: string;
  message: string;
};

export type SimReadLiveEvent =
  | SimReadShotEvent
  | SimReadStatusEvent
  | SimReadErrorEvent;

export type RunSimReadLiveOptions = {
  onEvent: (event: SimReadLiveEvent) => void;
  signal?: AbortSignal;
  logLatestCapture?: boolean;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const readPollMs = (
  envName: string,
  defaultMs: number,
  minimumMs: number | undefined,
  emitStatus: (message: string) => void,
) => {
  const rawValue = process.env[envName];
  if (rawValue === undefined) {
    return defaultMs;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    emitStatus(
      `ignoring invalid ${envName}=${JSON.stringify(rawValue)}; using ${defaultMs}ms`,
    );
    return defaultMs;
  }

  const rounded = Math.round(parsed);
  return minimumMs === undefined ? rounded : Math.max(rounded, minimumMs);
};

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

const toAcceptedFrame = (
  frame: ExtractedFrame,
  shot: ResolvedShot,
  identityOverride?: string,
  rowId?: number,
  rangeDbTiming?: RangeDbTiming,
): AcceptedFrame => ({
  frame,
  shot,
  coreIdentity: identityOverride ?? buildCoreIdentity(shot),
  completenessScore: scoreShotCompleteness(frame, shot),
  presentFields: getPresentCompletenessFields(shot),
  source: frame.frame.source,
  ...(rowId !== undefined ? { rowId } : {}),
  ...(rangeDbTiming !== undefined ? { rangeDbTiming } : {}),
});

const getAddedFields = (previous: AcceptedFrame, next: AcceptedFrame) => {
  const previousFields = new Set(previous.presentFields);

  return next.presentFields.filter((field) => !previousFields.has(field));
};

const isBetterFrame = (previous: AcceptedFrame, next: AcceptedFrame) =>
  next.completenessScore > previous.completenessScore;

const parseGsproDateCreatedMs = (dateCreated: string | number | null) => {
  if (dateCreated === null) {
    return undefined;
  }

  const parsed =
    typeof dateCreated === "number"
      ? new Date(dateCreated).getTime()
      : new Date(dateCreated.replace(" ", "T")).getTime();

  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildRangeDbTiming = (
  rowId: number,
  dateCreated: string | number | null,
) => {
  const emitMs = Date.now();
  const emitTimestamp = new Date(emitMs).toISOString();
  const dateCreatedMs = parseGsproDateCreatedMs(dateCreated);

  return {
    rowId,
    dateCreated,
    emitTimestamp,
    ...(dateCreatedMs !== undefined ? { ageMs: emitMs - dateCreatedMs } : {}),
  };
};

const buildShotEvent = (
  event: ShotEventName,
  accepted: AcceptedFrame,
  sequence: number,
  addedFields: readonly string[] = [],
): SimReadShotEvent => ({
  event,
  timestamp: new Date().toISOString(),
  sequence,
  source: accepted.source,
  coreIdentity: accepted.coreIdentity,
  ...(accepted.rowId !== undefined ? { rowId: accepted.rowId } : {}),
  ...(accepted.rangeDbTiming !== undefined
    ? { rangeDbTiming: accepted.rangeDbTiming }
    : {}),
  ...(addedFields.length > 0 ? { addedFields } : {}),
  resolvedShot: accepted.shot,
  visibleFields: accepted.frame.practice?.gsproVisibility?.visibleFields ?? [],
  ogcEligibility: accepted.frame.practice?.ogcEligibility ?? null,
  layoutSupport: accepted.frame.practice?.layoutSupport ?? null,
});

export const runSimReadLive = async (options: RunSimReadLiveOptions) => {
  const emitStatus = (message: string) => {
    options.onEvent({
      event: "status",
      timestamp: new Date().toISOString(),
      message,
    });
  };
  const emitError = (message: string) => {
    options.onEvent({
      event: "error",
      timestamp: new Date().toISOString(),
      message,
    });
  };
  const rangeDbPollMs = readPollMs(
    "SIMREAD_RANGE_DB_POLL_MS",
    DEFAULT_RANGE_DB_POLL_MS,
    MIN_RANGE_DB_POLL_MS,
    emitStatus,
  );
  const ocrFallbackPollMs = readPollMs(
    "SIMREAD_OCR_FALLBACK_POLL_MS",
    DEFAULT_OCR_FALLBACK_POLL_MS,
    undefined,
    emitStatus,
  );
  const provider = new WindowsCaptureProvider({
    logLatestCapture: options.logLatestCapture ?? false,
  });
  let stopped = false;
  let pollCount = 0;
  let shotSequence = 0;
  let pendingShot: PendingShot | undefined;
  let lastFinalizedShot: AcceptedFrame | undefined;
  let lastEmittedRangeRowId: number | undefined;
  let rangeDbUnavailableLogged = false;
  let ocrWindowSelected = false;
  let nextOcrFallbackAtMs = 0;

  const stop = () => {
    stopped = true;
  };
  const abortSignal = options.signal;

  if (abortSignal?.aborted) {
    return;
  }

  abortSignal?.addEventListener("abort", stop, { once: true });

  const finalizePendingShot = () => {
    if (!pendingShot) {
      return;
    }

    options.onEvent(buildShotEvent("final-shot", pendingShot.best, shotSequence));
    lastFinalizedShot = pendingShot.best;
    pendingShot = undefined;
  };

  const ensureOcrWindowSelected = async () => {
    if (ocrWindowSelected) {
      return true;
    }

    const selection = await provider.selectBestGsproWindow();

    if (selection.status === "not_found") {
      if (pollCount % HEARTBEAT_EVERY_POLLS === 0) {
        emitStatus("OCR fallback unavailable: GSPro window not found.");
      }
      return false;
    }

    if (selection.status === "ambiguous") {
      emitStatus(
        "OCR fallback unavailable: multiple GSPro windows found; close extras or use simread:windows to inspect candidates.",
      );
      for (const candidate of selection.candidates) {
        emitStatus(
          `candidate id=${candidate.id} match=${candidate.gsproMatchStrength} title=${candidate.title}`,
        );
      }
      return false;
    }

    ocrWindowSelected = true;
    emitStatus(
      `OCR fallback selected GSPro window id=${selection.selectedWindow?.id ?? "unknown"} match=${
        selection.selectedWindow?.gsproMatchStrength ?? "unknown"
      }`,
    );
    return true;
  };

  emitStatus(
    `polling GSPro range DB first every ${rangeDbPollMs}ms; OCR fallback every ${ocrFallbackPollMs}ms when needed`,
  );

  try {
    while (!stopped) {
      pollCount += 1;
      const nowMs = Date.now();

      if (pendingShot && nowMs >= pendingShot.finalizeAtMs) {
        finalizePendingShot();
      }

      try {
        try {
          const [latestRangeShot] = await readGsproRangeShots({ limit: 1 });

          if (!latestRangeShot) {
            if (pollCount % HEARTBEAT_EVERY_POLLS === 0) {
              emitStatus("range DB heartbeat: no DrivingRangeShot rows found; using OCR fallback");
            }
          } else if (latestRangeShot.rowId === lastEmittedRangeRowId) {
            if (pollCount % HEARTBEAT_EVERY_POLLS === 0) {
              emitStatus(
                `range DB heartbeat: waiting for new range DB shot after row ${latestRangeShot.rowId}`,
              );
            }
            await sleep(rangeDbPollMs);
            continue;
          } else {
            const shot = getAcceptedShot(latestRangeShot.frame);

            if (shot) {
              finalizePendingShot();
              shotSequence += 1;
              const rangeDbTiming = buildRangeDbTiming(
                latestRangeShot.rowId,
                latestRangeShot.dateCreated,
              );
              const accepted = toAcceptedFrame(
                latestRangeShot.frame,
                shot,
                `gspro-range-db:${latestRangeShot.rowId}`,
                latestRangeShot.rowId,
                rangeDbTiming,
              );
              options.onEvent(buildShotEvent("final-shot", accepted, shotSequence));
              lastFinalizedShot = accepted;
              lastEmittedRangeRowId = latestRangeShot.rowId;
              await sleep(rangeDbPollMs);
              continue;
            }

            emitStatus(
              `range DB row ${latestRangeShot.rowId} missing required fields; using OCR fallback`,
            );
          }

          rangeDbUnavailableLogged = false;
        } catch (error) {
          if (!rangeDbUnavailableLogged || pollCount % HEARTBEAT_EVERY_POLLS === 0) {
            emitError(
              `range DB unavailable; using OCR fallback: ${getErrorMessage(error)}`,
            );
          }
          rangeDbUnavailableLogged = true;
        }

        if (Date.now() < nextOcrFallbackAtMs) {
          await sleep(rangeDbPollMs);
          continue;
        }

        nextOcrFallbackAtMs = Date.now() + ocrFallbackPollMs;
        if (!(await ensureOcrWindowSelected())) {
          await sleep(rangeDbPollMs);
          continue;
        }

        const frame = await provider.capture();
        const shot = getAcceptedShot(frame);

        if (!shot) {
          if (pollCount % HEARTBEAT_EVERY_POLLS === 0) {
            emitStatus("heartbeat: waiting for supported shot fields");
          }

          await sleep(rangeDbPollMs);
          continue;
        }

        const accepted = toAcceptedFrame(frame, shot);
        if (
          lastFinalizedShot &&
          !pendingShot &&
          hasCompatibleCoreIdentity(lastFinalizedShot.shot, accepted.shot)
        ) {
          if (pollCount % HEARTBEAT_EVERY_POLLS === 0) {
            emitStatus(`heartbeat: no new shot (${shotSequence} finalized)`);
          }
          await sleep(rangeDbPollMs);
          continue;
        }

        if (!pendingShot) {
          shotSequence += 1;
          const startedAtMs = Date.now();
          pendingShot = {
            finalizeAtMs: startedAtMs + SETTLE_WINDOW_MS,
            best: accepted,
          };
          options.onEvent(buildShotEvent("provisional-shot", accepted, shotSequence));
        } else if (hasCompatibleCoreIdentity(pendingShot.best.shot, accepted.shot)) {
          const addedFields = getAddedFields(pendingShot.best, accepted);

          if (isBetterFrame(pendingShot.best, accepted)) {
            pendingShot = {
              ...pendingShot,
              best: accepted,
            };

            if (addedFields.length > 0) {
              options.onEvent(
                buildShotEvent("shot-update", accepted, shotSequence, addedFields),
              );
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
          options.onEvent(buildShotEvent("provisional-shot", accepted, shotSequence));
        }
      } catch (error) {
        const message = getErrorMessage(error);
        emitError(`capture error: ${message}`);

        if (isGsproWindowLostError(message)) {
          emitError("GSPro window lost; stopping live polling.");
          break;
        }
      }

      if (pendingShot && Date.now() >= pendingShot.finalizeAtMs) {
        finalizePendingShot();
      }

      await sleep(rangeDbPollMs);
    }
  } finally {
    finalizePendingShot();
    await provider.stop?.();
    abortSignal?.removeEventListener("abort", stop);
    emitStatus("stopped");
  }
};
