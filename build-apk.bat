@echo off
title Defenehero APK Build

echo ========================================================
echo   Defenehero: Android APK Build
echo ========================================================
echo.

call npm run build
call npx cap copy android

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

call .\android\gradlew.bat -p android assembleDebug

echo.
echo ========================================================
echo APK Build Complete!
echo Location: android\app\build\outputs\apk\debug\app-debug.apk
echo ========================================================
echo.
pause
