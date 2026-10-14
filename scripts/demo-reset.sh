#!/usr/bin/env bash
# npm run demo:reset            → deja ramas y tags como quedaron en el ensayo
# npm run demo:reset -- --save  → guarda el estado actual como "el del ensayo" (tags rehearsal/*)
#
# Ramas de la demo:
#   main                   tooling + PDP legacy
#   refactor/pdp-recorded  las 9 subtareas del ensayo, un commit cada una
#   refactor/pdp-trap      refactor/pdp-recorded + el cambio de d01 (HTML sin sanitizar)
#   refactor/pdp           la subtarea en vivo; se borra en cada reset
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [[ "${1:-}" == "--save" ]]; then
  git tag -f rehearsal/main main >/dev/null
  git tag -f rehearsal/pdp-recorded refactor/pdp-recorded >/dev/null
  git tag -f rehearsal/pdp-trap refactor/pdp-trap >/dev/null
  echo "Guardado: rehearsal/main=$(git rev-parse --short main) rehearsal/pdp-recorded=$(git rev-parse --short refactor/pdp-recorded) rehearsal/pdp-trap=$(git rev-parse --short refactor/pdp-trap)"
  exit 0
fi

for t in pdp-before rehearsal/main rehearsal/pdp-recorded rehearsal/pdp-trap; do
  git rev-parse -q --verify "refs/tags/$t" >/dev/null || { echo "Falta el tag $t. Corre primero: npm run demo:reset -- --save"; exit 1; }
done
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Hay cambios sin commit. Guárdalos o descártalos antes del reset (git status)."
  exit 1
fi

# Procesos de la demo que quedaron vivos (dev, compare, dashboard).
for port in 4000 5173 5174 4300 4310; do
  (command -v fuser >/dev/null && fuser -k "$port/tcp" >/dev/null 2>&1) || true
done

git switch -q main
if [[ "$(git rev-parse main)" != "$(git rev-parse rehearsal/main)" ]]; then
  echo "main se movió ($(git rev-parse --short main) → $(git rev-parse --short rehearsal/main)); la regreso al ensayo."
  git reset -q --hard rehearsal/main
fi
git branch -f refactor/pdp-recorded rehearsal/pdp-recorded
git branch -f refactor/pdp-trap rehearsal/pdp-trap
git branch -D refactor/pdp >/dev/null 2>&1 && echo "Borrada refactor/pdp (la del vivo)." || true

for wt in .jev/worktrees/*; do [[ -d "$wt" ]] && git worktree remove --force "$wt" 2>/dev/null || true; done
git worktree prune
rm -f .jev/plan.json

echo
echo "Listo. Estado del ensayo:"
git log --oneline -1 main
git log --oneline -1 refactor/pdp-recorded
git log --oneline -1 refactor/pdp-trap
echo
echo "Siguiente: JEV_MODE=${JEV_MODE:-replay} npm run dev   (ver docs/runbook.md, sección C)"
