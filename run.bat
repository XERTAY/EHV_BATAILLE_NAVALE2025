@echo off
setlocal

echo Lancement du mode console via Maven...

pushd app\backend
call mvn -DskipTests compile exec:java -Dexec.mainClass=com.ehv.battleship.view.ConsoleMain -Dexec.classpathScope=runtime
set RUN_EXIT_CODE=%errorlevel%
popd
if not "%RUN_EXIT_CODE%"=="0" (
    echo Le lancement du mode console a echoue.
    exit /b 1
)