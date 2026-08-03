@echo off
setlocal enabledelayedexpansion
REM ================================================================
REM  Installazione del MOTORE AI (SAM multi-vista, usa la GPU).
REM  Pesante: scarica PyTorch CUDA e il modello SAM (~2-3 GB totali).
REM  Esegui PRIMA install_base.bat.
REM
REM  NOTA: il motore AI serve SOLO per la segmentazione intelligente.
REM  La Riparazione PRO e le Booleane PRO (install_pro.bat) funzionano
REM  benissimo anche senza tutto questo.
REM ================================================================
cd /d "%~dp0"
call venv\Scripts\activate
if errorlevel 1 (
  echo Esegui prima install_base.bat
  pause
  exit /b 1
)

echo.
echo === La tua versione di Python ===
python -c "import sys, platform; print(sys.version); print('Python', platform.python_version())"
echo.

REM ---------------------------------------------------------------
REM PyTorch: le versioni CUDA disponibili dipendono dalla versione di
REM Python. Invece di puntare a una sola (che magari non esiste per la
REM tua), le proviamo in ordine dalla piu' recente e ci fermiamo alla
REM prima che funziona.
REM ---------------------------------------------------------------
set TORCH_OK=0
for %%C in (cu128 cu126 cu124 cu121) do (
  if !TORCH_OK!==0 (
    echo === Provo PyTorch con %%C ===
    pip install torch torchvision --index-url https://download.pytorch.org/whl/%%C
    REM la prova vera e' che si importi davvero
    python -c "import torch" 2>nul && (
      set TORCH_OK=1
      echo.
      echo   ^>^>^> PyTorch installato con %%C
    )
    echo.
  )
)

if !TORCH_OK!==0 (
  echo.
  echo ==========================================================
  echo  PyTorch con CUDA non e' disponibile per questa versione
  echo  di Python ^(vedi il numero stampato qui sopra^).
  echo.
  echo  Due strade:
  echo   1^) Installa Python 3.12 da python.org, poi cancella la
  echo      cartella "venv" e rifai install_base.bat + install_ai.bat
  echo   2^) Oppure usa l'app senza il motore AI: la Riparazione PRO
  echo      e le Booleane PRO ^(install_pro.bat^) funzionano lo stesso.
  echo.
  echo  Mandami il numero di Python stampato sopra e ti dico
  echo  esattamente quale versione mettere.
  echo ==========================================================
  pause
  exit /b 1
)

echo.
echo === Installo SAM, il renderer e le utility ===
pip install segment-anything pyrender pillow scikit-learn fast-simplification opencv-python

echo.
echo === Scarico il modello SAM (sam_vit_b ~ 375 MB) ===
echo     ^(se si interrompe, ri-esegui questo file: riprende da dove era^)
if not exist models mkdir models
REM -C - riprende un download interrotto invece di ricominciare da zero
curl -L -C - -o models\sam_vit_b_01ec64.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
if errorlevel 1 (
  echo.
  echo  Download non riuscito o interrotto.
  echo  Puoi anche scaricarlo a mano da questo indirizzo:
  echo    https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
  echo  e metterlo nella cartella:  %~dp0models\
  echo.
)

echo.
echo === Verifica finale ===
python -c "import torch; print('PyTorch', torch.__version__); print('CUDA disponibile:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'nessuna')"
echo.
echo ============================================================
echo  Se sopra dice "CUDA disponibile: True", riavvia avvia.bat:
echo  deve scrivere "Motore AI: DISPONIBILE (GPU)".
echo  Se dice False, mandami tutto questo messaggio.
echo ============================================================
pause
