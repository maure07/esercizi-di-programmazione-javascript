@echo off
REM ================================================================
REM  Installazione del MOTORE AI (SAM multi-vista, usa la GPU).
REM  Pesante: scarica PyTorch CUDA e il modello SAM (~2-3 GB totali).
REM  Esegui PRIMA install_base.bat.
REM ================================================================
cd /d "%~dp0"
call venv\Scripts\activate
if errorlevel 1 (
  echo Esegui prima install_base.bat
  pause
  exit /b 1
)
echo.
echo === Installo PyTorch con CUDA 12.1 (grande, puo' metterci diversi minuti) ===
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
echo.
echo === Installo SAM, il renderer e le utility ===
pip install segment-anything pyrender pillow scikit-learn
echo.
echo === Scarico il modello SAM (sam_vit_b ~ 375 MB) ===
if not exist models mkdir models
curl -L -o models\sam_vit_b_01ec64.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
echo.
echo ============================================================
echo  FATTO. Riavvia con avvia.bat: deve dire
echo    "Motore AI: DISPONIBILE (GPU)"
echo  Se dice cosi', nell'app scegli il motore "AI".
echo ============================================================
pause
