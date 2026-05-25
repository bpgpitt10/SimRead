import { WindowsCaptureProvider } from "./providers/WindowsCaptureProvider";

type ListedWindow = {
  id: string;
  title: string;
  appName?: string;
  processName?: string;
  processId?: number;
  gsproMatchStrength?: "strong app/process match" | "title fallback match";
};

const equalsGspro = (value: string | undefined) => value?.toLowerCase() === "gspro";

const getGsproMatchStrength = (
  window: ListedWindow,
): ListedWindow["gsproMatchStrength"] => {
  if (equalsGspro(window.appName) || equalsGspro(window.processName)) {
    return "strong app/process match";
  }

  const title = window.title.toLowerCase();
  if (title === "gspro" || title.startsWith("gspro ") || title.startsWith("gspro -")) {
    return "title fallback match";
  }

  return undefined;
};

async function main() {
  const provider = new WindowsCaptureProvider();
  const windows = (await provider.listWindows()) as ListedWindow[];

  console.log(`[simread:windows] visible top-level windows: ${windows.length}`);

  for (const window of windows) {
    const matchStrength = getGsproMatchStrength(window);
    const marker = matchStrength ?? "window";
    const appName = window.appName ?? window.processName ?? "unknown app";
    const processId = window.processId ? ` pid=${window.processId}` : "";

    console.log(
      `[${marker}] id=${window.id}${processId} app=${appName} title=${window.title}`,
    );
  }

  const selection = await provider.selectBestGsproWindow();

  console.log(`[simread:windows] selectBestGsproWindow status: ${selection.status}`);

  if (selection.status === "selected") {
    console.log(
      `[simread:windows] selected window id: ${selection.selectedWindow?.id ?? "unknown"}`,
    );
    console.log(
      `[simread:windows] selected match: ${
        selection.selectedWindow?.gsproMatchStrength ?? "unknown"
      }`,
    );

    console.log("[simread:windows] capture() starting");
    const frame = await provider.capture();

    console.log(
      JSON.stringify(
        {
          frameSource: frame.frame.source,
          provider: frame.provider,
          visibleFields: frame.practice?.gsproVisibility?.visibleFields ?? [],
          resolvedShot: frame.practice?.resolvedShot ?? null,
          ogcEligibility: frame.practice?.ogcEligibility ?? null,
          layoutSupport: frame.practice?.layoutSupport ?? null,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (selection.status === "ambiguous") {
    console.log("[simread:windows] ambiguous GSPro candidates:");

    for (const candidate of selection.candidates as ListedWindow[]) {
      const appName = candidate.appName ?? candidate.processName ?? "unknown app";
      const processId = candidate.processId ? ` pid=${candidate.processId}` : "";

      console.log(
        `[candidate: ${candidate.gsproMatchStrength ?? "unknown"}] id=${
          candidate.id
        }${processId} app=${appName} title=${candidate.title}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(
    "[simread:windows] error",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
