$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $repoRoot "dist"
$artifactDir = Join-Path $repoRoot "artifacts\simread-helper"
$artifactNodeModules = Join-Path $artifactDir "node_modules"

Set-Location $repoRoot

npm run build:simread-helper

if (Test-Path $artifactDir) {
  Remove-Item -LiteralPath $artifactDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
New-Item -ItemType Directory -Force -Path $artifactNodeModules | Out-Null

Copy-Item -LiteralPath $distDir -Destination (Join-Path $artifactDir "dist") -Recurse

$runtimeModules = @("sql.js", "pngjs")
foreach ($moduleName in $runtimeModules) {
  $source = Join-Path $repoRoot "node_modules\$moduleName"
  if (-not (Test-Path $source)) {
    throw "Missing runtime module '$moduleName'. Run npm install before bundling."
  }

  Copy-Item -LiteralPath $source -Destination (Join-Path $artifactNodeModules $moduleName) -Recurse
}

$packageJson = @'
{
  "name": "simread-helper",
  "version": "1.0.0-beta",
  "private": true,
  "type": "commonjs",
  "main": "dist/simread/cli.js",
  "bin": {
    "simread": "dist/simread/cli.js"
  },
  "scripts": {
    "serve": "node dist/simread/cli.js serve",
    "live": "node dist/simread/cli.js live"
  },
  "dependencies": {
    "pngjs": "^7.0.0",
    "sql.js": "^1.14.1"
  }
}
'@

Set-Content -LiteralPath (Join-Path $artifactDir "package.json") -Value $packageJson -Encoding UTF8

$cmdShim = @'
@echo off
setlocal
node "%~dp0dist\simread\cli.js" %*
'@

Set-Content -LiteralPath (Join-Path $artifactDir "simread.cmd") -Value $cmdShim -Encoding ASCII

Write-Host "[simread-helper] artifact created at $artifactDir"
Write-Host "[simread-helper] run with: $artifactDir\simread.cmd serve"
