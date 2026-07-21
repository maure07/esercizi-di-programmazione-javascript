@echo off
REM Avvia il companion di segmentazione (lascia questa finestra aperta mentre usi l'app)
cd /d "%~dp0"
call venv\Scripts\activate
if errorlevel 1 (
  echo Esegui prima install_base.bat
  pause
  exit /b 1
)
python server.py
pause
