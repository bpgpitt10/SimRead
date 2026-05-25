import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type TesseractAvailabilitySource =
  | "explicit"
  | "env"
  | "bundled"
  | "known-windows-path"
  | "path"
  | "missing";

export type TesseractAvailability = {
  available: boolean;
  executablePath?: string;
  source: TesseractAvailabilitySource;
  version?: string;
  message?: string;
};

export type ResolveTesseractPathOptions = {
  executablePath?: string;
};

const TESSERACT_NOT_FOUND_MESSAGE =
  "Local OCR unavailable: tesseract not found. Install/bundle Tesseract or set SIMREAD_TESSERACT_PATH.";

const bundledCandidatePaths = [
  "resources/tesseract/tesseract.exe",
  "vendor/tesseract/tesseract.exe",
  "bin/tesseract/tesseract.exe",
] as const;

const knownWindowsCandidatePaths = [
  "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
] as const;

const getVersion = (stdout: string) => {
  const [firstLine] = stdout.trim().split(/\r?\n/);

  return firstLine || undefined;
};

const checkExecutable = (
  executablePath: string,
  source: Exclude<TesseractAvailabilitySource, "missing">,
  requireExistingFile: boolean,
): TesseractAvailability => {
  if (requireExistingFile && !existsSync(executablePath)) {
    return {
      available: false,
      executablePath,
      source,
      message: `Tesseract executable was not found at ${executablePath}.`,
    };
  }

  const result = spawnSync(executablePath, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    const detail =
      result.error?.message ||
      result.stderr?.trim() ||
      `tesseract --version exited with code ${result.status ?? "unknown"}`;

    return {
      available: false,
      executablePath,
      source,
      message: `Tesseract executable is not available at ${executablePath}: ${detail}`,
    };
  }

  const version = getVersion(result.stdout);

  return {
    available: true,
    executablePath,
    source,
    ...(version ? { version } : {}),
  };
};

export const checkTesseractAvailability = (
  options: ResolveTesseractPathOptions = {},
): TesseractAvailability => {
  if (options.executablePath) {
    return checkExecutable(resolve(options.executablePath), "explicit", true);
  }

  if (process.env.SIMREAD_TESSERACT_PATH) {
    return checkExecutable(resolve(process.env.SIMREAD_TESSERACT_PATH), "env", true);
  }

  for (const candidatePath of bundledCandidatePaths) {
    const resolvedCandidatePath = resolve(candidatePath);
    if (existsSync(resolvedCandidatePath)) {
      return checkExecutable(resolvedCandidatePath, "bundled", true);
    }
  }

  for (const candidatePath of knownWindowsCandidatePaths) {
    if (existsSync(candidatePath)) {
      return checkExecutable(candidatePath, "known-windows-path", true);
    }
  }

  const pathAvailability = checkExecutable("tesseract", "path", false);
  if (pathAvailability.available) {
    return pathAvailability;
  }

  return {
    available: false,
    source: "missing",
    message: TESSERACT_NOT_FOUND_MESSAGE,
  };
};

export const resolveTesseractPath = (
  options: ResolveTesseractPathOptions = {},
): string => {
  const availability = checkTesseractAvailability(options);

  if (!availability.available || !availability.executablePath) {
    throw new Error(availability.message ?? TESSERACT_NOT_FOUND_MESSAGE);
  }

  return availability.executablePath;
};

const isCliEntry = require.main === module;

if (isCliEntry) {
  console.log(JSON.stringify(checkTesseractAvailability(), null, 2));
}
