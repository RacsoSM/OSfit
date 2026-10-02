#!/usr/bin/env bash
# Uso: launch.sh <archivo-spec> "<titulo>"
# Crea la tarea, arranca un worker Codex y, si el prompt queda como borrador sin enviar
# (Orca pierde el Enter con pegados largos), lo envía. Imprime TASK, DISPATCH y HANDLE.
set -u
cd /c/Users/Usuario/Desktop/osfit/OSfit
SPEC_FILE="$1"; TITLE="$2"
OUT=$(orca orchestration worker-start --spec "$(cat "$SPEC_FILE")" --worktree current --agent codex --task-title "$TITLE" --json 2>&1)
TASK=$(echo "$OUT" | grep -m1 -oE '"taskId": "task_[0-9a-f]+"' | grep -oE 'task_[0-9a-f]+')
DISP=$(echo "$OUT" | grep -m1 -oE '"dispatchId": "ctx_[0-9a-f]+"' | grep -oE 'ctx_[0-9a-f]+')
HANDLE=$(echo "$OUT" | grep -m1 -oE 'term_[0-9a-f-]+')
echo "TASK=$TASK DISPATCH=$DISP HANDLE=$HANDLE"
[ -z "$HANDLE" ] && { echo "$OUT" | head -30; exit 1; }
# Esperar hasta 40 s a que aparezca el borrador y enviarlo; si ya hay transcript, no hacer nada.
for i in $(seq 1 20); do
  sleep 2
  N=$(orca orchestration worker-read --dispatch "$DISP" --limit 4 --json 2>&1 | grep -c '"source": "transcript"')
  if [ "$N" -gt 0 ]; then echo "STARTED(transcript) t=$((i*2))s"; exit 0; fi
  if orca terminal read --terminal "$HANDLE" --json 2>&1 | grep -q '"draft"'; then
    orca terminal send --terminal "$HANDLE" --enter --json >/dev/null 2>&1
    echo "DRAFT_SUBMITTED t=$((i*2))s"
    for j in $(seq 1 10); do
      sleep 3
      N=$(orca orchestration worker-read --dispatch "$DISP" --limit 4 --json 2>&1 | grep -c '"source": "transcript"')
      [ "$N" -gt 0 ] && { echo "STARTED(transcript)"; exit 0; }
    done
    echo "SUBMITTED_BUT_NO_TRANSCRIPT_YET"; exit 0
  fi
done
echo "NO_DRAFT_NO_TRANSCRIPT"; exit 2
