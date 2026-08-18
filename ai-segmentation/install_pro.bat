@echo off
setlocal enabledelayedexpansion
REM ================================================================
REM  Motori PROFESSIONALI:
REM   - pymeshlab   = motore di MeshLab (riparazione mesh di alto livello)
REM   - manifold3d  = booleane ESATTE (come le "exact" di Blender/OpenSCAD)
REM
REM  E tre aiutanti che sembrano dettagli ma non lo sono. Senza di loro il
REM  companion non si ferma e non da' errore: salta in silenzio un pezzo di
REM  lavoro, e il risultato esce diverso da come dovrebbe senza che si capisca
REM  perche'. E' successo davvero, tre volte:
REM   - rtree        = ricerca del punto piu' vicino. Serve al controllo che il
REM                    tappo del taglio non sfondi la pelle del modello.
REM   - networkx     = serve alle riparazioni di trimesh (versi delle facce,
REM                    buchi tappati).
REM   - scikit-image = serve alla riparazione a VOXEL, quella che chiude
REM                    davvero i modelli aperti. Senza, nel registro compare
REM                    "voxel: No module named 'skimage'" e restano i bordi
REM                    aperti.
REM
REM  Non serve la scheda video: girano su CPU. Circa 250 MB in tutto.
REM ================================================================
cd /d "%~dp0"

REM Si chiama direttamente il python della venv, mai "pip" da solo: pip.exe
REM si porta scritto dentro dove sta python, e se quella cartella e' stata
REM spostata (o e' arrivata da un altro PC) si ferma con "Fatal error in
REM launcher". Vedi il commento lungo in install_base.bat.
set "VPY=%~dp0venv\Scripts\python.exe"
if not exist "%VPY%" (
  echo.
  echo ERRORE: manca l'ambiente Python. Esegui prima install_base.bat
  pause
  exit /b 1
)
"%VPY%" -c "pass" >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERRORE: la cartella "venv" non e' utilizzabile su questo computer
  echo ^(di solito perche' e' stata copiata da un altro PC^).
  echo Esegui install_base.bat: se ne accorge da solo e la rifa'.
  pause
  exit /b 1
)

echo.
echo === Installo i motori professionali ===
"%VPY%" -m pip install pymeshlab manifold3d rtree networkx scikit-image
if errorlevel 1 (
  echo.
  echo ERRORE durante l'installazione. Copia il messaggio qui sopra e mandamelo.
  echo.
  echo  Se parla di "no matching distribution" o simili, quasi sempre e'
  echo  la versione di Python: guarda quale versione stampa install_base.bat.
  echo  Con 3.13 o piu' recente alcuni di questi motori non esistono ancora
  echo  gia' pronti. In quel caso installa Python 3.12 da python.org,
  echo  cancella la cartella "venv" e rifai install_base.bat + questo file.
  pause
  exit /b 1
)
echo.
echo === Verifica ===
"%VPY%" -c "import pymeshlab, manifold3d, rtree, networkx, skimage; print('pymeshlab OK'); print('manifold3d OK'); print('rtree OK'); print('networkx OK'); print('scikit-image OK')"
if errorlevel 1 (
  echo.
  echo ATTENZIONE: qualcosa non si carica. Guarda QUALE nome manca nell'elenco
  echo qui sopra e mandami il messaggio: l'app funziona lo stesso, ma con quel
  echo pezzo di lavoro saltato.
  pause
  exit /b 1
)
echo.
echo ============================================================
echo  FATTO. Riavvia il companion con  avvia.bat
echo  Poi nell'app troverai attivi:
echo    - "Riparazione PRO (PC locale)"      (passo 2 - Ripara)
echo    - "Taglio PRO + connettore"          (passo 3 - taglio dritto)
echo    - riparazione a voxel, controllo delle sporgenze e riparazione
echo      dei versi/buchi: prima venivano saltati in silenzio
echo ============================================================
pause
