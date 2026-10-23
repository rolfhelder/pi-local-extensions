# Parses data only. Never invokes the supplied command.
$ErrorActionPreference = 'Stop'
$source = [Console]::In.ReadToEnd()
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$parseErrors)
$commands = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true) | ForEach-Object {
    [ordered]@{ name = $_.GetCommandName(); elements = @($_.CommandElements | ForEach-Object { $_.Extent.Text }); text = $_.Extent.Text }
})
$members = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.InvokeMemberExpressionAst] }, $true) | ForEach-Object { $_.Extent.Text })
[ordered]@{ errors = @($parseErrors | ForEach-Object { $_.Message }); commands = $commands; members = $members } | ConvertTo-Json -Depth 7 -Compress
