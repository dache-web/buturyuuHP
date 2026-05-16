@echo off
chcp 65001 > nul
cd /d %~dp0
echo ======================================================
echo    Profit Finder Pro - 自動起動システム
echo ======================================================
echo.

if not exist node_modules (
    echo [初回設定] 必要なプログラムをダウンロードしています...
    echo (これには1〜2分かかる場合があります。このままお待ちください)
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [エラー] セットアップに失敗しました。
        echo インターネット接続を確認するか、Node.jsがインストールされているか確認してください。
        pause
        exit /b %errorlevel%
    )
    echo.
    echo [完了] セットアップが正常に終了しました。
)

echo [起動] ダッシュボードを開始します...
echo.
call node server.js

if %errorlevel% neq 0 (
    echo.
    echo [エラー] プログラムが異常終了しました。
    pause
)
