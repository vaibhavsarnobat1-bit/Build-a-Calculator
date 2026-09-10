@echo off
title Push Task 2 to GitHub
cd /d "%~dp0"

echo =========================================================
echo   Push NeoCalc Pro (Task 2) to GitHub
echo =========================================================
echo.
echo 1. Create a new repository on GitHub:
echo    https://github.com/new
echo.
echo (Do NOT initialize with README, .gitignore, or license)
echo.

set /p REPO_NAME="Enter your GitHub repository name [Default: Build-a-Calculator]: "

if "%REPO_NAME%"=="" set REPO_NAME=Build-a-Calculator

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
