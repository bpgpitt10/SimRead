#!/usr/bin/env node

const command = process.argv[2] ?? "serve";

const printUsage = () => {
  console.error("Usage: simread serve|live");
};

const main = async () => {
  if (command === "serve") {
    await import("./server");
    return;
  }

  if (command === "live") {
    await import("./liveDemo");
    return;
  }

  printUsage();
  process.exitCode = 1;
};

void main().catch((error) => {
  console.error(
    "[simread] error",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
