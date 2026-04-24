import type { ExtractedFrame } from "../types";

export interface CaptureProvider {
  capture(): Promise<ExtractedFrame>;
}
