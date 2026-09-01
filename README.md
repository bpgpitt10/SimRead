# SimRead

SimRead is a local GSPro data extraction helper. It reads simulator shot data and exposes normalized events that another application can consume locally.

The current Looper beta uses SimRead in **range DB only** mode, reading GSPro's local `GSPro.db` / `DrivingRangeShot` data rather than relying on OCR.

## Current status

SimRead is an early-stage project and the interfaces may still change. The range DB workflow is the path currently used by Looper.

**Project status:** SimRead is published for use and reference, but this repository is not currently accepting external contributions or pull requests.

## Requirements

- Windows
- Node.js
- GSPro installed locally
- npm (for development/building only)

## Install

```powershell
npm install
```

## Run the local helper

For the GSPro range workflow used by Looper:

```powershell
$env:SIMREAD_SOURCE = "range-db-only"
$env:SIMREAD_DISABLE_OCR_FALLBACK = "1"
npm run simread:serve
```

The helper exposes a local HTTP/SSE server:

- `GET http://127.0.0.1:8788/health`
- `GET http://127.0.0.1:8788/events`

## Build a distributable helper bundle

```powershell
npm run bundle:simread-helper
```

This creates `artifacts/simread-helper/` containing the compiled helper and runtime dependencies needed by the local service. Generated `dist/`, `artifacts/`, debug captures, practice screenshots, and `node_modules/` are intentionally excluded from Git.

See [`docs/simread-helper-bundle.md`](docs/simread-helper-bundle.md) for packaging details.

## Other development commands

```powershell
npm run dev
npm run simread:demo
npm run simread:live
npm run simread:windows
npm run simread:range-db
```

Some older development paths include screenshot/OCR extraction. They are not required for the current range-DB-only Looper workflow.

## License

ISC. See [`LICENSE`](LICENSE).
