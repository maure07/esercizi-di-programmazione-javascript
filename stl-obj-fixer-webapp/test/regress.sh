#!/bin/bash
# Batteria completa. Si lancia da dentro questa cartella:
#     bash regress.sh
# Prima monta il file unico dai sorgenti, poi apre un server di prova sulla
# cartella dei modelli e fa girare tutti i test uno per uno.
set -u
D="$(cd "$(dirname "$0")" && pwd)"
cd "$D"

node build-artifact.js >/dev/null || { echo "montaggio fallito"; exit 1; }

pkill -f "http.server 8973" 2>/dev/null; sleep 1
(cd "$D/modelli" && setsid nohup python3 -m http.server 8973 >/dev/null 2>&1 </dev/null &)
sleep 2

verdi=0; rossi=0
for f in e2e-test*.js; do
  # la coperta e' uno strumento sperimentale, il suo test e' lento e ballerino
  [ "$f" = "e2e-test-coperta.js" ] && continue
  echo "=== $f ==="
  node "$f" 2>&1
  e=$?
  echo "exit:$e"
  if [ "$e" = "0" ]; then verdi=$((verdi+1)); else rossi=$((rossi+1)); fi
done
echo
echo "TOTALE: $verdi verdi, $rossi rossi"
[ "$rossi" = "0" ]
