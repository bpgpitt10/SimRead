import type { ExtractedFrame } from "../types";

export type WindowInfo = {
  id: string;
  title: string;
  appName?: string;
};

export interface CaptureProvider {
  start?(): Promise<void>;
  stop?(): Promise<void>;
  listWindows?(): Promise<WindowInfo[]>;
  selectWindow?(windowId: string): Promise<void>;
  capture(): Promise<ExtractedFrame>;
}
