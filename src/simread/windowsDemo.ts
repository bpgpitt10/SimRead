import { WindowsCaptureProvider } from "./providers/WindowsCaptureProvider";

type ListedWindow = {
  id: string;
  title: string;
  appName?: string;
  processName?: string;
  processId?: number;
};

const includesGsPro = (window: ListedWindow) =>
  [window.title, window.appName, window.processName].some((value) =>
    value?.toLowerCase().includes("gspro"),
  );

async function main() {
  const provider = new WindowsCaptureProvider();
  const windows = (await provider.listWindows()) as ListedWindow[];

  console.log(`[simread:windows] visible top-level windows: ${windows.length}`);

  for (const window of windows) {
    const marker = includesGsPro(window) ? "GSPro match" : "window";
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
    return;
  }

  if (selection.status === "ambiguous") {
    console.log("[simread:windows] ambiguous GSPro candidates:");

    for (const candidate of selection.candidates as ListedWindow[]) {
      const appName = candidate.appName ?? candidate.processName ?? "unknown app";
      const processId = candidate.processId ? ` pid=${candidate.processId}` : "";

      console.log(
        `[candidate] id=${candidate.id}${processId} app=${appName} title=${candidate.title}`,
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
