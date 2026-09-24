# SessionStart hook: si existe el grafo de graphify, recuerda la regla de oro.
$root = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }
$graph = Join-Path $root 'graphify-out\graph.json'
if (Test-Path $graph) {
  $msg = "REGLA DE ORO: este proyecto tiene un grafo de graphify en $graph. Para investigar cualquier contexto del proyecto, consulta primero el grafo (graphify query / skill graphify) antes de usar Grep, Glob, Read o Explore."
  @{ hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $msg } } | ConvertTo-Json -Compress
}
