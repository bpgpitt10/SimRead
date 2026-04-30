import type { ExtractedFrame } from "../types";
import type { CaptureProvider, WindowInfo } from "./CaptureProvider";

const UNSUPPORTED_PLATFORM_MESSAGE =
  "WindowsCaptureProvider is only supported on Windows (process.platform === \"win32\").";

const NOT_IMPLEMENTED_MESSAGE =
  "WindowsCaptureProvider is not implemented yet. Future work will enumerate GSPro windows and capture the selected window on Windows.";

export class WindowsCaptureProvider implements CaptureProvider {
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

    // TODO: Enumerate visible Windows top-level windows and identify GSPro candidates.
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async selectWindow(_windowId: string): Promise<void> {
    if (process.platform !== "win32") {
      throw new Error(UNSUPPORTED_PLATFORM_MESSAGE);
    }

    // TODO: Store and validate the selected GSPro window handle/id.
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async capture(): Promise<ExtractedFrame> {
    if (process.platform !== "win32") {
      throw new Error(UNSUPPORTED_PLATFORM_MESSAGE);
    }

    // TODO: Capture the selected GSPro window and run it through the extractor.
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }
}
