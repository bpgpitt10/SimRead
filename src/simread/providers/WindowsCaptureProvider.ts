import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { HttpVisionProvider } from "../../vision/providers/httpVisionProvider";
import type { ExtractedFrame } from "../types";
import type { CaptureProvider, WindowInfo } from "./CaptureProvider";

const UNSUPPORTED_PLATFORM_MESSAGE =
  "WindowsCaptureProvider is only supported on Windows (process.platform === \"win32\").";

const SELECTED_WINDOW_REQUIRED_MESSAGE =
  "WindowsCaptureProvider requires a selected window before capture";

const execFileAsync = promisify(execFile);

const ENUM_VISIBLE_WINDOWS_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class SimReadNativeWindows {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowTextLength(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("user32.dll")]
  public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
"@

$GW_OWNER = 4
$windows = New-Object System.Collections.Generic.List[object]

$callback = [SimReadNativeWindows+EnumWindowsProc]{
  param([IntPtr] $hWnd, [IntPtr] $lParam)

  if (-not [SimReadNativeWindows]::IsWindowVisible($hWnd)) {
    return $true
  }

  if ([SimReadNativeWindows]::IsIconic($hWnd)) {
    return $true
  }

  if ([SimReadNativeWindows]::GetWindow($hWnd, $GW_OWNER) -ne [IntPtr]::Zero) {
    return $true
  }

  $titleLength = [SimReadNativeWindows]::GetWindowTextLength($hWnd)
  if ($titleLength -le 0) {
    return $true
  }

  $rect = New-Object SimReadNativeWindows+RECT
  if (-not [SimReadNativeWindows]::GetWindowRect($hWnd, [ref] $rect)) {
    return $true
  }

  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -le 0 -or $height -le 0) {
    return $true
  }

  $titleBuilder = New-Object System.Text.StringBuilder ($titleLength + 1)
  [void] [SimReadNativeWindows]::GetWindowText($hWnd, $titleBuilder, $titleBuilder.Capacity)
  $title = $titleBuilder.ToString().Trim()
  if ([string]::IsNullOrWhiteSpace($title)) {
    return $true
  }

  $processId = 0
  [void] [SimReadNativeWindows]::GetWindowThreadProcessId($hWnd, [ref] $processId)

  $processName = $null
  try {
    $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName
  } catch {
    $processName = $null
  }

  $windows.Add([pscustomobject]@{
    hwnd = $hWnd.ToInt64()
    title = $title
    processId = $processId
    processName = $processName
  })

  return $true
}

[void] [SimReadNativeWindows]::EnumWindows($callback, [IntPtr]::Zero)
$windows | Sort-Object processName, title | ConvertTo-Json -Depth 3
`;

const CAPTURE_VISIBLE_WINDOW_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"

$hwndValue = [Int64] $env:SIMREAD_CAPTURE_HWND
$outputPath = [string] $env:SIMREAD_CAPTURE_PATH

Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class SimReadCaptureNativeWindows {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("user32.dll")]
  public static extern bool SetProcessDPIAware();

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
"@

[void] [SimReadCaptureNativeWindows]::SetProcessDPIAware()

$hWnd = [IntPtr]::new($hwndValue)
if (-not [SimReadCaptureNativeWindows]::IsWindow($hWnd)) {
  throw "Selected hwnd is no longer a valid window: $hwndValue"
}

if (-not [SimReadCaptureNativeWindows]::IsWindowVisible($hWnd)) {
  throw "Selected hwnd is not visible: $hwndValue"
}

if ([SimReadCaptureNativeWindows]::IsIconic($hWnd)) {
  throw "Selected hwnd is minimized: $hwndValue"
}

$rect = New-Object SimReadCaptureNativeWindows+RECT
if (-not [SimReadCaptureNativeWindows]::GetWindowRect($hWnd, [ref] $rect)) {
  throw "Could not read window bounds for hwnd: $hwndValue"
}

$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -le 0 -or $height -le 0) {
  throw "Selected hwnd has invalid bounds: width=$width height=$height"
}

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

[pscustomobject]@{
  outputPath = $outputPath
  hwnd = $hwndValue
  width = $width
  height = $height
} | ConvertTo-Json -Depth 2
`;

type NativeWindowInfo = {
  hwnd: number;
  title: string;
  processId?: number;
  processName?: string | null;
};

type WindowsWindowInfo = WindowInfo & {
  processName?: string;
  processId?: number;
};

type GsproMatchStrength = "strong app/process match" | "title fallback match";

type GsproMatchedWindow = WindowInfo & {
  gsproMatchStrength: GsproMatchStrength;
};

type GsproSelectionResult = {
  status: "selected" | "not_found" | "ambiguous";
  selectedWindow?: GsproMatchedWindow;
  candidates: GsproMatchedWindow[];
};

const equalsGspro = (value: string | undefined) => value?.toLowerCase() === "gspro";

const getProcessName = (window: WindowInfo) =>
  "processName" in window && typeof window.processName === "string"
    ? window.processName
    : undefined;

const isStrongGsproMatch = (window: WindowInfo) =>
  equalsGspro(window.appName) || equalsGspro(getProcessName(window));

const isTitleFallbackGsproMatch = (window: WindowInfo) => {
  const title = window.title.toLowerCase();

  return title === "gspro" || title.startsWith("gspro ") || title.startsWith("gspro -");
};

const toGsproMatchedWindow = (
  window: WindowInfo,
  gsproMatchStrength: GsproMatchStrength,
): GsproMatchedWindow => ({
  ...window,
  gsproMatchStrength,
});

const findGsproCandidates = (windows: WindowInfo[]): GsproMatchedWindow[] => {
  const strongCandidates = windows
    .filter(isStrongGsproMatch)
    .map((window) => toGsproMatchedWindow(window, "strong app/process match"));

  if (strongCandidates.length > 0) {
    return strongCandidates;
  }

  return windows
    .filter(isTitleFallbackGsproMatch)
    .map((window) => toGsproMatchedWindow(window, "title fallback match"));
};

const toWindowInfo = (window: NativeWindowInfo): WindowsWindowInfo => {
  const id = `hwnd:${window.hwnd}`;
  const processName = window.processName?.trim() || undefined;

  return {
    id,
    title: window.title,
    ...(processName ? { appName: processName, processName } : {}),
    ...(window.processId ? { processId: window.processId } : {}),
  };
};

const parseWindows = (stdout: string): NativeWindowInfo[] => {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  const parsed: unknown = JSON.parse(trimmed);
  const windows = Array.isArray(parsed) ? parsed : [parsed];

  return windows.filter((window): window is NativeWindowInfo => {
    if (!window || typeof window !== "object") {
      return false;
    }

    const candidate = window as Partial<NativeWindowInfo>;
    return typeof candidate.hwnd === "number" && typeof candidate.title === "string";
  });
};

const parseHwndWindowId = (windowId: string): string => {
  const match = /^hwnd:(\d+)$/.exec(windowId);
  if (!match?.[1]) {
    throw new Error(`Windows capture failure: invalid selected window id: ${windowId}`);
  }

  return match[1];
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const padTimestampPart = (value: number) => value.toString().padStart(2, "0");

const formatCaptureTimestamp = (date: Date) =>
  [
    date.getFullYear(),
    padTimestampPart(date.getMonth() + 1),
    padTimestampPart(date.getDate()),
    "-",
    padTimestampPart(date.getHours()),
    padTimestampPart(date.getMinutes()),
    padTimestampPart(date.getSeconds()),
  ].join("");

const saveDebugCapture = async (capturePath: string) => {
  const debugCaptureDir = resolve("debug-captures");
  const latestCapturePath = join(debugCaptureDir, "latest-gspro-capture.png");
  const timestampedCapturePath = join(
    debugCaptureDir,
    `gspro-capture-${formatCaptureTimestamp(new Date())}.png`,
  );

  await mkdir(debugCaptureDir, { recursive: true });
  await copyFile(capturePath, latestCapturePath);
  await copyFile(capturePath, timestampedCapturePath);

  console.log(`[simread:windows] saved capture: ${latestCapturePath}`);
  console.log(`[simread:windows] saved capture: ${timestampedCapturePath}`);
};

export class WindowsCaptureProvider implements CaptureProvider {
  private selectedWindowId: string | undefined;
  private readonly visionProvider: HttpVisionProvider;

  constructor() {
    this.visionProvider = new HttpVisionProvider();
  }

  async start(): Promise<void> {
    if (process.platform !== "win32") {
      return;
    }

    // TODO: Initialize any native Windows capture resources when real capture is added.
  }

  async stop(): Promise<void> {
    if (process.platform !== "win32") {
      return;
    }

    // TODO: Release any native Windows capture resources when real capture is added.
  }

  async listWindows(): Promise<WindowInfo[]> {
    if (process.platform !== "win32") {
      return [];
    }

    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ENUM_VISIBLE_WINDOWS_SCRIPT],
      { windowsHide: true },
    );

    return parseWindows(stdout).map(toWindowInfo);
  }

  async selectWindow(windowId: string): Promise<void> {
    if (process.platform !== "win32") {
      throw new Error(UNSUPPORTED_PLATFORM_MESSAGE);
    }

    const windows = await this.listWindows();
    const selectedWindow = windows.find((window) => window.id === windowId);
    if (!selectedWindow) {
      throw new Error(`Window not found or not visible: ${windowId}`);
    }

    this.selectedWindowId = selectedWindow.id;
  }

  async selectBestGsproWindow(): Promise<GsproSelectionResult> {
    const windows = await this.listWindows();
    const candidates = findGsproCandidates(windows);

    if (candidates.length === 0) {
      return {
        status: "not_found",
        candidates: [],
      };
    }

    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        candidates,
      };
    }

    const [selectedWindow] = candidates as [GsproMatchedWindow, ...GsproMatchedWindow[]];
    await this.selectWindow(selectedWindow.id);

    return {
      status: "selected",
      selectedWindow,
      candidates,
    };
  }

  async capture(): Promise<ExtractedFrame> {
    if (process.platform !== "win32") {
      throw new Error(UNSUPPORTED_PLATFORM_MESSAGE);
    }

    if (!this.selectedWindowId) {
      throw new Error(SELECTED_WINDOW_REQUIRED_MESSAGE);
    }

    const hwnd = parseHwndWindowId(this.selectedWindowId);
    const capturePath = join(tmpdir(), `simread-windows-capture-${randomUUID()}.png`);

    try {
      try {
        await execFileAsync(
          "powershell.exe",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            CAPTURE_VISIBLE_WINDOW_SCRIPT,
          ],
          {
            env: {
              ...process.env,
              SIMREAD_CAPTURE_HWND: hwnd,
              SIMREAD_CAPTURE_PATH: capturePath,
            },
            windowsHide: true,
          },
        );
      } catch (error) {
        throw new Error(`Windows capture failure: ${getErrorMessage(error)}`);
      }

      await saveDebugCapture(capturePath);

      let extractedFrame;
      try {
        extractedFrame = await this.visionProvider.extract(capturePath, "practice");
      } catch (error) {
        throw new Error(
          `HttpVisionProvider/extraction failure: ${getErrorMessage(error)}`,
        );
      }

      return {
        ...extractedFrame,
        frame: {
          ...extractedFrame.frame,
          source: "windows-capture",
        },
      };
    } finally {
      await rm(capturePath, { force: true }).catch(() => undefined);
    }
  }
}
