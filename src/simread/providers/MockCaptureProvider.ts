import { resolve } from "path";
import { HttpVisionProvider } from "../../vision/providers/httpVisionProvider";
import type { ExtractedFrame } from "../types";
import type { CaptureProvider } from "./CaptureProvider";

const DEFAULT_FIXTURE_PATHS = [
  resolve(process.cwd(), "images/practice/pic1.png"),
  resolve(process.cwd(), "images/practice/pic2.png"),
  resolve(process.cwd(), "images/practice/pic3.png"),
  resolve(process.cwd(), "images/practice/pic4.png"),
  resolve(process.cwd(), "images/practice/pic5.png"),
  resolve(process.cwd(), "images/practice/pic6.png"),
];

export type MockCaptureProviderOptions = {
  fixturePaths?: string[];
};

export class MockCaptureProvider implements CaptureProvider {
  private readonly fixturePaths: string[];
  private readonly visionProvider: HttpVisionProvider;
  private fixtureIndex: number;

  constructor(options: MockCaptureProviderOptions = {}) {
    this.fixturePaths = options.fixturePaths?.length
      ? options.fixturePaths
      : DEFAULT_FIXTURE_PATHS;
    this.visionProvider = new HttpVisionProvider();
    this.fixtureIndex = 0;
  }

  async capture(): Promise<ExtractedFrame> {
    const fixturePath = this.fixturePaths[this.fixtureIndex];

    if (!fixturePath) {
      throw new Error("MockCaptureProvider has no fixture paths configured");
    }

    this.fixtureIndex = (this.fixtureIndex + 1) % this.fixturePaths.length;

    const extractedFrame = await this.visionProvider.extract(fixturePath, "practice");

    return {
      ...extractedFrame,
      frame: {
        ...extractedFrame.frame,
        source: "mock",
      },
    };
  }
}
