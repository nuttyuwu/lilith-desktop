# Spotify over Windows' media session (SMTC): now playing + transport controls. No login needed.
# Usage: spotify.ps1 [info|toggle|next|prev]  -> one JSON line, {} when Spotify has no media session.
#        spotify.ps1 watch <parent pid>       -> a JSON line every time Spotify's track or play state changes.
# Only Spotify's own media session counts: other apps playing sound never show up here.
param([string]$Action = 'info', [int]$ParentPid = 0)
[Console]::OutputEncoding = [Text.Encoding]::UTF8   # song titles in any script reach Node intact
$ErrorActionPreference = 'Stop'
trap { '{}'; exit 0 }   # any WinRT failure -> 'no session' instead of a hang or junk output

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

# WinRT async -> wait for the result (PowerShell 5.1 has no await)
function Await($op, [type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

if ($Action -eq 'watch') {
  $last = $null; $tick = 0
  while ($true) {
    $out = '{}'
    try {
      $s = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -like '*Spotify*' } | Select-Object -First 1
      if ($s) {
        $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $out = [pscustomobject]@{ title = $p.Title; artist = $p.Artist; playing = ($s.GetPlaybackInfo().PlaybackStatus -eq 'Playing') } | ConvertTo-Json -Compress
      }
    } catch { $out = '{}' }
    if ($out -ne $last) { [Console]::Out.WriteLine($out); [Console]::Out.Flush(); $last = $out }
    $tick++
    if ($ParentPid -and ($tick % 20 -eq 0) -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 1500
  }
  exit 0
}
$session = $manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -like '*Spotify*' } | Select-Object -First 1
if (-not $session) { '{}'; exit 0 }

switch ($Action) {
  'toggle' { [void](Await ($session.TryTogglePlayPauseAsync()) ([bool])) }
  'next'   { [void](Await ($session.TrySkipNextAsync()) ([bool])) }
  'prev'   { [void](Await ($session.TrySkipPreviousAsync()) ([bool])) }
}
if ($Action -in 'next', 'prev') { Start-Sleep -Milliseconds 600 }   # Spotify updates its media info a moment after skipping

$props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$status = $session.GetPlaybackInfo().PlaybackStatus
[pscustomobject]@{ title = $props.Title; artist = $props.Artist; playing = ($status -eq 'Playing') } | ConvertTo-Json -Compress
