# SimRead Helper Bundle

SimRead currently ships as a Node-based local helper for the Looper beta. The
helper starts the same local HTTP/SSE server used during development:

- `GET http://127.0.0.1:8788/health`
- `GET http://127.0.0.1:8788/events`

## Build

From the SimRead repo root:

```powershell
npm run bundle:simread-helper
```

This creates:

```text
artifacts/simread-helper/
  dist/
  node_modules/
  package.json
  simread.cmd
```

The artifact includes compiled JavaScript plus the runtime modules needed by the
helper (`sql.js` and `pngjs`). It does not include `ts-node`, TypeScript, or the
source tree.

## Run Locally

```powershell
$env:SIMREAD_SOURCE = "range-db-only"
$env:SIMREAD_DISABLE_OCR_FALLBACK = "1"
.\artifacts\simread-helper\simread.cmd serve
```

Equivalent direct Node command:

```powershell
node .\artifacts\simread-helper\dist\simread\cli.js serve
```

## Looper Beta Notes

For GSPro range beta, Looper should launch the helper with:

```text
SIMREAD_SOURCE=range-db-only
SIMREAD_DISABLE_OCR_FALLBACK=1
```

In that mode SimRead reads only `GSPro.db` / `DrivingRangeShot`; it does not use
OCR fallback and does not require Tesseract.

## Runtime Requirement

This beta artifact still requires a Node.js runtime. Beta users do not need npm,
TypeScript, `ts-node`, VS Code, or the SimRead repo, but Looper must either:

- bundle/provide `node.exe`, or
- launch on a machine where Node is already available on `PATH`.

The next packaging step is to bundle `node.exe` beside `simread.cmd`, or evaluate
a single-file executable packager once Looper's distribution layout is fixed.
