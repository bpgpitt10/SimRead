import { existsSync } from "fs";
import { resolve } from "path";
import { buildGsproPracticeFrame } from "./buildGsproPracticeFrame";
import { detectGsproTileRegions } from "./detectGsproTileRegions";
import { normalizeGsproTiles } from "./normalizeGsproTiles";
import { TesseractCliTileTextReader } from "./readers/TileTextReader";
import { GsproCaptureExtraction } from "./types";

const DEFAULT_CAPTURE_PATH = "debug-captures/latest-gspro-capture.png";

export const readGsproCapture = async (
  imagePath = DEFAULT_CAPTURE_PATH,
): Promise<GsproCaptureExtraction> => {
  const resolvedImagePath = resolve(imagePath);

  if (!existsSync(resolvedImagePath)) {
    throw new Error(`GSPro debug capture was not found: ${resolvedImagePath}`);
  }

  const regions = await detectGsproTileRegions(resolvedImagePath);
  const reader = new TesseractCliTileTextReader();
  const readResult = await reader.readTiles(
    resolvedImagePath,
    regions.map((region) => region.bounds),
  );

  return normalizeGsproTiles(
    resolvedImagePath,
    regions,
    readResult.texts,
    readResult.engine,
    readResult.warnings,
  );
};

const isCliEntry = require.main === module;

if (isCliEntry) {
  readGsproCapture(process.argv[2])
    .then((result) => {
      const extractedFrame = buildGsproPracticeFrame(result);
      console.log(
        JSON.stringify(
          {
            ...result,
            extractedFrameSummary: {
              source: extractedFrame.frame.source,
              mode: extractedFrame.mode,
              provider: extractedFrame.provider,
              overallConfidence: extractedFrame.confidence.overall,
              tileCount: extractedFrame.practice?.tiles.length ?? 0,
              visibleFieldCount:
                extractedFrame.practice?.gsproVisibility?.visibleFields.length ?? 0,
              layoutSupported:
                extractedFrame.practice?.layoutSupport?.isSupported ?? false,
            },
            extractedFrame: {
              frame: extractedFrame.frame,
              mode: extractedFrame.mode,
              confidence: extractedFrame.confidence,
              provider: extractedFrame.provider,
              practice: {
                gsproVisibility: extractedFrame.practice?.gsproVisibility,
                resolvedShot: extractedFrame.practice?.resolvedShot,
                ogcEligibility: extractedFrame.practice?.ogcEligibility,
                layoutSupport: extractedFrame.practice?.layoutSupport,
              },
            },
          },
          null,
          2,
        ),
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
