$baseDir = Join-Path $PSScriptRoot "..\web"

$files = Get-ChildItem -Recurse (Join-Path $baseDir "components\pdf-ocr") -Filter "*.tsx"
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw -Encoding UTF8
    $content = $content -replace '@/app/page.module.css', '@/app/pdf-verify/page.module.css'
    $content = $content -replace '../app/page.module.css', '@/app/pdf-verify/page.module.css'
    Set-Content -Path $f.FullName -Value $content -Encoding UTF8
}
