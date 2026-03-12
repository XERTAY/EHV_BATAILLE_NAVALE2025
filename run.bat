@echo off
REM Compiler tous les fichiers .java sous src\ vers le dossier courant (.)

echo Compilation du projet Java...

setlocal enabledelayedexpansion
set JAVA_FILES=

for /R src %%f in (*.java) do (
    set JAVA_FILES=!JAVA_FILES! "%%f"
)

if "%JAVA_FILES%"=="" (
    echo Aucun fichier .java trouvé dans le dossier src
    exit /b 1
)

javac -d . %JAVA_FILES%
if errorlevel 1 (
    echo La compilation a echoue.
    exit /b 1
)

echo Compilation reussie.
echo Lancement du jeu...

REM Classe principale
java com.ehv.battleship.view.ConsoleMain