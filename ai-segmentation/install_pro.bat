@echo off
REM ================================================================
REM  Motori PROFESSIONALI:
REM   - pymeshlab  = motore di MeshLab (riparazione mesh di alto livello)
REM   - manifold3d = booleane ESATTE (come le "exact" di Blender/OpenSCAD)
REM  Servono per: Riparazione PRO e Taglio PRO + connettore automatico.
REM  Non serve la scheda video: girano su CPU. Circa 150 MB.
REM ================================================================
cd /d "%~dp0"
call venv\Scripts\activate
if errorlevel 1 (
  echo.
  echo ERRORE: esegui prima install_base.bat
  pause
  exit /b 1
)
echo.
echo === Installo i motori professionali (pymeshlab + manifold3d) ===
pip install pymeshlab manifold3d
if errorlevel 1 (
  echo.
  echo ERRORE durante l'installazione. Copia il messaggio qui sopra e mandamelo.
  pause
  exit /b 1
)
echo.
echo === Verifica ===
python -c "import pymeshlab, manifold3d; print('pymeshlab OK'); print('manifold3d OK')"
if errorlevel 1 (
  echo.
  echo ATTENZIONE: le librerie non si caricano. Mandami il messaggio qui sopra.
  pause
  exit /b 1
)
echo.
echo ============================================================
echo  FATTO. Riavvia il companion con  avvia.bat
echo  Poi nell'app troverai attivi:
echo    - "Riparazione PRO (PC locale)"      (passo 2 - Ripara)
echo    - "Taglio PRO + connettore"          (passo 3 - taglio dritto)
echo ============================================================
pause
