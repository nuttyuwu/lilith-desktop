param(
  [Parameter(Mandatory=$true)][string]$InstalledVersion,
  [Parameter(Mandatory=$true)][string]$InstallFolder,
  [ValidateSet('currentuser','allusers')][string]$Scope='currentuser'
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net.Http
[System.Windows.Forms.Application]::EnableVisualStyles()
$form=New-Object System.Windows.Forms.Form
$form.Text='Lilith Update'
$form.Size=New-Object System.Drawing.Size(510,220)
$form.StartPosition='CenterScreen'
$form.FormBorderStyle='FixedDialog'
$form.MaximizeBox=$false
$label=New-Object System.Windows.Forms.Label
$label.Location=New-Object System.Drawing.Point(20,20)
$label.Size=New-Object System.Drawing.Size(450,110)
$label.Text='Checking GitHub for the latest Lilith release...'
$form.Controls.Add($label)
$label.Add_TextChanged({Write-Host $label.Text})
$close=New-Object System.Windows.Forms.Button
$close.Text='Close'
$close.Location=New-Object System.Drawing.Point(380,140)
$close.Add_Click({$form.Close()})
$form.Controls.Add($close)
$form.Show()
$client=New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.UserAgent.ParseAdd('Lilith-Setup-Updater/1.0')
$client.Timeout=[TimeSpan]::FromMinutes(15)
$work=Join-Path ([IO.Path]::GetTempPath()) ('Lilith-update-'+[Guid]::NewGuid().ToString('N'))
$download=$null
$script:installing=$false
$form.Add_FormClosing({param($sender,$eventArgs) if($script:installing){$eventArgs.Cancel=$true}})

function Wait-Http($task) {
  $deadline=[DateTime]::UtcNow.AddMinutes(2)
  while(-not $task.IsCompleted) {
    [System.Windows.Forms.Application]::DoEvents()
    if($form.IsDisposed) { $client.CancelPendingRequests(); throw 'Update cancelled.' }
    if([DateTime]::UtcNow -gt $deadline) { $client.CancelPendingRequests(); throw 'The connection timed out. Please retry.' }
    Start-Sleep -Milliseconds 50
  }
  return $task.GetAwaiter().GetResult()
}
function Get-ReleaseText([string]$url) {
  $response=Wait-Http ($client.GetAsync($url))
  try {
    $response.EnsureSuccessStatusCode() | Out-Null
    $text=Wait-Http ($response.Content.ReadAsStringAsync())
    if($text.Length -gt 1048576) {throw 'Unexpected release metadata size.'}
    return $text
  } finally {$response.Dispose()}
}
function Assert-Asset($asset,[string]$tag) {
  $expected='https://github.com/nuttyuwu/lilith-desktop/releases/download/'+$tag+'/'+$asset.name
  if($asset.browser_download_url -cne $expected -or $asset.state -ne 'uploaded') {throw 'Unexpected release download location.'}
}
try {
  if($InstalledVersion -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') {throw 'Installed version is unknown. Download the latest setup manually.'}
  if(-not [IO.Path]::IsPathRooted($InstallFolder) -or -not (Test-Path -LiteralPath (Join-Path $InstallFolder 'Lilith.exe'))) {throw 'The installed Lilith.exe was not found. Reinstall using setup.'}
  $release=(Get-ReleaseText 'https://api.github.com/repos/nuttyuwu/lilith-desktop/releases/latest') | ConvertFrom-Json
  if($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v(\d+\.\d+\.\d+)$') {throw 'No supported stable release was returned.'}
  $latest=$Matches[1]
  $current=[version]($InstalledVersion -split '-')[0]
  $newer=([version]$latest -gt $current) -or ([version]$latest -eq $current -and $InstalledVersion.Contains('-'))
  if(-not $newer) {
    $label.Text="You're up to date. Installed: $InstalledVersion. Latest stable: $latest."
  } else {
    $asset=@($release.assets | Where-Object name -eq "Lilith.Setup.$latest.exe")
    $sums=@($release.assets | Where-Object name -eq 'SHA256SUMS.txt')
    if($asset.Count -ne 1 -or $sums.Count -ne 1) {throw 'This release does not include a unique setup installer and checksum file.'}
    $asset=$asset[0];$sums=$sums[0]
    Assert-Asset $asset $release.tag_name
    Assert-Asset $sums $release.tag_name
    if($asset.size -le 0 -or $asset.size -gt 536870912 -or $sums.size -gt 32768) {throw 'Unexpected release asset size.'}
    $checksumText=Get-ReleaseText $sums.browser_download_url
    $pattern='(?m)^([a-fA-F0-9]{64})  '+[regex]::Escape($asset.name)+'\r?$'
    $hashMatch=[regex]::Matches($checksumText,$pattern)
    if($hashMatch.Count -ne 1) {throw 'The setup checksum is missing or ambiguous.'}
    $expectedHash=$hashMatch[0].Groups[1].Value
    $label.Text="Version $latest is available (installed: $InstalledVersion). Downloading verified setup... You can close this window to cancel."
    New-Item -ItemType Directory -Path $work | Out-Null
    $download=Join-Path $work $asset.name
    $response=Wait-Http ($client.GetAsync($asset.browser_download_url,[System.Net.Http.HttpCompletionOption]::ResponseHeadersRead))
    try {
      $response.EnsureSuccessStatusCode() | Out-Null
      $inputStream=Wait-Http ($response.Content.ReadAsStreamAsync())
      $outputStream=[IO.File]::Create($download)
      try {
        $buffer=New-Object byte[] 65536
        [long]$received=0
        while(($count=Wait-Http ($inputStream.ReadAsync($buffer,0,$buffer.Length))) -gt 0) {
          $received+=$count
          if($received -gt $asset.size) {throw 'Download exceeded its declared size.'}
          $outputStream.Write($buffer,0,$count)
          $label.Text="Downloading Lilith $latest... $([int](100*$received/$asset.size))%"
        }
      } finally { $outputStream.Dispose();$inputStream.Dispose() }
    } finally {$response.Dispose()}
    if((Get-Item -LiteralPath $download).Length -ne $asset.size -or (Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ine $expectedHash) {throw 'Download verification failed. Nothing was installed.'}
    $answer=[System.Windows.Forms.MessageBox]::Show($form,"Install Lilith $latest now? Lilith will close during the update. Your settings and game assets will be kept.",'Lilith Update',[System.Windows.Forms.MessageBoxButtons]::YesNo)
    if($answer -eq [System.Windows.Forms.DialogResult]::Yes) {
      $close.Enabled=$false
      $script:installing=$true
      $label.Text="Installing Lilith $latest. Please wait..."
      # NSIS /D must be last and deliberately unquoted, including paths with spaces.
      $process=Start-Process -FilePath $download -ArgumentList "/S --updated /$Scope /D=$InstallFolder" -PassThru
      while(-not $process.HasExited) { [System.Windows.Forms.Application]::DoEvents();Start-Sleep -Milliseconds 100;$process.Refresh() }
      if($process.ExitCode -notin @(0,3010)) {throw "Setup exited with code $($process.ExitCode). Your previous installation may still be present; run setup to repair it."}
      $installedPackage=Get-Content -LiteralPath (Join-Path $InstallFolder 'resources\app\package.json') -Raw | ConvertFrom-Json
      if($installedPackage.version -ne $latest) {throw 'Setup did not install the expected version. It may have been cancelled; your previous installation was kept.'}
      $label.Text="Lilith was updated to $latest. You can close this window."
      Start-Process -FilePath (Join-Path $InstallFolder 'Lilith.exe') -WindowStyle Hidden
      $close.Enabled=$true
    } else { $label.Text='Update cancelled. Your installation was not changed.' }
  }
} catch {
  if(-not $form.IsDisposed) {$label.Text="Could not update: $($_.Exception.Message)`r`nYou can retry setup or download it from github.com/nuttyuwu/lilith-desktop/releases.";$close.Enabled=$true}
} finally {
  $script:installing=$false
  $client.Dispose()
  # Only remove this invocation's two explicitly known temporary files; never recurse.
  if($download -and (Test-Path -LiteralPath $download)) {Remove-Item -LiteralPath $download -Force -ErrorAction SilentlyContinue}
  if(Test-Path -LiteralPath $work) {try {[IO.Directory]::Delete($work)} catch {}}
}
while(-not $form.IsDisposed) {[System.Windows.Forms.Application]::DoEvents();Start-Sleep -Milliseconds 100}
