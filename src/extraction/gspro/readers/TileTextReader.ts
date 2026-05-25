import { spawn, spawnSync } from "child_process";
import { createReadStream } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { PNG } from "pngjs";
import { GsproTileBounds, GsproTileText } from "../types";

type LoadedPng = PNG & {
  width: number;
  height: number;
  data: Buffer;
};

export type TileTextReaderResult = {
  engine: string;
  ocrRan: boolean;
  warnings: string[];
  texts: GsproTileText[];
};

export interface TileTextReader {
  readTiles(imagePath: string, bounds: GsproTileBounds[]): Promise<TileTextReaderResult>;
}

const loadPng = (imagePath: string): Promise<LoadedPng> =>
  new Promise((resolve, reject) => {
    createReadStream(imagePath)
      .pipe(new PNG())
      .on("parsed", function parsed(this: LoadedPng) {
        resolve(this);
      })
      .on("error", reject);
  });

const cropPng = (
  source: LoadedPng,
  bounds: GsproTileBounds,
  scale = 2,
): Buffer => {
  const cropped = new PNG({
    width: bounds.width * scale,
    height: bounds.height * scale,
  });

  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceOffset = (source.width * (bounds.y + y) + bounds.x + x) * 4;
      for (let scaleY = 0; scaleY < scale; scaleY += 1) {
        for (let scaleX = 0; scaleX < scale; scaleX += 1) {
          const targetX = x * scale + scaleX;
          const targetY = y * scale + scaleY;
          const targetOffset = (cropped.width * targetY + targetX) * 4;
          cropped.data[targetOffset] = source.data[sourceOffset]!;
          cropped.data[targetOffset + 1] = source.data[sourceOffset + 1]!;
          cropped.data[targetOffset + 2] = source.data[sourceOffset + 2]!;
          cropped.data[targetOffset + 3] = source.data[sourceOffset + 3]!;
        }
      }
    }
  }

  return PNG.sync.write(cropped);
};

type TesseractRead = {
  text: string;
  confidence?: number;
};

const meanConfidenceFromTsv = (tsv: string) => {
  const rows = tsv.split(/\r?\n/).slice(1);
  const confidences = rows
    .map((row) => row.split("\t"))
    .map((columns) => Number(columns[10]))
    .filter((confidence) => Number.isFinite(confidence) && confidence >= 0);

  if (confidences.length === 0) {
    return undefined;
  }

  return (
    confidences.reduce((sum, confidence) => sum + confidence, 0) /
    confidences.length
  );
};

const runTesseract = (
  imagePath: string,
  options: string[],
): Promise<TesseractRead> =>
  new Promise((resolve, reject) => {
    const child = spawn("tesseract", [imagePath, "stdout", ...options], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        const usesTsv = options.includes("tsv");
        const read: TesseractRead = {
          text: usesTsv
            ? stdout
                .split(/\r?\n/)
                .slice(1)
                .map((row) => row.split("\t")[11])
                .filter((word): word is string => Boolean(word))
                .join(" ")
            : stdout,
        };
        const confidence = usesTsv ? meanConfidenceFromTsv(stdout) : undefined;
        if (confidence !== undefined) {
          read.confidence = confidence;
        }
        resolve(read);
        return;
      }

      reject(new Error(stderr || `tesseract exited with code ${code}`));
    });
  });

const clampBounds = (source: LoadedPng, bounds: GsproTileBounds): GsproTileBounds => {
  const x = Math.max(0, Math.min(source.width - 1, bounds.x));
  const y = Math.max(0, Math.min(source.height - 1, bounds.y));
  const width = Math.max(1, Math.min(source.width - x, bounds.width));
  const height = Math.max(1, Math.min(source.height - y, bounds.height));

  return { x, y, width, height };
};

const valueBoundsForTile = (bounds: GsproTileBounds): GsproTileBounds => ({
  x: bounds.x,
  y: bounds.y,
  width: bounds.width,
  height: Math.round(bounds.height * 0.58),
});

const labelBoundsForTile = (bounds: GsproTileBounds): GsproTileBounds => ({
  x: bounds.x,
  y: bounds.y + Math.round(bounds.height * 0.48),
  width: bounds.width,
  height: Math.round(bounds.height * 0.52),
});

export class TesseractCliTileTextReader implements TileTextReader {
  async readTiles(
    imagePath: string,
    bounds: GsproTileBounds[],
  ): Promise<TileTextReaderResult> {
    const availability = spawnSync("tesseract", ["--version"], {
      encoding: "utf8",
      windowsHide: true,
    });

    if (availability.error || availability.status !== 0) {
      return {
        engine: "tesseract-cli",
        ocrRan: false,
        warnings: [
          "Local OCR did not run because the tesseract executable was not found on PATH.",
        ],
        texts: bounds.map(() => ({})),
      };
    }

    const source = await loadPng(imagePath);
    const tempDir = await mkdtemp(join(tmpdir(), "simread-ocr-"));

    try {
      const texts: GsproTileText[] = [];

      for (const [index, tileBounds] of bounds.entries()) {
        const fullCropPath = join(tempDir, `tile-${index + 1}-full.png`);
        const valueCropPath = join(tempDir, `tile-${index + 1}-value.png`);
        const labelCropPath = join(tempDir, `tile-${index + 1}-label.png`);
        await writeFile(fullCropPath, cropPng(source, clampBounds(source, tileBounds)));
        await writeFile(
          valueCropPath,
          cropPng(source, clampBounds(source, valueBoundsForTile(tileBounds)), 3),
        );
        await writeFile(
          labelCropPath,
          cropPng(source, clampBounds(source, labelBoundsForTile(tileBounds)), 3),
        );
        const [full, value, label] = await Promise.all([
          runTesseract(fullCropPath, ["--psm", "6", "tsv"]),
          runTesseract(valueCropPath, [
            "--psm",
            "7",
            "-c",
            "tessedit_char_whitelist=0123456789.-+",
            "tsv",
          ]),
          runTesseract(labelCropPath, [
            "--psm",
            "7",
            "-c",
            "tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz() ",
            "tsv",
          ]),
        ]);
        const tileText: GsproTileText = {
          rawText: full.text,
          valueText: value.text,
          labelText: label.text,
        };
        if (full.confidence !== undefined) {
          tileText.confidence = full.confidence;
        }
        if (value.confidence !== undefined) {
          tileText.valueConfidence = value.confidence;
        }
        if (label.confidence !== undefined) {
          tileText.labelConfidence = label.confidence;
        }
        texts.push(tileText);
      }

      return {
        engine: "tesseract-cli",
        ocrRan: true,
        warnings: [],
        texts,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
