@echo off
setlocal enabledelayedexpansion
REM ================================================================
REM  Installazione BASE del companion di segmentazione (leggera).
REM  Serve solo: Python installato (da https://www.python.org/).
REM ================================================================
cd /d "%~dp0"

echo.
echo === Controllo l'ambiente Python (cartella venv) ===

REM LA CARTELLA "venv" NON SI PUO' SPOSTARE DA UN COMPUTER ALL'ALTRO.
REM Dentro ci sono scritti i percorsi ASSOLUTI del PC su cui e' stata
REM creata. Basta cambiare computer - o anche solo il nome utente di
REM Windows - e pip continua a cercare python.exe nella vecchia cartella:
REM     Fatal error in launcher: Unable to create process using
REM     '"C:\Users\vecchio\...\venv\Scripts\python.exe" ...'
REM E' successo davvero, dopo una formattazione, portandosi dietro la
REM cartella intera.
REM
REM Quindi qui non si da' niente per buono: si prova ad avviare il python
REM della venv. Se non parte, la cartella si butta e si rifa'. Non si perde
REM niente di tuo: dentro ci sono solo librerie da riscaricare. I tuoi
REM modelli e il file del motore AI (cartella "models") stanno fuori e non
REM vengono toccati.
REM La prova si fa con "python -m pip", non solo avviando python: il pezzo che
REM si rompe per primo e' proprio pip. Il python della venv e' una copia vera
REM dell'eseguibile e spesso parte lo stesso; pip.exe invece e' un lanciatore
REM che si porta scritto dentro il percorso del python, e quello non torna piu'.
if exist "venv\Scripts\python.exe" (
  "venv\Scripts\python.exe" -m pip --version >nul 2>&1
  if errorlevel 1 (
    echo    La cartella "venv" non e' utilizzabile su questo computer
    echo    ^(succede quando arriva da un altro PC, o se e' cambiato il nome utente^).
    echo    La butto e la rifaccio ^(ci vuole qualche minuto^).
    rmdir /s /q venv
  ) else (
    echo    Ambiente gia' presente e funzionante.
  )
) else (
  if exist "venv" (
    echo    La cartella "venv" e' incompleta: la rifaccio.
    rmdir /s /q venv
  )
)

REM --- quale Python usare ---
REM Si preferisce il 3.12: e' quello per cui esistono i pacchetti gia'
REM pronti di TUTTI i motori (pymeshlab, manifold3d, PyTorch). Con un
REM Python troppo nuovo l'installazione parte e poi si pianta a meta',
REM perche' per quella versione i pacchetti non sono ancora usciti.
set "PYEXE="
if not exist "venv\Scripts\python.exe" (
  for %%V in (3.12 3.11 3.13) do (
    if not defined PYEXE (
      py -%%V -c "pass" >nul 2>&1 && set "PYEXE=py -%%V"
    )
  )
  if not defined PYEXE (
    python -c "pass" >nul 2>&1 && set "PYEXE=python"
  )
  if not defined PYEXE (
    echo.
    echo ERRORE: Python non trovato.
    echo Installa Python 3.12 da https://www.python.org/downloads/
    echo   [ IMPORTANTE: spunta "Add Python to PATH" durante l'installazione ]
    echo e poi ri-esegui questo file.
    pause
    exit /b 1
  )
  echo.
  echo === Creo l'ambiente Python con: !PYEXE! ===
  !PYEXE! -m venv venv
)

REM Da qui in poi si chiama SEMPRE il python della venv, mai "pip" da solo.
REM pip.exe e' un programmino che dentro si porta scritto dove sta python:
REM se quel percorso non torna, si ferma. "python -m pip" invece parte dal
REM python giusto e quel problema non ce l'ha.
set "VPY=%~dp0venv\Scripts\python.exe"
if not exist "%VPY%" (
  echo.
  echo ERRORE: non sono riuscito a creare l'ambiente Python.
  echo Cancella a mano la cartella "venv" e ri-esegui questo file.
  pause
  exit /b 1
)

echo.
echo === Versione di Python in uso ===
"%VPY%" -c "import sys; print(sys.version.split()[0])"
"%VPY%" -m pip install --upgrade pip

echo.
echo === Installo le librerie di base ===
"%VPY%" -m pip install trimesh numpy flask scipy
if errorlevel 1 (
  echo.
  echo ERRORE durante l'installazione. Copia il messaggio qui sopra e mandamelo.
  pause
  exit /b 1
)

REM Avviso sulla versione: 3.13 e oltre sono troppo nuove per alcuni motori.
"%VPY%" -c "import sys;print(sys.version_info[0]*100+sys.version_info[1])" > "%TEMP%\_segver.txt"
set /p PYVER=<"%TEMP%\_segver.txt"
del "%TEMP%\_segver.txt" >nul 2>&1
if !PYVER! GEQ 313 (
  echo.
  echo ------------------------------------------------------------
  echo  ATTENZIONE: stai usando un Python molto recente.
  echo  I motori professionali ^(pymeshlab, PyTorch^) escono sempre
  echo  con qualche mese di ritardo sulle versioni nuove: se
  echo  install_pro.bat o install_ai.bat si fermano, installa
  echo  Python 3.12 da python.org, cancella la cartella "venv"
  echo  e rifai da questo file.
  echo ------------------------------------------------------------
)

echo.
echo ============================================================
echo  FATTO. Ora avvia il companion con  avvia.bat
echo  (poi nell'app clicca "Segmenta con AI (PC locale)")
echo ============================================================
pause
