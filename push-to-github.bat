@echo off
title Push Task 1 to GitHub
cd /d "%~dp0"

echo =========================================================
echo   Push NeoCalc Pro (Task 1) to GitHub
echo =========================================================
echo.
echo Make sure you have created the repository on GitHub:
echo https://github.com/new
echo.

set /p REPO_NAME="Enter your GitHub repository name (e.g. Build-a-Calculator or Task-1-Calculator): "

if "%REPO_NAME%"=="" (
    echo No repository name entered. Exiting...
    pause
    exit /b
)

echo.
echo Setting remote origin to https://github.com/vaibhavsarnobat1-bit/%REPO_NAME%.git ...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/vaibhavsarnobat1-bit/%REPO_NAME%.git
git branch -M main

echo.
echo Pushing code to GitHub...
git push -u origin main

echo.
echo =========================================================
echo   Push Complete!
echo   Your Repository Link:
echo   https://github.com/vaibhavsarnobat1-bit/%REPO_NAME%
echo =========================================================
pause
