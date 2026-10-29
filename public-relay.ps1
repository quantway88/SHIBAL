$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
node src/public-gifts.mjs relay
exit $LASTEXITCODE
