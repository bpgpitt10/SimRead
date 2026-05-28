import { runSimReadLive, SimReadLiveEvent } from "./liveEventLoop";

const logEvent = (event: SimReadLiveEvent) => {
  if (event.event === "status") {
    console.log(`[simread:live] ${event.message}`);
    return;
  }

  if (event.event === "error") {
    console.error(`[simread:live] ${event.message}`);
    return;
  }

  console.log(JSON.stringify(event, null, 2));
};

async function main() {
  const abortController = new AbortController();

  process.once("SIGINT", () => {
    console.log("[simread:live] stopping");
    abortController.abort();
  });

  await runSimReadLive({
    signal: abortController.signal,
    logLatestCapture: process.env.SIMREAD_SAVE_DEBUG_CAPTURES === "1",
    onEvent: logEvent,
  });
}

main().catch((error) => {
  console.error(
    "[simread:live] error",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
