[CmdletBinding()]
param(
  [int]$Port = 8080,
  [switch]$Install,
  [switch]$NoInstall,
  [switch]$NoOpen,
  [switch]$CheckOnly,
  [switch]$ValidateAssets
)

$ErrorActionPreference = 'Stop'
$MinimumNodeMajor = 18
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = (Resolve-Path (Join-Path $ScriptDir '..')).Path

if (-not $PSBoundParameters.ContainsKey('Port') -and $env:PORT) {
  $Port = [int]$env:PORT
}

function Get-NodeMajor {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCommand) {
    return $null
  }

  $major = & node -p "Number(process.versions.node.split('.')[0])"
  if ($LASTEXITCODE -ne 0) {
    return $null
  }

  return [int]$major
}

function Update-ProcessPath {
  $machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machinePath;$userPath"
}

function Install-Node {
  Write-Host 'Installing Node.js LTS. This may open a Windows package-manager prompt.'

  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements
  } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    choco install nodejs-lts -y
  } elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
    scoop install nodejs-lts
  } else {
    throw "Could not find winget, Chocolatey, or Scoop. Install Node.js $MinimumNodeMajor+ from https://nodejs.org/, then rerun this script."
  }

  Update-ProcessPath
}

function Ensure-Node {
  $major = Get-NodeMajor
  if ($major -and $major -ge $MinimumNodeMajor) {
    Write-Host "Node.js $(& node -v) found."
    return
  }

  if ($major) {
    Write-Host "Node.js $(& node -v) found, but Pieczargotchi expects Node.js $MinimumNodeMajor+."
  } else {
    Write-Host 'Node.js is not installed.'
  }

  if ($NoInstall) {
    throw "Run again with -Install, or install Node.js $MinimumNodeMajor+ manually."
  }

  if (-not $Install) {
    $answer = Read-Host 'Install Node.js with a Windows package manager now? [y/N]'
    if ($answer -notmatch '^(y|yes)$') {
      throw 'Install cancelled.'
    }
  }

  Install-Node
  $major = Get-NodeMajor

  if (-not $major -or $major -lt $MinimumNodeMajor) {
    throw "Node.js $MinimumNodeMajor+ is still not available after installation. Install Node.js LTS from https://nodejs.org/."
  }

  Write-Host "Node.js $(& node -v) ready."
}

function Test-RequiredFiles {
  $requiredFiles = @(
    'dev-server.mjs',
    'Index.html',
    'Styles.html',
    'Client.html',
    'ClientCore.html',
    'ClientBoot.html',
    'ClientDebug.html',
    'ClientRuntime.html',
    'ClientWeather.html',
    'ClientState.html',
    'ClientActions.html',
    'ClientUi.html',
    'ClientAnimation.html',
    'ClientScene.html',
    'ClientScenePalette.html',
    'ClientSceneCelestial.html',
    'ClientSceneWeather.html',
    'ClientSceneGround.html',
    'ClientSprites.html',
    'Config.gs',
    'AnimationConfig.gs',
    'StateModel.gs',
    'GameRules.gs',
    'Actions.gs',
    'AssetService.gs',
    'assets/stages/spore/idle_sheet.png',
    'assets/stages/spore/sleep_sheet.png',
    'assets/stages/spore/wake_sheet.png'
  )

  $missing = @()
  foreach ($relative in $requiredFiles) {
    $path = Join-Path $RootDir $relative
    if (-not (Test-Path -LiteralPath $path)) {
      $missing += $relative
    }
  }

  if ($missing.Count -gt 0) {
    $message = "Missing required local preview files:`n  - " + ($missing -join "`n  - ")
    throw "$message`nRestore them from the repository before running the local preview."
  }
}

function Invoke-AssetValidation {
  if (-not $ValidateAssets) {
    return
  }

  Write-Host 'Validating PNG assets...'
  Push-Location $RootDir
  try {
    & node scripts/validate-assets.mjs
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } finally {
    Pop-Location
  }
}

Ensure-Node
Test-RequiredFiles
Invoke-AssetValidation

$url = "http://127.0.0.1:$Port/"

if ($CheckOnly) {
  Write-Host "Local preview checks passed. Start URL: $url"
  exit 0
}

Write-Host "Starting Pieczargotchi local preview at $url"
Write-Host 'Press Ctrl+C to stop the server.'

if (-not $NoOpen) {
  Start-Job -ScriptBlock {
    param($PreviewUrl)
    Start-Sleep -Seconds 1
    Start-Process $PreviewUrl
  } -ArgumentList $url | Out-Null
}

Push-Location $RootDir
try {
  & node dev-server.mjs $Port
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
