@echo off
rem =====================================================
rem  MboaTech - Script de lancement du backend
rem  Double-clique sur ce fichier pour demarrer l'API
rem =====================================================

rem --- 1. Changer vers le dossier du backend ---
cd /d "%~dp0"

rem --- 2. Definir les identifiants de connexion PostgreSQL ---
set "DB_USERNAME=postgres"
set "DB_PASSWORD=VOTRE_MOT_DE_PASSE_ICI"
set "DB_NAME=mboatech"
set "DB_HOST=localhost"
set "DB_PORT=5432"

rem --- 3. (Optionnel) Mot de passe admin cree au premier demarrage ---
set "ADMIN_EMAIL=admin@mboatech.com"
set "ADMIN_PASSWORD=ADMIN_MOT_DE_PASSE_ICI"

rem --- 4. Lancer l'application Spring Boot ---
echo.
echo Demarrage du backend MboaTech...
echo Base de donnees: %DB_USERNAME%@%DB_HOST%:%DB_PORT%/%DB_NAME%
echo.
call mvn spring-boot:run

rem --- 5. Pause si échec pour voir l'erreur ---
pause
