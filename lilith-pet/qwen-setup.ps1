param(
  [Parameter(Mandatory=$true)][string]$ModelRoot,
  [ValidateSet('auto','gpu','cpu')][string]$Device='auto',
  [string]$RuntimePython=''
)
$ErrorActionPreference = 'Stop'
$runtime = Join-Path (Split-Path -Parent $ModelRoot) 'qwen-runtime'
$python = Join-Path $runtime 'Scripts/python.exe'
if ($RuntimePython) {
  $python = [IO.Path]::GetFullPath($RuntimePython)
  $runtime = Split-Path (Split-Path $python -Parent) -Parent
}
if (-not (Test-Path -LiteralPath $python)) {
  & py -3.12 -m venv $runtime
  if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.12 from python.org, then retry local Qwen setup.' }
}
$adapters = (Get-CimInstance Win32_VideoController).Name -join ' '
$readyMarker = Join-Path $runtime '.qwen-ready'
if (Test-Path -LiteralPath $readyMarker) { Remove-Item -LiteralPath $readyMarker }
if ($Device -ne 'cpu' -and $adapters -match 'NVIDIA') {
  & $python -m pip install --upgrade torch==2.9.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cu128 --disable-pip-version-check
} elseif ($Device -ne 'cpu' -and $adapters -match 'RX 9070') {
  # AMD's official Windows 7.2.1/Python3.12 wheels; requires a compatible Radeon driver.
  $amd = 'https://repo.radeon.com/rocm/windows/rocm-rel-7.2.1'
  & $python -m pip install "$amd/rocm_sdk_core-7.2.1-py3-none-win_amd64.whl" "$amd/rocm_sdk_devel-7.2.1-py3-none-win_amd64.whl" "$amd/rocm_sdk_libraries_custom-7.2.1-py3-none-win_amd64.whl" "$amd/rocm-7.2.1.tar.gz"
  if ($LASTEXITCODE -ne 0) { throw 'AMD ROCm runtime setup failed. Check the Radeon driver and official Windows prerequisites.' }
  & $python -m pip install --upgrade "$amd/torch-2.9.1%2Brocm7.2.1-cp312-cp312-win_amd64.whl" "$amd/torchaudio-2.9.1%2Brocm7.2.1-cp312-cp312-win_amd64.whl"
} elseif ($Device -eq 'gpu') {
  throw 'GPU setup supports NVIDIA and RX9070 on this Windows build. Choose CPU for other hardware.'
} else {
  & $python -m pip install --upgrade torch==2.15.0 torchaudio==2.11.1 --index-url https://download.pytorch.org/whl/cpu --disable-pip-version-check
}
if ($LASTEXITCODE -ne 0) { throw 'Qwen compute runtime installation failed.' }
& $python -m pip install qwen-tts==0.1.1 --no-deps --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { throw "Qwen package installation failed." }
& $python -m pip install faster-qwen3-tts==0.2.5 --no-deps --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { throw 'Qwen acceleration package installation failed.' }
& $python -m pip install transformers==4.57.3 accelerate==1.12.0 numpy soundfile librosa sox onnxruntime einops --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { throw 'Qwen speech dependencies failed to install.' }
& $python (Join-Path $PSScriptRoot 'qwen-download.py') $ModelRoot
if ($LASTEXITCODE -ne 0) { throw 'Qwen model download failed.' }
& $python -c 'from qwen_tts import Qwen3TTSModel'
if ($LASTEXITCODE -ne 0) { throw 'Qwen runtime import failed.' }
if ($Device -eq 'gpu') {
  & $python -c "import torch; assert torch.cuda.is_available(), 'GPU runtime installed but GPU is unavailable; check the graphics driver'"
  if ($LASTEXITCODE -ne 0) { throw 'GPU availability check failed.' }
}
Set-Content -LiteralPath (Join-Path $runtime '.qwen-ready') -Value 'qwen-tts=0.1.1'

