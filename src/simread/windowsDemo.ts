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
  const gsproWindows = windows.filter(includesGsPro);

  console.log(`[simread:windows] visible top-level windows: ${windows.length}`);

  for (const window of windows) {
    const marker = includesGsPro(window) ? "GSPro match" : "window";
    const appName = window.appName ?? window.processName ?? "unknown app";
    const processId = window.processId ? ` pid=${window.processId}` : "";

    console.log(
      `[${marker}] id=${window.id}${processId} app=${appName} title=${window.title}`,
    );
  }

  if (gsproWindows.length === 0) {
    console.log("[simread:windows] GSPro was not found in the visible window list.");
    return;
  }

  console.log(`[simread:windows] GSPro matches: ${gsproWindows.length}`);
}

main().catch((error) => {
  console.error(
    "[simread:windows] error",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
