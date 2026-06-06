param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$root = Join-Path $env:USERPROFILE '.vscode\extensions'
$id = 'hugo.poke-idle-game'
$rel = "hugo.poke-idle-game-$Version"
$extDir = Join-Path $root $rel

$obsoletePath = Join-Path $root '.obsolete'
if (Test-Path $obsoletePath) {
    $obsolete = Get-Content $obsoletePath -Raw | ConvertFrom-Json
    if ($obsolete.PSObject.Properties[$rel]) {
        $obsolete.PSObject.Properties.Remove($rel)
    }
    $obsolete | ConvertTo-Json -Compress | Set-Content $obsoletePath -Encoding UTF8
}

$extensionsJsonPath = Join-Path $root 'extensions.json'
if (!(Test-Path $extensionsJsonPath)) {
    return
}

$loaded = Get-Content $extensionsJsonPath -Raw | ConvertFrom-Json

# Repair a previous malformed write where the original array was wrapped as
# { value: [...], Count: n }.
if ($loaded.Count -gt 0 -and $loaded[0].PSObject.Properties['value']) {
    $loaded = $loaded[0].value
}

$entries = New-Object System.Collections.ArrayList
foreach ($entry in @($loaded)) {
    if ($entry.identifier.id -ne $id) {
        [void]$entries.Add($entry)
    }
}

$fsPath = $extDir
$uriPath = '/' + ($extDir -replace '\\', '/')
$pokeEntry = [pscustomobject]@{
    identifier       = [pscustomobject]@{ id = $id }
    version          = $Version
    location         = [pscustomobject]@{
        '$mid' = 1
        fsPath = $fsPath
        path   = $uriPath
        scheme = 'file'
    }
    relativeLocation = $rel
}

[void]$entries.Add($pokeEntry)
@($entries.ToArray()) | ConvertTo-Json -Depth 10 | Set-Content $extensionsJsonPath -Encoding UTF8
