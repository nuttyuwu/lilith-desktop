# Lilith's window watcher: prints one JSON line whenever the visible top-level windows change
# (front-to-back z-order, physical-pixel frame bounds). Used so she can stand on window title bars.
# Also prints {"fg":...,"title":...} when the app in front changes (apps.js: what you're using).
#   powershell -File windows-watch.ps1 <lilith hwnd> <lilith pid>
param([long]$Self = 0, [int]$ParentPid = 0)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class LilithWindows {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int n);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int n);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor, rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);

  public static void Init() { SetProcessDpiAwarenessContext(new IntPtr(-4)); }

  public static string Snapshot(long self) {
    var sb = new StringBuilder("[");
    int n = 0;
    EnumWindows((h, l) => {
      if (h.ToInt64() == self || !IsWindowVisible(h) || IsIconic(h)) return true;
      int ex = GetWindowLong(h, -20);
      if ((ex & 0x80) != 0 || (ex & 0x08000000) != 0) return true;          // tool / no-activate windows
      int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
      var c = new StringBuilder(64); GetClassName(h, c, 64); string cls = c.ToString();
      if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd") return true;
      RECT r; if (DwmGetWindowAttribute(h, 9, out r, 16) != 0) return true;   // extended frame bounds
      if (r.R - r.L < 200 || r.B - r.T < 120) return true;
      if (n++ > 0) sb.Append(',');
      sb.Append("{\"id\":").Append(h.ToInt64()).Append(",\"x\":").Append(r.L).Append(",\"y\":").Append(r.T)
        .Append(",\"w\":").Append(r.R - r.L).Append(",\"h\":").Append(r.B - r.T)
        .Append(",\"max\":").Append(IsZoomed(h) ? "true" : "false").Append('}');
      return true;
    }, IntPtr.Zero);
    return sb.Append(']').ToString();
  }

  // JSON string body, ASCII only (\uXXXX): the console's code page would turn CJK titles into '?'
  static string Esc(string s) {
    var b = new StringBuilder();
    foreach (char ch in s) {
      if (ch == '"' || ch == '\\') b.Append('\\').Append(ch);
      else if (ch < ' ' || ch > '~') b.Append("\\u").Append(((int)ch).ToString("x4"));
      else b.Append(ch);
    }
    return b.ToString();
  }
  // Fullscreen: the window covers its whole monitor (a game, a film, F11). A maximized window hangs ~8 px past the
  // screen on each side and stops at the taskbar, so it never matches exactly; the desktop itself doesn't count.
  static bool Full(IntPtr h) {
    var c = new StringBuilder(64); GetClassName(h, c, 64); string cls = c.ToString();
    if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd") return false;
    RECT r; if (!GetWindowRect(h, out r)) return false;
    var mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
    if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
    var m = mi.rcMonitor;
    return Math.Abs(r.L - m.L) <= 1 && Math.Abs(r.T - m.T) <= 1 && Math.Abs(r.R - m.R) <= 1 && Math.Abs(r.B - m.B) <= 1;
  }
  // The app you're using: {"fg":"<process name>","title":"<window title>","full":<fullscreen>}; "" for none / her own window
  public static string Foreground(long self) {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero || h.ToInt64() == self) return "";
    uint pid; GetWindowThreadProcessId(h, out pid);
    string exe = "";
    try { using (var p = System.Diagnostics.Process.GetProcessById((int)pid)) exe = p.ProcessName; } catch { }
    var t = new StringBuilder(256); GetWindowText(h, t, 256);
    return "{\"fg\":\"" + Esc(exe) + "\",\"title\":\"" + Esc(t.ToString()) + "\",\"full\":" + (Full(h) ? "true" : "false") + "}";
  }
}
"@

[LilithWindows]::Init()
$last = ''; $lastFg = ''; $tick = 0
while ($true) {
  $snap = [LilithWindows]::Snapshot($Self)
  if ($snap -ne $last) { [Console]::Out.WriteLine($snap); [Console]::Out.Flush(); $last = $snap }
  $tick++
  if ($tick % 7 -eq 0) {   # about once a second: the app in front (app awareness)
    $fg = [LilithWindows]::Foreground($Self)
    if ($fg -and $fg -ne $lastFg) { [Console]::Out.WriteLine($fg); [Console]::Out.Flush(); $lastFg = $fg }
  }
  if ($ParentPid -and ($tick % 20 -eq 0) -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 150
}
