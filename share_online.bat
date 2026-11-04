@echo off
REM Put the full OcuLubak website on a public https link, served from this computer.
REM Builds the web app, starts the backend (debugger off) and opens a free Cloudflare tunnel.
REM The link is printed below ("https://....trycloudflare.com") and changes on every run.
REM Keep this window open and the computer awake; closing it takes the site offline.
REM Needs: winget install Cloudflare.cloudflared

cd /d "%~dp0"
call .venv\Scripts\activate.bat

echo Building the web app...
cd frontend
set "VITE_API_URL=/api"
call npm run build || (pause & exit /b 1)
cd ..

echo Starting the backend in its own window...
start "OcuLubak backend" cmd /k "cd /d %~dp0backend && set PYTHONUTF8=1&& set FLASK_DEBUG=0&& python run.py"

echo Opening the tunnel. Share the https://....trycloudflare.com link it prints.
cloudflared tunnel --url http://localhost:5000
