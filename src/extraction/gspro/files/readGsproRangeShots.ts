import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import initSqlJs = require("sql.js");
import { locateGsproDatabasePath } from "./locateGsproDataDir";
import {
  GsproRangeShotRow,
  mapGsproRangeShotToFrame,
  ParsedGsproRangeShot,
} from "./mapGsproRangeShotToFrame";

type SqlValue = number | string | Uint8Array | null;

type ReadGsproRangeShotsOptions = {
  limit?: number;
  databasePath?: string;
};

const DEFAULT_LIMIT = 1;
const MAX_LIMIT = 100;

const clampLimit = (limit: number | undefined) => {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`Range shot limit must be a positive integer, got ${limit}`);
  }

  return Math.min(limit, MAX_LIMIT);
};

const createTempDatabaseCopy = async (databasePath: string) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "simread-gspro-db-"));
  const tempDatabasePath = path.join(tempDir, "GSPro.db");

  await fs.copyFile(databasePath, tempDatabasePath);

  return {
    tempDir,
    tempDatabasePath,
  };
};

const cleanupTempDatabaseCopy = async (tempDir: string) => {
  await fs.rm(tempDir, {
    recursive: true,
    force: true,
  });
};

const toRangeShotRow = (values: SqlValue[]): GsproRangeShotRow => {
  const [id, dateCreated, shotData] = values;

  if (typeof id !== "number") {
    throw new Error("DrivingRangeShot.ID was not numeric");
  }

  if (typeof shotData !== "string") {
    throw new Error("DrivingRangeShot.ShotData was not text JSON");
  }

  if (
    dateCreated !== null &&
    typeof dateCreated !== "string" &&
    typeof dateCreated !== "number"
  ) {
    throw new Error("DrivingRangeShot.DateCreated was not a string, number, or null");
  }

  return {
    id,
    dateCreated,
    shotData,
  };
};

const readRowsFromCopiedDatabase = async (
  tempDatabasePath: string,
  limit: number,
) => {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(path.dirname(require.resolve("sql.js")), file),
  });
  const bytes = await fs.readFile(tempDatabasePath);
  const db = new SQL.Database(bytes);

  try {
    const result = db.exec(
      `SELECT ID, DateCreated, ShotData FROM DrivingRangeShot ORDER BY ID DESC LIMIT ${limit}`,
    );
    const firstResult = result[0];

    if (!firstResult) {
      return [];
    }

    return firstResult.values.map(toRangeShotRow);
  } finally {
    db.close();
  }
};

export const readGsproRangeShots = async (
  options: ReadGsproRangeShotsOptions = {},
): Promise<ParsedGsproRangeShot[]> => {
  const databasePath = options.databasePath ?? locateGsproDatabasePath();
  const limit = clampLimit(options.limit);
  const { tempDir, tempDatabasePath } = await createTempDatabaseCopy(databasePath);

  try {
    const rows = await readRowsFromCopiedDatabase(tempDatabasePath, limit);
    return rows.map(mapGsproRangeShotToFrame);
  } finally {
    await cleanupTempDatabaseCopy(tempDir);
  }
};

const getLimitFromArgv = () => {
  const rawLimit = process.argv[2];
  return rawLimit === undefined ? DEFAULT_LIMIT : Number(rawLimit);
};

const toCliOutput = (shot: ParsedGsproRangeShot | undefined) => {
  if (!shot) {
    return {
      source: "gspro-range-db",
      shot: null,
      message: "No DrivingRangeShot rows found.",
    };
  }

  return {
    source: shot.source,
    rowId: shot.rowId,
    DateCreated: shot.dateCreated,
    gsproFields: shot.gsproFields,
    resolvedShot: shot.resolvedShot,
    ogcEligibility: shot.ogcEligibility,
    layoutSupport: shot.layoutSupport,
    fieldsExtracted: shot.extractedFields,
    missingFields: shot.missingFields,
    frame: shot.frame,
  };
};

async function main() {
  const [latestShot] = await readGsproRangeShots({ limit: getLimitFromArgv() });
  console.log(JSON.stringify(toCliOutput(latestShot), null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      "[simread:range-db] error",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
