@echo off
title Defenehero Mobile Emulator Runner

echo ========================================================
echo   Defenehero: Mobile Emulator Launcher
echo ========================================================
echo.

echo [1/4] Cleaning leftover lock files...
del /f /q "%USERPROFILE%\.android\avd\mathmath.avd\*.lock" 2>nul
if exist "%USERPROFILE%\.android\avd\mathmath.avd\hardware-qemu.ini.lock" (
    rmdir /s /q "%USERPROFILE%\.android\avd\mathmath.avd\hardware-qemu.ini.lock" 2>nul
)

echo [2/4] Restarting ADB daemon and starting Emulator...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" kill-server >nul 2>&1
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" start-server >nul 2>&1

start "" "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -avd mathmath -no-snapshot-load

echo [3/4] Building web bundle and debug APK...
call npm run build
call npx cap copy android

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

call .\android\gradlew.bat -p android assembleDebug

echo [4/4] Waiting for emulator and launching app...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" wait-for-device
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r android\app\build\outputs\apk\debug\app-debug.apk
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" shell am start -n com.metah.defenehero/.MainActivity

echo.
echo ========================================================
echo   Success! App installed and launched on emulator.
echo ========================================================
echo.
pause
