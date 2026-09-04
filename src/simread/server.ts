import http, { ServerResponse } from "node:http";
import { runSimReadLive, SimReadLiveEvent } from "./liveEventLoop";
import { isOcrFallbackEnabled, resolveSimReadMode } from "./mode";

const DEFAULT_PORT = 8788;
const HOST = "127.0.0.1";

const BROWSER_ACCESS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Private-Network": "true",
  "Access-Control-Max-Age": "86400",
};

const parsePort = () => {
  const rawPort = process.env.SIMREAD_PORT;
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }

  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.warn(
      `[simread:serve] ignoring invalid SIMREAD_PORT=${JSON.stringify(rawPort)}; using ${DEFAULT_PORT}`,
    );
    return DEFAULT_PORT;
  }

  return parsed;
};

const clients = new Set<ServerResponse>();
let liveAbortController: AbortController | undefined;
let liveLoopStarted = false;

const writeJson = (response: ServerResponse, statusCode: number, body: unknown) => {
  response.writeHead(statusCode, {
    ...BROWSER_ACCESS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
};

const writeSseEvent = (response: ServerResponse, event: SimReadLiveEvent) => {
  response.write(`event: ${event.event}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
};

const broadcastEvent = (event: SimReadLiveEvent) => {
  for (const client of clients) {
    writeSseEvent(client, event);
  }
};

const startLiveLoop = () => {
  if (liveLoopStarted) {
    return;
  }

  liveLoopStarted = true;
  liveAbortController = new AbortController();
  void runSimReadLive({
    signal: liveAbortController.signal,
    logLatestCapture: process.env.SIMREAD_SAVE_DEBUG_CAPTURES === "1",
    onEvent: broadcastEvent,
  }).catch((error) => {
    broadcastEvent({
      event: "error",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    });
  });
};

const handleEvents = (response: ServerResponse) => {
  response.writeHead(200, {
    ...BROWSER_ACCESS_HEADERS,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.write(": simread events connected\n\n");
  clients.add(response);
  writeSseEvent(response, {
    event: "status",
    timestamp: new Date().toISOString(),
    message: "connected to simread event stream",
  });
  startLiveLoop();

  response.on("close", () => {
    clients.delete(response);
  });
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${HOST}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, BROWSER_ACCESS_HEADERS);
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    const mode = resolveSimReadMode();

    writeJson(response, 200, {
      ok: true,
      service: "simread",
      mode,
      source: mode === "range-db-only" ? "gspro-range-db" : "gspro-range-db-first",
      ocrFallbackEnabled: isOcrFallbackEnabled(mode),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/events") {
    handleEvents(response);
    return;
  }

  writeJson(response, 404, {
    ok: false,
    error: "not_found",
  });
});

const shutdown = () => {
  console.log("[simread:serve] stopping");
  liveAbortController?.abort();
  for (const client of clients) {
    client.end();
  }
  clients.clear();
  server.close(() => {
    console.log("[simread:serve] stopped");
    process.exit(0);
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

server.listen(parsePort(), HOST, () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : DEFAULT_PORT;
  console.log(`[simread:serve] listening on http://${HOST}:${port}`);
});
