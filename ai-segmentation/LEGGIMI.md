# Companion di segmentazione locale (per PC Windows)

Fa girare la segmentazione **sul tuo PC** (CPU per la forma, GPU per l'AI) e la
collega all'app "Correggi & Segmenta". Nessun dato esce dal computer.

## A cosa serve
- **Motore geometria** (base, senza GPU): divide per forma, gestisce anche i
  modelli grossi senza far impuntare l'app.
- **Riparazione PRO** (motore di MeshLab, CPU): salda i micro-triangoli aperti,
  ripara i non-manifold, chiude i buchi e **toglie i gusci vuoti interni**
  tipici dei modelli generati dall'AI.
- **Booleane PRO** (manifold3d, CPU): tagli e booleane **esatte** come quelle
  di Blender/OpenSCAD, con **connettore quadrato automatico** (perno su un
  pezzo, foro con gioco sull'altro).
- **Motore AI** (SAM multi-vista, usa la RTX 3060): capisce le parti dalla forma
  in modo più intelligente, anche su STL **senza colore**.

## Installazione (una volta sola)

1. Installa **Python 3.11** da <https://www.python.org/downloads/>
   → durante l'installazione spunta **"Add Python to PATH"**.
2. Doppio clic su **`install_base.bat`** → installa le librerie di base.
   *(bastano ~1 minuto e ~100 MB)*
3. Doppio clic su **`install_pro.bat`** → riparazione professionale e booleane
   esatte *(~150 MB, non serve la scheda video)*. **Consigliatissimo.**
4. (Opzionale, per l'AI) Doppio clic su **`install_ai.bat`** → scarica PyTorch
   CUDA + il modello SAM *(~2-3 GB, ci mette un po')*.

## Uso
1. Doppio clic su **`avvia.bat`** e lascia la finestra nera aperta.
   Deve scrivere quali motori sono attivi, per esempio:
   ```
   Companion di segmentazione avviato su http://127.0.0.1:8760
   Riparazione PRO: DISPONIBILE (MeshLab)
   Booleane PRO:    DISPONIBILI (manifold3d)
   ```
2. Apri l'app `stl-obj-fixer.html` nel browser e carica il modello. Ora hai:
   - **2·Ripara** → **"🛠️ Riparazione PRO (PC locale)"**
     *(usalo sempre sui modelli AI: è quello che toglie i vuoti interni)*
   - **3·Segmenta** → **"🧠 Segmenta con AI (PC locale)"**
   - **3·Segmenta** → *Taglio dritto* → **"⚙️ Taglio PRO + connettore"**
     *(taglio esatto e liscio + perno quadrato e foro con gioco regolabile)*

## Flusso consigliato per un modello generato dall'AI
1. Carica il modello → **2·Ripara** → **Riparazione PRO**
   (deve dire *"Solido chiuso ed esatto"*)
2. **3·Segmenta** → segmenta come preferisci
3. Scegli *Taglio dritto*, posiziona il piano rosso e premi
   **Taglio PRO + connettore**: ottieni due pezzi già incastrabili
4. **4·Stampa** → esporta gli STL

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
