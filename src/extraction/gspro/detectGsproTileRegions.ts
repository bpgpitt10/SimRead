import { createReadStream } from "fs";
import { PNG } from "pngjs";
import { GsproTileBounds, GsproTileRegion } from "./types";

type LoadedPng = PNG & {
  width: number;
  height: number;
  data: Buffer;
};

type PanelSide = "left" | "right";

const loadPng = (imagePath: string): Promise<LoadedPng> =>
  new Promise((resolve, reject) => {
    createReadStream(imagePath)
      .pipe(new PNG())
      .on("parsed", function parsed(this: LoadedPng) {
        resolve(this);
      })
      .on("error", reject);
  });

const pixelOffset = (png: LoadedPng, x: number, y: number) =>
  (png.width * y + x) * 4;

const isNonBlackPixel = (png: LoadedPng, x: number, y: number) => {
  const offset = pixelOffset(png, x, y);
  return png.data[offset]! + png.data[offset + 1]! + png.data[offset + 2]! > 35;
};

const isGsproPanelPixel = (png: LoadedPng, x: number, y: number) => {
  const offset = pixelOffset(png, x, y);
  const red = png.data[offset]!;
  const green = png.data[offset + 1]!;
  const blue = png.data[offset + 2]!;
  const brightness = red + green + blue;

  return (
    brightness > 25 &&
    red < 45 &&
    green < 75 &&
    blue < 85 &&
    blue >= red &&
    green >= red
  );
};

const isTextLikePixel = (png: LoadedPng, x: number, y: number) => {
  const offset = pixelOffset(png, x, y);
  const red = png.data[offset]!;
  const green = png.data[offset + 1]!;
  const blue = png.data[offset + 2]!;

  return red > 145 && green > 145 && blue > 145;
};

const findViewportBounds = (png: LoadedPng): GsproTileBounds => {
  let minX = png.width;
  let minY = png.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < png.height; y += 4) {
    for (let x = 0; x < png.width; x += 4) {
      if (!isNonBlackPixel(png, x, y)) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width: png.width, height: png.height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

const collectRanges = (
  values: number[],
  maxGap: number,
): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = [];
  let start: number | undefined;
  let previous: number | undefined;

  for (const value of values) {
    if (start === undefined || previous === undefined) {
      start = value;
      previous = value;
      continue;
    }

    if (value - previous <= maxGap) {
      previous = value;
      continue;
    }

    ranges.push({ start, end: previous });
    start = value;
    previous = value;
  }

  if (start !== undefined && previous !== undefined) {
    ranges.push({ start, end: previous });
  }

  return ranges;
};

const findPanelBounds = (
  png: LoadedPng,
  viewport: GsproTileBounds,
  side: PanelSide,
): GsproTileBounds | undefined => {
  const zoneWidth = Math.floor(viewport.width * 0.18);
  const zone = {
    x:
      side === "left"
        ? viewport.x
        : viewport.x + viewport.width - zoneWidth,
    y: viewport.y,
    width: zoneWidth,
    height: Math.floor(viewport.height * 0.6),
  };

  const activeRows: number[] = [];
  for (let y = zone.y; y < zone.y + zone.height; y += 4) {
    let darkPixelCount = 0;
    for (let x = zone.x; x < zone.x + zone.width; x += 4) {
      if (isGsproPanelPixel(png, x, y)) {
        darkPixelCount += 1;
      }
    }

    if (darkPixelCount > zoneWidth / 28) {
      activeRows.push(y);
    }
  }

  const rowRanges = collectRanges(activeRows, 8)
    .map((range) => ({
      ...range,
      height: range.end - range.start + 4,
    }))
    .filter((range) => range.height > viewport.height * 0.15)
    .sort((a, b) => b.height - a.height);

  const mainRows = rowRanges[0];
  if (!mainRows) {
    return undefined;
  }

  const activeColumns: number[] = [];
  for (let x = zone.x; x < zone.x + zone.width; x += 4) {
    let darkPixelCount = 0;
    for (let y = mainRows.start; y <= mainRows.end; y += 4) {
      if (isGsproPanelPixel(png, x, y)) {
        darkPixelCount += 1;
      }
    }

    if (darkPixelCount > mainRows.height / 24) {
      activeColumns.push(x);
    }
  }

  const columnRanges = collectRanges(activeColumns, 8)
    .map((range) => ({
      ...range,
      width: range.end - range.start + 4,
    }))
    .filter((range) => range.width > viewport.width * 0.05)
    .sort((a, b) => b.width - a.width);

  const mainColumns = columnRanges[0];
  if (!mainColumns) {
    return undefined;
  }

  return {
    x: mainColumns.start,
    y: mainRows.start,
    width: mainColumns.end - mainColumns.start + 4,
    height: mainRows.end - mainRows.start + 4,
  };
};

const countTextLikePixels = (png: LoadedPng, bounds: GsproTileBounds) => {
  let count = 0;

  for (let y = bounds.y; y < bounds.y + bounds.height; y += 3) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 3) {
      if (isTextLikePixel(png, x, y)) {
        count += 1;
      }
    }
  }

  return count;
};

const splitPanelIntoTiles = (
  png: LoadedPng,
  panel: GsproTileBounds,
  side: PanelSide,
): GsproTileRegion[] => {
  const rows = 6;
  const columns = 2;
  const regions: GsproTileRegion[] = [];
  const cellWidth = panel.width / columns;
  const cellHeight = panel.height / rows;
  const insetX = Math.max(2, Math.round(panel.width * 0.015));
  const insetY = Math.max(2, Math.round(panel.height * 0.008));

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const bounds = {
        x: Math.round(panel.x + column * cellWidth + insetX),
        y: Math.round(panel.y + row * cellHeight + insetY),
        width: Math.round(cellWidth - insetX * 2),
        height: Math.round(cellHeight - insetY * 2),
      };
      const textLikePixels = countTextLikePixels(png, bounds);

      if (textLikePixels < 8) {
        continue;
      }

      regions.push({
        id: `${side}-${row + 1}-${column + 1}`,
        panel: side,
        row: row + 1,
        column: column + 1,
        bounds,
      });
    }
  }

  return regions;
};

export const detectGsproTileRegions = async (
  imagePath: string,
): Promise<GsproTileRegion[]> => {
  const png = await loadPng(imagePath);
  const viewport = findViewportBounds(png);
  const panels = (["left", "right"] as const)
    .map((side) => ({ side, bounds: findPanelBounds(png, viewport, side) }))
    .filter(
      (panel): panel is { side: PanelSide; bounds: GsproTileBounds } =>
        panel.bounds !== undefined,
    );

  return panels.flatMap((panel) =>
    splitPanelIntoTiles(png, panel.bounds, panel.side),
  );
};
