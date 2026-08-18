@echo off
REM Avvia il companion di segmentazione (lascia questa finestra aperta mentre usi l'app)
cd /d "%~dp0"

REM Si chiama direttamente il python della venv: cosi' se la cartella e'
REM stata copiata da un altro computer ce ne accorgiamo QUI, con un
REM messaggio che dice cosa fare, invece di un errore di Windows.
set "VPY=%~dp0venv\Scripts\python.exe"
if not exist "%VPY%" (
  echo.
  echo Manca l'ambiente Python: esegui prima install_base.bat
  pause
  exit /b 1
)
"%VPY%" -c "pass" >nul 2>&1
if errorlevel 1 (
  echo.
  echo La cartella "venv" non e' utilizzabile su questo computer
  echo ^(di solito perche' e' stata copiata da un altro PC: dentro ci sono
  echo scritti i percorsi del computer dove e' stata creata^).
  echo.
  echo Esegui install_base.bat: se ne accorge da solo, la rifa', e poi
  echo rifai install_pro.bat.
  pause
  exit /b 1
)
"%VPY%" server.py
pause
