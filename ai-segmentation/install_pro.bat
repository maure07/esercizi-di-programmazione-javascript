@echo off
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
call venv\Scripts\activate
if errorlevel 1 (
  echo.
  echo ERRORE: esegui prima install_base.bat
  pause
  exit /b 1
)
echo.
echo === Installo i motori professionali ===
pip install pymeshlab manifold3d rtree networkx scikit-image
if errorlevel 1 (
  echo.
  echo ERRORE durante l'installazione. Copia il messaggio qui sopra e mandamelo.
  pause
  exit /b 1
)
echo.
echo === Verifica ===
python -c "import pymeshlab, manifold3d, rtree, networkx, skimage; print('pymeshlab OK'); print('manifold3d OK'); print('rtree OK'); print('networkx OK'); print('scikit-image OK')"
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
