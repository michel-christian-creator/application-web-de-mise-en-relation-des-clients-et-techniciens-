# MboaTech — Guide de mise en production

Guide pas à pas pour déployer MboaTech sur un serveur Linux (Ubuntu/Debian).
Le projet reste en **paiements simulés** tant qu'aucune clé API « hr skills pay »
n'est fournie ; la bascule vers les paiements réels se limite à quelques variables
d'environnement (section 6).

## Architecture cible

```
Client HTTPS
   │
   ▼
nginx (80/443) ── sert dist/ (SPA) ──────────────────────────► /assets, /index.html
   │
   ├── /api/  ───────────────────────────────────────────────► Spring Boot :8082
   └── /ws    (WebSocket, upgrade) ──────────────────────────► Spring Boot :8082
                                                                    │
                                                                    ▼
                                                                 PostgreSQL :5432 (mboatech)
```

- Le frontend et le backend sont servis **sur le même domaine** : nginx proxy
  `/api` et `/ws` vers le backend, pas de CORS à gérer entre eux.
- Une **seule instance** backend (le stockage des jetons est en mémoire, voir
  section 8 — points d'attention).

## 1. Prérequis serveur

- Ubuntu 22.04+ (ou équivalent)
- OpenJDK 17
- Node.js 20+ (uniquement pour construire le frontend)
- PostgreSQL 13+
- nginx

## 2. Déployer le code et préparer les répertoires

```bash
# Utilisateur applicatif
sudo useradd -r -s /usr/sbin/nologin mboatech

# Emplacement
sudo mkdir -p /opt/mboa-tech/{frontend,uploads,private-uploads,logs,deploy}
sudo chown -R mboatech:mboatech /opt/mboa-tech
```

Copier le code source dans `/opt/mboa-tech` (ou simplement le dossier du
projet), puis construire côté local ou côté serveur :

```bash
# Frontend (à la racine du projet) : l'URL de l'API est embarquée au build
cp deploy/.env.production.example .env.production
#   → renseigner VITE_API_URL (ex. https://mboatech.com)
npm install
npm run build
#   → sortie : dist/
cp -r dist/* /opt/mboa-tech/frontend/

# Backend
cd backend
mvn clean package -DskipTests
cp target/backend-0.0.1-SNAPSHOT.jar /opt/mboa-tech/backend.jar
```

> Le backend gère lui-même les téléversements (`uploads/`, `private-uploads/`) ;
> le serveur nginx n'expose jamais `private-uploads/` (documents KYC, servis
> uniquement par `/api/kyc/file/{filename}` après authentification).

## 3. Base de données

Créer la base et un utilisateur applicatif :

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE mboatech;
CREATE USER mboatech_app WITH PASSWORD 'mot_de_passe_fort';
GRANT ALL PRIVILEGES ON DATABASE mboatech TO mboatech_app;
\q
```

Appliquer le schéma et les migrations :

```bash
DB_USERNAME=mboatech_app DB_PASSWORD=... ./deploy/migrate-db.sh --fresh
```

Pour une base existante (mise à jour) :

```bash
DB_USERNAME=mboatech_app DB_PASSWORD=... ./deploy/migrate-db.sh
```

Le suivi des migrations est enregistré dans la table `schema_migrations`.

## 4. Variables d'environnement

```bash
sudo mkdir -p /etc/mboa-tech
sudo cp deploy/mboa-tech.env.example /etc/mboa-tech/mboa-tech.env
sudo chmod 600 /etc/mboa-tech/mboa-tech.env
sudo nano /etc/mboa-tech/mboa-tech.env   # renseigner DB / admin / CORS
```

Valeurs importantes :
- `DB_USERNAME` / `DB_PASSWORD` — identifiants applicatifs (pas root).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — compte admin créé au premier démarrage
  s'il n'en existe aucun. **Obligatoire.**
- `CORS_ALLOWED_ORIGINS` — les domaines du frontend.
- `HRSK_*` — voir section 6 (rester en simulation pour l'instant).

## 5. Service systemd + nginx

```bash
# Service
sudo cp deploy/mboa-tech.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mboa-tech
sudo systemctl status mboa-tech

# nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mboa-tech
sudo ln -s /etc/nginx/sites-available/mboa-tech /etc/nginx/sites-enabled/
#   → adapter server_name, root /opt/mboa-tech/frontend
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Paiements : simulation → réel

**État actuel : simulation.** Aucune clé API n'est requise ; les transactions
sont simulées par le backend (`HRSK_ENABLED=false`).

Quand la plateforme « HR-Skills Pay » fournit les deux clés (clé publique A
`hrsk_pk_…` + clé secrète B `hrsk_sk_…`) et le secret de webhook, changer
uniquement dans `/etc/mboa-tech/mboa-tech.env` :

```ini
HRSK_ENABLED=true
HRSK_API_KEY=<clé publique A hrsk_pk_…>
HRSK_API_SECRET=<clé secrète B hrsk_sk_…>
HRSK_WEBHOOK_SECRET=<secret de signature des webhooks>
HRSK_API_BASE=https://api.hrskills-pay.com
HRSK_RETURN_URL=https://mboatech.com
HRSK_CANCEL_URL=https://mboatech.com
HRSK_WEBHOOK_URL=https://mboatech.com/api/payments/webhook
```

puis `sudo systemctl restart mboa-tech`.

> Flux Cash-In : le client confirme le paiement sur son téléphone (USSD / push
> Mobile Money), puis le statut final arrive sur le webhook
> `/api/payments/webhook`. Ce webhook est public (sans JWT) mais protégé par la
> signature HMAC-SHA256 (`X-Hub-Signature`) vérifiée avec `HRSK_WEBHOOK_SECRET`.
> Ne pas le mettre derrière une autre authentification.

## 7. HTTPS

Obtenir un certificat (Let's Encrypt) et activer le bloc 443 commenté dans
`deploy/nginx.conf` :

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d mboa-tech.com -d www.mboa-tech.com
```

Certbot modifie lui-même la config nginx pour activer TLS.

## 8. Sauvegardes et points d'attention

**Sauvegarde quotidienne** (crontab de l'utilisateur applicatif ou root) :

```cron
0 2 * * * BACKUP_DIR=/srv/backups /opt/mboa-tech/deploy/backup-db.sh
```

Points d'attention :
- **Instance unique** : les jetons d'authentification sont stockés en mémoire
  (`ConcurrentHashMap`) et en base (`auth_sessions`). Les sessions persistées
  survivent aux redémarrages, mais ne pas déployer plusieurs instances backend
  sans partager le stockage des jetons.
- **`ddl-auto: none`** : toute évolution du schéma passe par une migration SQL
  dans `db/migration_*.sql`, appliquée via `deploy/migrate-db.sh`.
- **Fichiers KYC privés** : ne jamais exposer `private-uploads/` au public.
- **Logs** : rotation configurée dans `logback-spring.xml` (14 jours / 1 Go max,
  dossier `logs/`). Vérifier qu'aucun secret n'y transparaît.

## 9. Mise à jour d'une version

```bash
# 1. Frontend : rebuild + copie
npm run build && sudo cp -r dist/* /opt/mboa-tech/frontend/
# 2. Backend : rebuild du jar
cd backend && mvn clean package -DskipTests
sudo cp target/backend-0.0.1-SNAPSHOT.jar /opt/mboa-tech/backend.jar
# 3. Migrations éventuelles
DB_USERNAME=mboatech_app DB_PASSWORD=... ./deploy/migrate-db.sh
# 4. Redémarrage
sudo systemctl restart mboa-tech
```

## 10. Vérifications post-déploiement

- [ ] `https://domaine` affiche l'application (frontend).
- [ ] Login/inscription fonctionnels.
- [ ] Chat temps réel fonctionnel (WebSocket `/ws`).
- [ ] Téléversement photo de profil et portfolio OK.
- [ ] Dépôt KYC et consultation admin OK.
- [ ] Paiement simulé (dépôt / libération / retrait) OK.
- [ ] Logs présents dans `/opt/mboa-tech/logs/mboatech.log`.
- [ ] `sudo systemctl status mboa-tech` → active (running).
