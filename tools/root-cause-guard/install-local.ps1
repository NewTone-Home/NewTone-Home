[CmdletBinding()]
param(
    [string]$Destination = (Join-Path $HOME '.codex\scripts\root-cause-guard.mjs')
)
$ErrorActionPreference = 'Stop'
$sourcePath = Join-Path $PSScriptRoot 'root-cause-guard.mjs'
$targetPath = [System.IO.Path]::GetFullPath($Destination)
$sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
Write-Output "Source SHA256: $sourceHash"
if (Test-Path -LiteralPath $targetPath) {
    if ((Get-Item -LiteralPath $targetPath).PSIsContainer) { throw 'Destination is a directory' }
    $previousHash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash
    Write-Output "Existing target SHA256: $previousHash"
    if ($previousHash -eq $sourceHash) {
        Write-Output 'ALREADY SYNCED: source == target; no files changed'
        return
    }
    $backupPath = "$targetPath.$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')).$([Guid]::NewGuid().ToString('N')).bak"
    Copy-Item -LiteralPath $targetPath -Destination $backupPath -ErrorAction Stop
    if ((Get-FileHash -LiteralPath $backupPath).Hash -ne $previousHash) { throw 'Backup verification failed' }
    Write-Output "Previous runtime preserved: $backupPath"
}
$targetDirectory = [System.IO.Path]::GetDirectoryName($targetPath)
if (-not (Test-Path -LiteralPath $targetDirectory)) {
    New-Item -ItemType Directory -Path $targetDirectory -ErrorAction Stop | Out-Null
}
Copy-Item -LiteralPath $sourcePath -Destination $targetPath -ErrorAction Stop
$targetHash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash
if ($targetHash -ne $sourceHash) { throw 'Installed runtime SHA256 does not match source' }
Write-Output "Target: $targetPath"
Write-Output "Target SHA256: $targetHash"
Write-Output 'INSTALL VERIFIED: source == target'
