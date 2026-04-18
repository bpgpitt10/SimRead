import type { ExtractedFrame } from '../types/extractionTypes';

export interface VisionProvider {
  extract(imagePath: string, mode: "practice" | "course"): Promise<ExtractedFrame>;
}