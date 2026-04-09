@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0cmds\set_version.ps1" -NewVersion %1
