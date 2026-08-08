# remove-ai-search.ps1
# Удаляет AI-поиск с сайта thebalihost:
#  - панель aiSearchPanel (с переключателем AI/Classic)
#  - ссылки и кнопки с data-ai-open
#  - скрипты, содержащие promptPhrases / data-ai-open / thbAskAI
#  - текст "Not sure which villa? Tell us what you need." (WhatsApp-кнопка остаётся)
#  - комментарий-секцию AI MATCHES
#  - скрытый блок AI SEARCH STRIP (property-rental)
#  - SEO-блоки <h3>AI Search</h3> + абзац в языковых версиях
# Обычный поиск (даты/гости) НЕ трогает.
# Запуск из корня проекта:  powershell -ExecutionPolicy Bypass -File .\remove-ai-search.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path (Join-Path $root 'index.html'))) {
    Write-Host "index.html не найден рядом со скриптом. Положи скрипт в D:\Projects\thebalihost" -ForegroundColor Red
    exit 1
}

$utf8 = New-Object System.Text.UTF8Encoding $false

# Закрыть балансный блок: от строки $start, считая открывающие/закрывающие теги $tag
function Find-BlockEnd {
    param([string[]]$lines, [int]$start, [string]$tag)
    $depth = 0
    for ($i = $start; $i -lt $lines.Count; $i++) {
        $depth += ([regex]::Matches($lines[$i], "<$tag\b")).Count
        $depth -= ([regex]::Matches($lines[$i], "</$tag>")).Count
        if ($depth -le 0 -and $i -ge $start) { return $i }
    }
    return -1
}

# Найти все диапазоны <script>...</script>
function Get-ScriptRanges {
    param([string[]]$lines)
    $ranges = @()
    $open = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($open -lt 0 -and $lines[$i] -match '<script\b') { $open = $i }
        if ($open -ge 0 -and $lines[$i] -match '</script>') {
            $ranges += ,@($open, $i)
            $open = -1
        }
    }
    return $ranges
}

$report = @()
$filesChanged = 0

$targets = Get-ChildItem -Recurse -File -Include *.html |
    Where-Object {
        $_.FullName -notmatch '\\(\.git|_to_delete|saved|imports|node_modules)\\' -and
        $_.Name -ne 'balivillas_checklist.html'
    }

foreach ($f in $targets) {
    $raw = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
    if ([string]::IsNullOrEmpty($raw)) { continue }
    $eol = if ($raw -match "`r`n") { "`r`n" } else { "`n" }
    $lines = $raw -split "`r?`n"
    $before = ($lines -join "`n")
    $changed = $true

    while ($changed) {
        $changed = $false
        $cut = $null   # @(start, end) включительно, 0-based

        for ($i = 0; $i -lt $lines.Count; $i++) {
            $L = $lines[$i]

            # 1) Панель aiSearchPanel — балансный div
            if ($L -match 'id="aiSearchPanel"') {
                $e = Find-BlockEnd $lines $i 'div'
                if ($e -ge $i) { $cut = @($i, $e); break }
            }
            # 2) Скрытая AI SEARCH STRIP (комментарий + div)
            if ($L -match 'AI SEARCH STRIP') {
                $s = $i
                # если следующий(е) строки — div-блок со strip, забрать балансно
                $j = $i
                while ($j + 1 -lt $lines.Count -and $lines[$j] -notmatch '<div\b') { $j++ ; if ($j - $i -gt 3) { break } }
                if ($lines[$j] -match '<div\b') {
                    $e = Find-BlockEnd $lines $j 'div'
                    if ($e -ge $j) { $cut = @($s, $e); break }
                }
                $cut = @($i, $i); break
            }
            # 3) Ссылка <a ... data-ai-open ...>...</a>
            if ($L -match '<a\b[^>]*data-ai-open') {
                $e = Find-BlockEnd $lines $i 'a'
                if ($e -ge $i) { $cut = @($i, $e); break }
            }
            # 4) Кнопка <button ... data-ai-open ...>...</button>
            if ($L -match '<button\b[^>]*data-ai-open') {
                $e = Find-BlockEnd $lines $i 'button'
                if ($e -ge $i) { $cut = @($i, $e); break }
            }
            # 5) Текст "Not sure which villa" — только абзац, WhatsApp не трогаем
            if ($L -match 'Not sure which villa') {
                $e = $i
                while ($e -lt $lines.Count -and $lines[$e] -notmatch '</p>') { $e++ }
                $cut = @($i, $e); break
            }
            # 6) Комментарий секции AI MATCHES
            if ($L -match '=+\s*AI MATCHES\s*=+') {
                $cut = @($i, $i); break
            }
            # 7) SEO-блок <h3>AI Search</h3> + следующий абзац
            if ($L -match '<h3[^>]*>\s*AI Search\s*</h3>') {
                $e = $i
                if ($e + 1 -lt $lines.Count -and $lines[$e + 1] -match '<p\b') {
                    $e = $e + 1
                    while ($e -lt $lines.Count -and $lines[$e] -notmatch '</p>') { $e++ }
                }
                $cut = @($i, $e); break
            }
        }

        # 8) Скрипты с promptPhrases / data-ai-open / thbAskAI / openVoice
        if (-not $cut) {
            foreach ($r in (Get-ScriptRanges $lines)) {
                $body = ($lines[$r[0]..$r[1]] -join "`n")
                if ($body -match 'promptPhrases|data-ai-open|thbAskAI|openVoice') {
                    $cut = @($r[0], $r[1]); break
                }
            }
        }

        if ($cut) {
            $keep = @()
            if ($cut[0] -gt 0) { $keep += $lines[0..($cut[0]-1)] }
            if ($cut[1] -lt $lines.Count - 1) { $keep += $lines[($cut[1]+1)..($lines.Count-1)] }
            $lines = $keep
            $changed = $true
        }
    }

    $after = ($lines -join "`n")
    if ($after -ne $before) {
        [IO.File]::WriteAllText($f.FullName, ($lines -join $eol) + $eol, $utf8)
        $filesChanged++
        $rel = $f.FullName -replace [regex]::Escape("$root\"), ''
        $report += $rel
    }
}

Write-Host ""
Write-Host "Файлов изменено: $filesChanged" -ForegroundColor Green
$report | ForEach-Object { Write-Host "  $_" }

# Остаточные упоминания — на ручную проверку (тексты, JSON-LD и т.п.)
Write-Host ""
Write-Host "Остаточные упоминания (проверить глазами):" -ForegroundColor Yellow
Get-ChildItem -Recurse -File -Include *.html |
    Where-Object {
        $_.FullName -notmatch '\\(\.git|_to_delete|saved|imports|node_modules)\\' -and
        $_.Name -ne 'balivillas_checklist.html'
    } |
    Select-String -Pattern 'aiSearchPanel|data-ai-open|promptPhrases|AI [Ss]earch|thbAskAI' |
    ForEach-Object {
        $rel = $_.Path -replace [regex]::Escape("$root\"), ''
        $s = $_.Line.Trim()
        if ($s.Length -gt 70) { $s = $s.Substring(0, 70) + '...' }
        Write-Host ("  {0} {1}: {2}" -f $rel, $_.LineNumber, $s)
    }
Write-Host ""
Write-Host "Готово. Дальше: docker rm -f thebalihost-site; docker build -t thebalihost .; docker run -d --name thebalihost-site -p 8082:80 thebalihost" -ForegroundColor Cyan
