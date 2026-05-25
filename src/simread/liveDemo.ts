import { WindowsCaptureProvider } from "./providers/WindowsCaptureProvider";
import type { ExtractedFrame, PracticeState } from "./types";

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_EVERY_POLLS = 4;

type ResolvedShot = NonNullable<PracticeState["resolvedShot"]>;

const signatureFields = [
  "carry",
  "totalDistance",
  "offline",
  "ballSpeed",
  "vla",
  "hla",
  "spin",
  "spinAxis",
  "peakHeight",
  "descentAngle",
] as const satisfies readonly (keyof ResolvedShot)[];

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

const buildShotSignature = (shot: ResolvedShot) =>
  JSON.stringify(
    Object.fromEntries(
      signatureFields.map((field) => [field, shot[field] ?? null]),
    ),
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

async function main() {
  const provider = new WindowsCaptureProvider();
  let stopped = false;
  let pollCount = 0;
  let acceptedCount = 0;
  let lastAcceptedSignature: string | undefined;

  const stop = () => {
    stopped = true;
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

      const signature = buildShotSignature(shot);
      if (signature !== lastAcceptedSignature) {
        lastAcceptedSignature = signature;
        acceptedCount += 1;

        console.log(
          JSON.stringify(
            {
              event: "new-shot",
              timestamp: new Date().toISOString(),
              acceptedCount,
              resolvedShot: shot,
              visibleFields: frame.practice?.gsproVisibility?.visibleFields ?? [],
              ogcEligibility: frame.practice?.ogcEligibility ?? null,
              layoutSupport: frame.practice?.layoutSupport ?? null,
            },
            null,
            2,
          ),
        );
      } else if (pollCount % HEARTBEAT_EVERY_POLLS === 0) {
        console.log(`[simread:live] heartbeat: no new shot (${acceptedCount} emitted)`);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`[simread:live] capture error: ${message}`);

      if (isGsproWindowLostError(message)) {
        console.error("[simread:live] GSPro window lost; stopping live polling.");
        break;
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

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
