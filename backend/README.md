# MboaTech Backend

Ce backend Java Spring Boot gère l'inscription automatique des clients, techniciens et administrateurs.

## Installation

1. Assure-toi que PostgreSQL est lancé et que la base `mboatech` existe.
2. Vérifie que le fichier `db/schema_updated.sql` a bien été importé.
3. Depuis `backend/`, exécute :

```bash
mvn clean package
```

## Configuration

Toutes les valeurs sensibles passent par des variables d'environnement (aucun secret en clair dans le dépôt) :

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | `localhost`, `5432`, `mboatech` | Connexion PostgreSQL |
| `DB_USERNAME`, `DB_PASSWORD` | `postgres`, vide | Identifiants PostgreSQL |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `admin@mboatech.com`, **obligatoire** | Compte admin créé au démarrage si aucun admin n'existe |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Origines autorisées (HTTP + WebSocket), séparées par des virgules |
| `SERVER_PORT` | `8082` | Port HTTP |
| `HRSK_ENABLED` | `false` | Activer les paiements réels HR-Skills Pay |
| `HRSK_API_KEY` | vide | Clé publique A (`hrsk_pk_…`, jamais dans le dépôt) |
| `HRSK_API_SECRET` | vide | Clé secrète B (`hrsk_sk_…`, jamais dans le dépôt) |
| `HRSK_WEBHOOK_SECRET` | vide | Secret de signature des webhooks (X-Hub-Signature) |
| `UPLOAD_DIR` | `./uploads` | Fichiers publics (photos de profil / portfolio) |
| `PRIVATE_UPLOAD_DIR` | `./private-uploads` | Documents KYC (jamais servis par `/uploads/**`) |

> **Important** : `ADMIN_PASSWORD` doit être défini en production. S'il est absent, aucun compte admin par défaut n'est créé.

### Migration

La base utilise `ddl-auto: none`. Toute évolution du schéma passe par les
migrations SQL du dossier `db/` (à la racine du projet), appliquées via le
script `deploy/migrate-db.sh` :

```bash
# Mise à jour d'une base existante (applique les migrations manquantes) :
DB_USERNAME=<user> DB_PASSWORD=<password> ./deploy/migrate-db.sh
```

## API d'inscription

POST `/api/register`

Exemple de body pour un client :

```json
{
  "username": "client123",
  "email": "client@example.com",
  "password": "password123",
  "firstName": "Jean",
  "lastName": "Dupont",
  "role": "client",
  "city": "Yaoundé",
  "location": "Bastos"
}
```

Exemple pour un technicien :

```json
{
  "username": "tech123",
  "email": "tech@example.com",
  "password": "password123",
  "firstName": "Paul",
  "lastName": "Nkuissi",
  "role": "technician",
  "domain": "Électricité",
  "city": "Yaoundé",
  "location": "Bastos",
  "bio": "Électricien expérimenté",
  "specialties": "Installation, dépannage"
}
```

Exemple pour l'admin :

```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "admin123",
  "firstName": "Admin",
  "lastName": "User",
  "role": "admin"
}
```

> Seuls le `username` et le `password` de l'admin doivent correspondre aux valeurs préconfigurées.

## Exécution

```bash
cd backend
mvn spring-boot:run
```

L'API est accessible sur `http://localhost:8082/api/...` (port configurable via `SERVER_PORT`).
