@echo off
REM ================================================================
REM  Installazione BASE del companion di segmentazione (leggera).
REM  Serve solo: Python 3.11 installato (da https://www.python.org/).
REM ================================================================
cd /d "%~dp0"
echo.
echo === Creo l'ambiente Python (cartella venv) ===
python -m venv venv
if errorlevel 1 (
  echo.
  echo ERRORE: Python non trovato.
  echo Installa Python 3.11 da https://www.python.org/downloads/
  echo   [ IMPORTANTE: spunta "Add Python to PATH" durante l'installazione ]
  echo e poi ri-esegui questo file.
  pause
  exit /b 1
)
call venv\Scripts\activate
python -m pip install --upgrade pip
echo.
echo === Installo le librerie di base ===
pip install trimesh numpy flask scipy
echo.
echo ============================================================
echo  FATTO. Ora avvia il companion con  avvia.bat
echo  (poi nell'app clicca "Segmenta con AI (PC locale)")
echo ============================================================
pause
