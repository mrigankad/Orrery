# Publishes every Orrery package to npm. Run from a real terminal so npm can
# wait for security-key approval in the browser.
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host "`nOrrery publish  (npm user: $(npm whoami))`n" -ForegroundColor Cyan

# Pass package names to publish only those: .\scripts\publish.ps1 @orreryjs/vue @orreryjs/svelte
$packages = if ($args.Count) { $args } else { '@orreryjs/core', '@orreryjs/devtools', '@orreryjs/physics', '@orreryjs/ui', '@orreryjs/ecs', '@orreryjs/react', '@orreryjs/vue', '@orreryjs/svelte', '@orreryjs/create' }
$results = @()

foreach ($p in $packages) {
	Write-Host "`n=== $p ===" -ForegroundColor Yellow
	Write-Host 'When npm shows a link, press Enter and approve with your security key.' -ForegroundColor DarkGray
	npm publish -w $p --access public
	$ok = $LASTEXITCODE -eq 0
	$results += [pscustomobject]@{ Package = $p; Result = $(if ($ok) { 'published' } else { "failed (exit $LASTEXITCODE)" }) }
}

Write-Host "`nSummary" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$results | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'publish-result.json')
Write-Host 'You can close this window.' -ForegroundColor DarkGray
