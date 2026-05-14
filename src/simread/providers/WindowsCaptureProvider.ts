import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtractedFrame } from "../types";
import type { CaptureProvider, WindowInfo } from "./CaptureProvider";

const UNSUPPORTED_PLATFORM_MESSAGE =
  "WindowsCaptureProvider is only supported on Windows (process.platform === \"win32\").";

const NOT_IMPLEMENTED_MESSAGE =
  "WindowsCaptureProvider capture is not implemented yet. Future work will capture the selected window on Windows.";

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

type GsproSelectionResult = {
  status: "selected" | "not_found" | "ambiguous";
  selectedWindow?: WindowInfo;
  candidates: WindowInfo[];
};

const includesGspro = (window: WindowInfo) => {
  const processName =
    "processName" in window && typeof window.processName === "string"
      ? window.processName
      : undefined;

  return [window.title, window.appName, processName].some((value) =>
    value?.toLowerCase().includes("gspro"),
  );
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

export class WindowsCaptureProvider implements CaptureProvider {
  private selectedWindowId: string | undefined;

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
    const candidates = windows.filter(includesGspro);

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

    const [selectedWindow] = candidates as [WindowInfo, ...WindowInfo[]];
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

    // TODO: Capture the selected GSPro window and run it through the extractor.
    void this.selectedWindowId;
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }
}
