param([int]$Port = 5177)

# Static server cho app Kingsmen Seeding — phục vụ chính thư mục chứa file này.
$root = $PSScriptRoot
$url  = "http://localhost:$Port/seeding-app.html"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "Khong mo duoc port $Port (co the app dang chay san)." -ForegroundColor Yellow
  Write-Host "Mo trinh duyet toi: $url"
  Start-Process $url
  Read-Host "Nhan Enter de dong"
  exit
}

Write-Host ""
Write-Host "==============================================="
Write-Host "  KINGSMEN SEEDING dang chay tai:"
Write-Host "  $url" -ForegroundColor Green
Write-Host "==============================================="
Write-Host "  Giu cua so nay mo. Dong cua so = tat server."
Write-Host ""

# Tu mo trinh duyet
Start-Process $url

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($rel)) { $rel = "seeding-app.html" }
    # chan truy cap ra ngoai thu muc
    $path = Join-Path $root $rel
    $full = [System.IO.Path]::GetFullPath($path)
    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root))) { $ctx.Response.StatusCode = 403; $ctx.Response.Close(); continue }
    if (Test-Path $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ctype = switch ($ext) {
        ".html" { "text/html; charset=utf-8" }
        ".js"   { "application/javascript; charset=utf-8" }
        ".css"  { "text/css; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        ".png"  { "image/png" }
        ".jpg"  { "image/jpeg" }
        ".svg"  { "image/svg+xml" }
        default { "application/octet-stream" }
      }
      $ctx.Response.ContentType = $ctype
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch { }
}
