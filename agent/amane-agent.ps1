<#
  Agent Amane GRC pour Windows — vérifie la configuration de sécurité du poste et l'envoie à Amane.
  Aucun droit administrateur n'est nécessaire. Aucune donnée personnelle n'est collectée en dehors
  du nom du poste, du numéro de série, de la version de Windows et de l'e-mail de l'utilisateur.

  Utilisation :
    powershell -ExecutionPolicy Bypass -File amane-agent.ps1            # une vérification
    powershell -ExecutionPolicy Bypass -File amane-agent.ps1 -Install   # vérification + planification toutes les 4 heures
    powershell -ExecutionPolicy Bypass -File amane-agent.ps1 -Uninstall
#>
param([switch]$Install, [switch]$Uninstall, [string]$Email = "__EMAIL__")
$ErrorActionPreference = "Stop"
$Server = "__SERVER__"
$Token = "__TOKEN__"
$Version = "1.0.0"
$TaskName = "Amane Agent"
$Sys = Join-Path $env:SystemRoot "System32" # full paths: other tools named whoami/net may come first in PATH
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$Home_ = Join-Path $env:LOCALAPPDATA "Amane"

function Result($status, $info) { [ordered]@{ status = $status; info = $info } }
function Try-Check([scriptblock]$check) { try { & $check } catch { Result "inconnu" $_.Exception.Message } }

if ($Uninstall) {
  & "$Sys\schtasks.exe" /Delete /TN $TaskName /F 2>$null | Out-Null
  Remove-Item $Home_ -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Agent Amane désinstallé."; exit 0
}

$results = [ordered]@{}

# Chiffrement du disque système (lisible sans droits administrateur via le shell)
$results["T-DISK"] = Try-Check {
  $v = (New-Object -ComObject Shell.Application).NameSpace("$env:SystemDrive\").Self.ExtendedProperty("System.Volume.BitLockerProtection")
  switch ($v) { { $_ -in 1, 3, 5 } { Result "ok" "BitLocker actif sur $env:SystemDrive" } 2 { Result "echec" "BitLocker désactivé sur $env:SystemDrive" } default { Result "inconnu" "état BitLocker non disponible" } }
}

# Antivirus : Centre de sécurité Windows (tout éditeur), sinon Microsoft Defender
$results["T-AV"] = Try-Check {
  $avs = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue)
  $good = $avs | Where-Object { (($_.productState -shr 12) -band 0xF) -in 1, 3 -and (($_.productState -shr 4) -band 0xF) -eq 0 }
  if ($good) { return Result "ok" (($good | ForEach-Object displayName) -join ", ") }
  $d = Get-MpComputerStatus
  if ($d.RealTimeProtectionEnabled -and $d.AntivirusSignatureAge -le 7) { Result "ok" "Microsoft Defender actif, signatures de $($d.AntivirusSignatureAge) jour(s)" }
  else { Result "echec" "Protection temps réel : $($d.RealTimeProtectionEnabled), signatures de $($d.AntivirusSignatureAge) jour(s)" }
}

# Pare-feu sur les trois profils
$results["T-FW"] = Try-Check {
  $off = @(Get-NetFirewallProfile | Where-Object { -not $_.Enabled } | ForEach-Object Name)
  if ($off.Count) { Result "echec" "Profils désactivés : $($off -join ', ')" } else { Result "ok" "Domaine, privé et public actifs" }
}

# Dernière mise à jour installée
$results["T-UPD"] = Try-Check {
  $last = Get-HotFix | Where-Object InstalledOn | Sort-Object InstalledOn -Descending | Select-Object -First 1
  if (-not $last) { return Result "inconnu" "historique des mises à jour indisponible" }
  $days = [int]((Get-Date) - $last.InstalledOn).TotalDays
  if ($days -le 30) { Result "ok" "$($last.HotFixID) installée il y a $days jour(s)" } else { Result "echec" "Dernière mise à jour il y a $days jours ($($last.HotFixID))" }
}

# Verrouillage automatique : stratégie, économiseur sécurisé, ou mise en veille de l'écran
$results["T-LOCK"] = Try-Check {
  $policy = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -ErrorAction SilentlyContinue).InactivityTimeoutSecs
  if ($policy -and $policy -le 900) { return Result "ok" "Stratégie : verrouillage après $policy s" }
  $desk = Get-ItemProperty "HKCU:\Control Panel\Desktop" -ErrorAction SilentlyContinue
  if ($desk.ScreenSaveActive -eq "1" -and $desk.ScreenSaverIsSecure -eq "1" -and [int]$desk.ScreenSaveTimeOut -le 900) { return Result "ok" "Économiseur sécurisé après $($desk.ScreenSaveTimeOut) s" }
  $q = & "$Sys\powercfg.exe" /query SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 2>$null
  $hex = ($q | Select-String "0x[0-9a-fA-F]{8}" -AllMatches | ForEach-Object { $_.Matches } | Select-Object -Last 2 | ForEach-Object Value)
  $secs = @($hex | ForEach-Object { [Convert]::ToInt32($_, 16) })
  $max = ($secs | Measure-Object -Maximum).Maximum
  if ($secs.Count -and $max -gt 0 -and $max -le 900) { Result "ok" "Écran éteint et verrouillé après $([int]($max/60)) min" }
  elseif ($secs.Count) { Result "echec" "Délai avant verrouillage : $(if ($max -eq 0) { 'jamais' } else { "$([int]($max/60)) min" })" }
  else { Result "inconnu" "délai de verrouillage non déterminé" }
}

# Version de Windows encore prise en charge
$cv = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion"
$build = [int]$cv.CurrentBuildNumber
$edition = [string]$cv.EditionID
$osName = if ($build -ge 22000) { "Windows 11" } else { "Windows 10" }
$results["T-OS"] = Try-Check {
  $enterprise = $edition -match "Enterprise|Education"
  if ($build -ge 26200) { Result "ok" "$osName $($cv.DisplayVersion) (build $build)" }
  elseif ($build -ge 26100 -and $enterprise) { Result "ok" "$osName 24H2 $edition (build $build)" }
  else { Result "echec" "$osName $($cv.DisplayVersion) (build $build) n'est plus pris en charge pour l'édition $edition" }
}

# Utilisateur membre du groupe Administrateurs (SID S-1-5-32-544), même filtré par l'UAC
$results["T-ADMIN"] = Try-Check {
  if ((& "$Sys\whoami.exe" /groups) -match "S-1-5-32-544") { Result "echec" "$env:USERNAME est administrateur local" } else { Result "ok" "$env:USERNAME est utilisateur standard" }
}

# Longueur minimale des mots de passe (ou poste géré par un annuaire)
$results["T-PWD"] = Try-Check {
  $joined = (& "$Sys\dsregcmd.exe" /status) -match "(AzureAdJoined|DomainJoined)\s*:\s*YES"
  $line = (& "$Sys\net.exe" accounts) | Where-Object { $_ -match "Minimum password length|Longueur minimale" } | Select-Object -First 1
  $len = if ($line -match "(\d+)\s*$") { [int]$Matches[1] } else { $null }
  if ($len -ge 12) { Result "ok" "Longueur minimale : $len" }
  elseif ($joined) { Result "ok" "Poste géré par un annuaire (Entra ID / Active Directory)" }
  elseif ($null -ne $len) { Result "echec" "Longueur minimale locale : $len (12 attendus)" }
  else { Result "inconnu" "stratégie de mot de passe illisible" }
}

$report = [ordered]@{
  device_key    = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Cryptography").MachineGuid
  hostname      = $env:COMPUTERNAME
  serial        = (Get-CimInstance Win32_BIOS).SerialNumber
  user_email    = $Email
  os            = $osName
  os_version    = "$($cv.DisplayVersion) (build $build)"
  agent_version = $Version
  results       = $results
}
$json = $report | ConvertTo-Json -Depth 5 -Compress
Invoke-RestMethod -Uri "$Server/api/agent/report" -Method Post -Headers @{ "x-amane-token" = $Token } `
  -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($json)) | Out-Null

Write-Host "Rapport envoyé à Amane ($Server) :" -ForegroundColor Cyan
foreach ($k in $results.Keys) {
  $r = $results[$k]
  $color = @{ ok = "Green"; echec = "Red"; inconnu = "Yellow" }[$r.status]
  Write-Host ("  {0,-8} {1,-7} {2}" -f $k, $r.status, $r.info) -ForegroundColor $color
}

if ($Install) {
  New-Item -ItemType Directory -Force $Home_ | Out-Null
  $target = Join-Path $Home_ "amane-agent.ps1"
  if ($PSCommandPath -ne $target) { Copy-Item $PSCommandPath $target -Force }
  $cmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$target`""
  & "$Sys\schtasks.exe" /Create /TN $TaskName /TR $cmd /SC HOURLY /MO 4 /F | Out-Null
  Write-Host "Agent installé : vérification automatique toutes les 4 heures (tâche « $TaskName »)." -ForegroundColor Cyan
}
