param([Parameter(Position=0)][string]$Command = 'plan', [Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest)
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
if ($Command -in @('ci','audit')) {
  $npm=Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npm) { & $npm.Source $Command @Rest }
  else {
    $npmCli=Join-Path $env:LOCALAPPDATA 'SHIBAL-tools/package/bin/npm-cli.js'
    if (!(Test-Path -LiteralPath $npmCli)) { throw 'Install Node.js 22.18+ with npm, then run npm ci --ignore-scripts.' }
    node $npmCli $Command @Rest
  }
} elseif ($Command -eq 'test') { node --test @Rest }
elseif ($Command -eq 'assets') { node src/serve-assets.mjs }
elseif ($Command -eq 'lab') { node src/web-server.mjs }
elseif ($Command -eq 'test:devnet-safety') { node src/simulate-safety.mjs }
else { node src/cli.mjs $Command @Rest }
exit $LASTEXITCODE
