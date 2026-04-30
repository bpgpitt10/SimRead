import { createSimRead } from "./index";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

async function main() {
  const simRead = createSimRead({ intervalMs: 750 });
  let emittedFrames = 0;

  const unsubscribe = simRead.onFrame((frame) => {
    emittedFrames += 1;
    console.log(
      JSON.stringify(
        {
          event: "frame",
          emittedFrames,
          source: frame.frame.source,
          mode: frame.mode,
          visibleFields: frame.practice?.gsproVisibility?.visibleFields ?? [],
          resolvedShot: frame.practice?.resolvedShot ?? null,
          ogcEligibility: frame.practice?.ogcEligibility ?? null,
        },
        null,
        2,
      ),
    );
  });

  try {
    console.log("[simread:demo] extractOnce()");
    await simRead.extractOnce();

    console.log("[simread:demo] start()");
    await simRead.start();
    await sleep(1700);

    console.log("[simread:demo] stop()");
    await simRead.stop();
  } finally {
    unsubscribe();
    await simRead.stop();
  }
}

main()
  .then(() => {
    console.log("[simread:demo] complete");
  })
  .catch((error) => {
    console.error(
      "[simread:demo] error",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
