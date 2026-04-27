# === SEP DB Tunnel - instalar como servicio Windows via WinSW ===
# Requiere PowerShell COMO ADMINISTRADOR
# Uso: powershell -ExecutionPolicy Bypass -File "<path al script>\install-sep-tunnel.ps1"
#
# Que hace:
#   1. Descarga WinSW (wrapper de servicios Windows) desde GitHub
#   2. Genera C:\cloudflared\sep-tunnel.exe + .xml de config
#   3. Borra cualquier tarea programada vieja "SEP DB Tunnel" si existe
#   4. Instala el servicio Windows "SEPDBTunnel" con auto-arranque
#   5. Arranca el servicio y verifica que el puerto 1521 abra
#
# Despues de correrlo, el tunel sobrevive: reboots, fast startup,
# logout/login, hibernate. Cero intervencion manual.
#
# Para desinstalarlo en el futuro:
#   Stop-Service SEPDBTunnel
#   & C:\cloudflared\sep-tunnel.exe uninstall C:\cloudflared\sep-tunnel.xml

$ErrorActionPreference = 'Stop'
trap {
  Write-Host ""
  Write-Host "ERROR: $_" -ForegroundColor Red
  Write-Host "El script se detuvo. Copia este mensaje y pasalo a Josse."
  Write-Host ""
  Read-Host "Presiona Enter para cerrar"
  exit 1
}

Write-Host ""
Write-Host "=== SEP DB Tunnel - instalacion como servicio Windows ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "ERROR: este script necesita PowerShell COMO ADMINISTRADOR." -ForegroundColor Red
  Read-Host "Enter para cerrar"
  exit 1
}
Write-Host "[1/7] OK Sesion administrador"

# 2. Localizar cloudflared
$cloudflared = $null
$cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cmd) { $cloudflared = $cmd.Source }
if (-not $cloudflared) {
  $candidatos = @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe",
    "C:\Program Files\cloudflared\cloudflared.exe",
    "C:\Program Files (x86)\cloudflared\cloudflared.exe"
  )
  foreach ($p in $candidatos) { if (Test-Path $p) { $cloudflared = $p; break } }
}
if (-not $cloudflared) {
  Write-Host "ERROR: cloudflared no encontrado. Instalalo de https://github.com/cloudflare/cloudflared/releases" -ForegroundColor Red
  Read-Host "Enter para cerrar"
  exit 1
}
Write-Host "[2/7] OK cloudflared en: $cloudflared"

# 3. Bajar WinSW desde GitHub releases
$serviceDir = 'C:\cloudflared'
$serviceExe = "$serviceDir\sep-tunnel.exe"
$serviceXml = "$serviceDir\sep-tunnel.xml"
if (-not (Test-Path $serviceDir)) { New-Item -ItemType Directory -Path $serviceDir -Force | Out-Null }

if (-not (Test-Path $serviceExe)) {
  Write-Host "[3/7] Descargando WinSW desde GitHub..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
  $url = "https://github.com/winsw/winsw/releases/download/v3.0.0-alpha.11/WinSW-$arch.exe"
  Invoke-WebRequest -Uri $url -OutFile $serviceExe -UseBasicParsing
}
Write-Host "[3/7] OK WinSW en: $serviceExe"

# 4. Generar XML de config
$xmlContent = @"
<service>
  <id>SEPDBTunnel</id>
  <n>SEP DB Tunnel (cloudflared)</n>
  <description>Tunnel cloudflared TCP a sepdb.ggpcsena.com:1521 (Oracle)</description>
  <executable>$cloudflared</executable>
  <arguments>access tcp --hostname sepdb.ggpcsena.com --url localhost:1521</arguments>
  <log mode="roll-by-size">
    <sizeThreshold>1024</sizeThreshold>
    <keepFiles>3</keepFiles>
  </log>
  <onfailure action="restart" delay="5 sec"/>
  <startmode>Automatic</startmode>
</service>
"@
[System.IO.File]::WriteAllText($serviceXml, $xmlContent, [System.Text.Encoding]::UTF8)
Write-Host "[4/7] OK Configuracion XML escrita en: $serviceXml"

# 5. Limpiar lo viejo (tarea programada, procesos, servicio anterior)
# Envuelto en try/catch porque schtasks falla con codigo de error si la tarea no existe
try {
  cmd /c "schtasks /Delete /TN ""SEP DB Tunnel"" /F >nul 2>&1"
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  $svc = Get-Service SEPDBTunnel -ErrorAction SilentlyContinue
  if ($svc) {
    if ($svc.Status -eq 'Running') { & $serviceExe stop $serviceXml 2>&1 | Out-Null }
    & $serviceExe uninstall $serviceXml 2>&1 | Out-Null
    Start-Sleep 2
  }
} catch {
  # ignorar errores de limpieza - es normal en primera instalacion
}
Write-Host "[5/7] OK Limpieza previa terminada"

# 6. Instalar el servicio
& $serviceExe install $serviceXml 2>&1 | Out-Null
Write-Host "[6/7] OK Servicio SEPDBTunnel instalado"

# 7. Arrancar y verificar
Start-Service SEPDBTunnel
Write-Host "[7/7] Arrancando servicio, esperando 12s..."
Start-Sleep 12

$r = Test-NetConnection -ComputerName 127.0.0.1 -Port 1521 -WarningAction SilentlyContinue
Write-Host ""
if ($r.TcpTestSucceeded) {
  Write-Host "===========================================" -ForegroundColor Green
  Write-Host "  OK Tunel funcionando, puerto 1521 abierto" -ForegroundColor Green
  Write-Host "===========================================" -ForegroundColor Green
  Get-Service SEPDBTunnel | Format-List Name,Status,StartType
  Write-Host "El tunel arrancara solo en cada boot. Cero intervencion manual."
} else {
  Write-Host "===========================================" -ForegroundColor Yellow
  Write-Host "  WARN Servicio creado pero puerto 1521 aun no responde" -ForegroundColor Yellow
  Write-Host "===========================================" -ForegroundColor Yellow
  Write-Host "  Espera 15s y reintenta: Test-NetConnection 127.0.0.1 -Port 1521"
  Write-Host "  Logs:   Get-Content C:\cloudflared\sep-tunnel.out.log -Tail 30"
  Write-Host "  Estado: Get-Service SEPDBTunnel"
}

Write-Host ""
Read-Host "Presiona Enter para cerrar esta ventana"
