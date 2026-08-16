$ErrorActionPreference = 'Stop'

$Repo = 'https://github.com/badrpk/vps.git'
$Dest = if ($env:VPS_HOME) { $env:VPS_HOME } else { Join-Path $env:LOCALAPPDATA 'VPS' }
$Build = Join-Path $Dest 'build'

foreach ($cmd in @('git','cmake')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $cmd"
    }
}

if (Test-Path (Join-Path $Dest '.git')) {
    git -C $Dest fetch origin --tags --prune
    $dirty = git -C $Dest status --porcelain
    if ($dirty) { throw "Refusing update: $Dest has local changes" }
    git -C $Dest checkout main
    git -C $Dest pull --ff-only origin main
} else {
    if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
    git clone --branch main $Repo $Dest
}

cmake -S $Dest -B $Build -DCMAKE_BUILD_TYPE=Release
cmake --build $Build --config Release --parallel

Write-Host "VPS installed at $Dest"
Write-Host "Build output: $Build"
