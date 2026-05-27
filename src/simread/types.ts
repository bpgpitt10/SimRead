import type {
  ExtractedFrame as BaseExtractedFrame,
  PracticeState as BasePracticeState,
} from "../types/extractionTypes";

export type PracticeState = BasePracticeState;

export type ExtractedFrame = BaseExtractedFrame;

export type FrameListener = (frame: ExtractedFrame) => void;

export type SimRead = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  extractOnce: () => Promise<ExtractedFrame>;
  onFrame: (callback: FrameListener) => () => void;
};
