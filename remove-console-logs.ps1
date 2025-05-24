# PowerShell script to remove console.log and console.warn statements from JS files
# while keeping console.error statements

# Set this to $true to test without making changes
$testMode = $false

# Get all JS files in the src directory
$jsFiles = Get-ChildItem -Path "src" -Recurse -Filter "*.js"
$totalFiles = $jsFiles.Count
$processedFiles = 0
$modifiedFiles = 0

Write-Host "Found $totalFiles JavaScript files to process"
Write-Host "Test mode: $testMode"
Write-Host ""

# Function to show what would be removed in test mode
function Show-RemovedLines($content, $pattern) {
    if ($testMode) {
        $matches = [regex]::Matches($content, $pattern)
        foreach ($match in $matches) {
            Write-Host "    Would remove: $($match.Value.Trim())" -ForegroundColor Yellow
        }
    }
}

foreach ($file in $jsFiles) {
    $processedFiles++
    Write-Host "[$processedFiles/$totalFiles] Processing file: $($file.FullName)"
    
    # Read the content of the file
    $content = Get-Content -Path $file.FullName -Raw
    
    # Original content for comparison
    $originalContent = $content
    
    # Simple check to see if we need to process this file
    if (-not ($content -match "console\.log" -or $content -match "console\.warn")) {
        Write-Host "  - No console.log/warn statements found" -ForegroundColor Gray
        continue
    }

    Write-Host "  - Found potential console.log/warn statements" -ForegroundColor Cyan
    
    # Patterns to match various console.log and console.warn statements
    $patterns = @(
        # Simple console.log with any content
        'console\.log\([^;]*\);'
        
        # Simple console.warn with any content
        'console\.warn\([^;]*\);'
        
        # Console logs with conditionals (if statements)
        'if\s*\([^)]*\)\s*console\.(log|warn)\([^;]*\);'
        
        # DEBUG_LOGGING conditionals
        'if\s*\([^)]*DEBUG_LOGGING[^)]*\)\s*{\s*console\.(log|warn)[^}]*}'
        'if\s*\([^)]*DEBUG_LOGGING[^)]*\)\s*console\.(log|warn)\([^;]*\);'
        
        # Template literals
        'console\.(log|warn)\(`[^`]*`\);'
        
        # Multi-line template literals
        '(?s)console\.(log|warn)\(`[\s\S]*?`\);'
        
        # Console logs with multiple arguments
        'console\.(log|warn)\([^,)]*,[^;)]*\);'
        
        # Console logs with very complex arguments
        '(?s)console\.(log|warn)\([\s\S]*?\);'
    )
    
    # Show what would be removed in test mode
    foreach ($pattern in $patterns) {
        Show-RemovedLines $content $pattern
    }
    
    # Apply replacements
    $newContent = $content
    foreach ($pattern in $patterns) {
        $newContent = $newContent -replace $pattern, ''
    }
    
    # Clean up any leftover empty lines (consecutive newlines)
    $newContent = $newContent -replace '(\r?\n){3,}', "`r`n`r`n"
    
    # Only write the file back if changes were made and not in test mode
    if ($originalContent -ne $newContent) {
        $modifiedFiles++
        if (-not $testMode) {
            Write-Host "  - Removed console.log/warn statements" -ForegroundColor Green
            Set-Content -Path $file.FullName -Value $newContent -NoNewline
        } else {
            Write-Host "  - Would remove console.log/warn statements (test mode)" -ForegroundColor Magenta
        }
    } else {
        Write-Host "  - No console.log/warn statements were matched by patterns" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Summary:"
Write-Host "--------"
Write-Host "Total files processed: $processedFiles"
Write-Host "Files that would be modified: $modifiedFiles"
Write-Host "Files unchanged: $($processedFiles - $modifiedFiles)"
Write-Host ""
if ($testMode) {
    Write-Host "Test mode was enabled - no changes were made to files."
} else {
    Write-Host "Done processing files. All console.log and console.warn statements have been removed."
} 