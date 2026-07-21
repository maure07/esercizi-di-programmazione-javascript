# Companion di segmentazione locale (per PC Windows)

Fa girare la segmentazione **sul tuo PC** (CPU per la forma, GPU per l'AI) e la
collega all'app "Correggi & Segmenta". Nessun dato esce dal computer.

## A cosa serve
- **Motore geometria** (base, senza GPU): divide per forma, gestisce anche i
  modelli grossi senza far impuntare l'app.
- **Motore AI** (SAM multi-vista, usa la RTX 3060): capisce le parti dalla forma
  in modo più intelligente, anche su STL **senza colore**.

## Installazione (una volta sola)

1. Installa **Python 3.11** da <https://www.python.org/downloads/>
   → durante l'installazione spunta **"Add Python to PATH"**.
2. Doppio clic su **`install_base.bat`** → installa le librerie di base.
   *(bastano ~1 minuto e ~100 MB)*
3. (Opzionale, per l'AI) Doppio clic su **`install_ai.bat`** → scarica PyTorch
   CUDA + il modello SAM *(~2-3 GB, ci mette un po')*.

## Uso
1. Doppio clic su **`avvia.bat`** e lascia la finestra nera aperta.
   - Deve scrivere: `Companion di segmentazione avviato su http://127.0.0.1:8760`
   - Se hai fatto anche l'AI: `Motore AI: DISPONIBILE (GPU)`
2. Apri l'app `stl-obj-fixer.html` nel browser, carica il modello e vai su
   **3·Segmenta** → pulsante **"🧠 Segmenta con AI (PC locale)"**.

## Se qualcosa non va
- Il pulsante dice "companion non raggiungibile" → controlla che `avvia.bat` sia
  aperto e non abbia dato errori.
- L'AI non parte → il server ripiega da solo sul motore geometria (nessun blocco).
  La prima volta la mettiamo a posto insieme.

## File
- `server.py` — il servizio locale (porta 8760)
- `segmenta_geometria.py` — motore per forma (base)
- `segmenta_ai.py` — motore AI (SAM multi-vista, GPU)
- `install_base.bat` / `install_ai.bat` / `avvia.bat`
