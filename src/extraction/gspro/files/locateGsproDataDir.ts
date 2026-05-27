import os from "node:os";
import path from "node:path";

export const locateGsproDataDir = () =>
  path.join(os.homedir(), "AppData", "LocalLow", "GSPro", "GSPro");

export const locateGsproDatabasePath = () =>
  path.join(locateGsproDataDir(), "GSPro.db");
