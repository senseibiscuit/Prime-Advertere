@echo off
setlocal

set "SITE_DIR=%~dp0"
set "APP_URL=http://127.0.0.1:8080/"
set "INDEX_FILE=%SITE_DIR%index.html"
set "CHROME_EXE="
set "PORT_PID="

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not exist "%INDEX_FILE%" (
  echo Could not find index.html in this build folder.
  echo Checked:
  echo   %INDEX_FILE%
  pause
  exit /b 1
)

pushd "%SITE_DIR%"
echo Starting Prime Advertere template from:
echo   %CD%
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8080 .*LISTENING"') do (
  set "PORT_PID=%%P"
  goto stop_existing
)

:stop_existing
if defined PORT_PID (
  echo Stopping existing server on port 8080...
  taskkill /PID %PORT_PID% /F >nul 2>nul
  timeout /t 1 >nul
  echo.
)

echo Opening %APP_URL%
if defined CHROME_EXE (
  start "" "%CHROME_EXE%" "%APP_URL%"
) else (
  start "" "%APP_URL%"
)

where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto end
)

echo Node.js was not found, so the email form cannot run locally.
echo.
echo Install Node.js and then run this launcher again.
pause

:end
popd
endlocal
