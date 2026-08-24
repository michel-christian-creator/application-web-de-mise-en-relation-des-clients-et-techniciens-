# MboaTech — Architecture du Projet

---

## Structure Racine

```
Design mboa-tech/
├── src/                    ← Frontend React (TypeScript)
├── backend/                ← Backend Java (Spring Boot)
├── db/                     ← Scripts SQL / migrations
├── server/                 ← Microservice Node.js (paiement Paymee)
├── deploy/                 ← Configs déploiement (Nginx, systemd, backups)
├── index.html              ← Point d'entrée HTML (Vite)
├── vite.config.ts          ← Config Vite + plugins
├── tsconfig.json           ← Config TypeScript
├── package.json            ← Dépendances frontend
├── pnpm-lock.yaml          ← Lockfile pnpm
├── .mise.toml              ← Versions outils (Node, pnpm)
├── .oxfmtrc.json           ← Config formateur oxfmt
├── AGENTS.md / CLAUDE.md   ← Instructions agents IA
└── PRODUCTION.md           ← Notes de production
```

---

## 1. Frontend — `src/`

### 1.1 Point d'entrée

| Fichier | Rôle |
|---|---|
| `main.tsx` | Monte `<App />` dans `#root`, importe `index.css` |
| `App.tsx` | Routeur principal, layout, navigation |
| `index.css` | Import Tailwind CSS v4, styles globaux, polices |
| `config.ts` | Config (URL API, etc.) |
| `i18n.tsx` | Internationalisation (FR/EN) |
| `vite-env.d.ts` | Déclarations type Vite |

### 1.2 Composants — `components/`

| Fichier | Rôle |
|---|---|
| `ThemeToggle.tsx` | Bouton thème clair/sombre |
| `NotificationsPanel.tsx` + `.css` | Panneau de notifications |
| `BellIcon.tsx` | Icône cloche |
| `LanguageMenu.tsx` + `.css` | Sélecteur de langue |
| `ImageUploader.tsx` + `.css` | Upload d'images |
| `LocationMarker.tsx` | Marqueur de localisation |

#### Composants d'animation — `components/animations/`
| Fichier | Rôle |
|---|---|
| `TiltCard.tsx` | Effet tilt 3D sur cartes |
| `FadeIn.tsx` | Animation fondu à l'apparition |
| `Stagger.tsx` + `StaggerItem.tsx` | Animation décalée d'enfants |
| `PhoneShowcase.tsx` | Showcase téléphone animé |
| `ConnectionNetwork.tsx` | Réseau de connexions animé |
| `CityMap3D.tsx` | Carte 3D de ville |

#### Icônes — `components/icons/`
| Fichier | Rôle |
|---|---|
| `ChatBubbleIcon.tsx` | Bulle de chat |

### 1.3 Hooks — `hooks/`

| Fichier | Rôle |
|---|---|
| `useTheme.ts` | Gestion thème clair/sombre |
| `useNotifications.ts` | Récupération des notifications |
| `useAttestation.ts` | Appels API attestations (check, generate, history) |

### 1.4 Utilitaires — `utils/`

| Fichier | Rôle |
|---|---|
| `validation.ts` | Validation de formulaires |
| `themeOverrides.ts` | Overrides CSS thème |
| `photoUrl.ts` | Construction URLs photos |
| `chatSocket.ts` | Connexion WebSocket chat |

### 1.5 Écrans — `screens/`

#### Landing
| Fichier | Rôle |
|---|---|
| `LandingPage.tsx` + `.css` | Page d'accueil publique |

#### Auth & Client — `screens/client/`
| Fichier | Rôle |
|---|---|
| `C1Auth.tsx` + `.css` | Connexion / Inscription |
| `C2Home.tsx` + `.css` | Accueil client |
| `C3Profile.tsx` + `.css` | Profil client |
| `C4Request.tsx` + `.css` | Demande d'intervention |
| `C5Chat.tsx` + `.css` | Chat client |
| `C6Payment.tsx` + `.css` | Paiement client |

#### Technicien — `screens/tech/`
| Fichier | Rôle |
|---|---|
| `T1Dashboard.tsx` + `.css` | Dashboard technicien (missions, attestations, stats, étoiles) |
| `T2Profile.tsx` + `.css` | Profil technicien |

#### Admin — `screens/admin/`
| Fichier | Rôle |
|---|---|
| `A1Dashboard.tsx` + `.css` | Dashboard administrateur |

#### Support — `screens/support/`
| Fichier | Rôle |
|---|---|
| `S1Console.tsx` + `.css` | Console de support |

#### Chat — `screens/chat/`
| Fichier | Rôle |
|---|---|
| `ChatList.tsx` + `.css` | Liste des conversations |

### 1.6 Assets — `assets/`
- `admin/electrician.svg`, `painter.svg`, `plumber.svg`, `tiler.svg` — Icônes de métier

---

## 2. Backend — `backend/src/`

> Package : `com.mboatech.backend`
> Stack : Java 17, Spring Boot 3.2, OpenPDF 1.3.30

### 2.1 Point d'entrée

| Fichier | Rôle |
|---|---|
| `BackendApplication.java` | Classe principale Spring Boot |

### 2.2 Configuration — `config/`

| Fichier | Rôle |
|---|---|
| `SecurityConfig.java` | Sécurité Spring (filter chain, CORS) |
| `TokenAuthenticationFilter.java` | Filtre JWT sur les requêtes |
| `WebSocketConfig.java` | Config WebSocket (chat) |
| `WebConfig.java` | Config CORS globale |
| `SystemUserInitializer.java` | Initialisation comptes par défaut au démarrage |
| `RequestLoggingFilter.java` | Logging des requêtes HTTP |
| `PaymeeProperties.java` | Props configuration Paymee |
| `MissionsProperties.java` | Props configuration missions |
| `AsyncConfig.java` | Config tâches asynchrones |
| `AsyncRequestTimeoutAdvice.java` | Timeout requêtes async |

### 2.3 Contrôleurs — `controller/`

| Fichier | Rôle | Routes |
|---|---|---|
| `AuthController.java` | Inscription, connexion, profil | `/api/auth/*` |
| `UserController.java` | CRUD utilisateur | `/api/users/*` |
| `ChatController.java` | Envoi/réception messages chat | `/api/chat/*` |
| `NotificationController.java` | Notifications | `/api/notifications/*` |
| `TechnicianCatalogController.java` | Catalogue de services tech | `/api/catalog/*` |
| `TechDashboardController.java` | Dashboard technicien | `/api/tech/*` |
| `TechnicianWithdrawController.java` | Retraits technicien | `/api/tech/withdraw/*` |
| `ClientWithdrawController.java` | Retraits client | `/api/client/withdraw/*` |
| `PortfolioController.java` | Portfolio du technicien | `/api/portfolio/*` |
| `PaymentController.java` | Paiements / Paymee | `/api/payment/*` |
| `KycController.java` | Documents KYC | `/api/kyc/*` |
| `AttestationController.java` | Attestations de service | `/api/attestation/*` |
| `AdminDashboardController.java` | Dashboard admin | `/api/admin/*` |
| `AdminDisputeController.java` | Litiges admin | `/api/admin/disputes/*` |
| `AdminWithdrawController.java` | Retraits admin | `/api/admin/withdraw/*` |
| `AdminPaymentController.java` | Paiements admin | `/api/admin/payments/*` |
| `AdminKycController.java` | KYC admin | `/api/admin/kyc/*` |
| `PlatformSettingsController.java` | Paramètres plateforme | `/api/settings/*` |
| `PublicController.java` | Routes publiques | `/api/public/*` |

### 2.4 Services — `service/`

| Fichier | Rôle |
|---|---|
| `AttestationService.java` | **Vérification d'éligibilité + génération PDF certificat** |
| `NotificationService.java` | Création et envoi de notifications |
| `PaymentService.java` | Logique de paiement (abstraction) |
| `PaymentGateway.java` | Interface de paiement |
| `SimulatedPaymentGateway.java` | Passerelle simulée (dev) |
| `RealPaymentGateway.java` | Passerelle réelle (Paymee) |
| `PaymentRequest.java` | DTO de requête de paiement |
| `PaymentResult.java` | DTO de résultat de paiement |
| `PaymentException.java` | Exception paiement |
| `ChatAccessService.java` | Contrôle d'accès au chat |
| `ChatEventService.java` | Événements chat en temps réel |
| `TechnicianEventService.java` | Événements technicien |
| `MissionGuardService.java` | Garde de réservation de missions |

### 2.5 Modèles — `model/`

| Fichier | Rôle |
|---|---|
| `User.java` | Utilisateur (email, mot de passe, rôle) |
| `Role.java` | Enum rôles (admin, client, technician, support) |
| `ClientProfile.java` | Profil client |
| `TechnicianProfile.java` | Profil technicien (domaine, note, disponibilité) |
| `AvailabilityStatus.java` | Enum disponibilité (available, busy, offline) |
| `AdminProfile.java` | Profil administrateur |
| `ClientRequest.java` | Demande d'intervention client |
| `RequestDecline.java` | Refus de mission par technicien |
| `PortfolioItem.java` | Élément du portfolio technicien |
| `TechnicianRecommendation.java` | Recommandation / avis |
| `ChatMessage.java` | Message de chat |
| `ChatSessionStatus.java` | Enum statut session chat |
| `Notification.java` | Notification |
| `KycDocument.java` | Document KYC |
| `Payment.java` | Transaction de paiement |
| `Withdrawal.java` | Demande de retrait |
| `PlatformSetting.java` | Paramètre de plateforme |
| `AuthSession.java` | Session d'authentification |
| `Attestation.java` | Attestation de service (JPA) |
| `AttestationLevel.java` | Enum niveaux : BRONZE(1), SILVER(2), GOLD(3), DIAMOND(5) |

### 2.6 Repository — `repository/`

| Fichier | Rôle |
|---|---|
| `UserRepository.java` | CRUD utilisateurs |
| `ClientProfileRepository.java` | CRUD profils clients |
| `TechnicianProfileRepository.java` | CRUD profils techniciens |
| `AdminProfileRepository.java` | CRUD profils admins |
| `ClientRequestRepository.java` | CRUD demandes d'intervention |
| `RequestDeclineRepository.java` | CRUD refus de missions |
| `PortfolioItemRepository.java` | CRUD portfolio |
| `TechnicianRecommendationRepository.java` | CRUD recommandations |
| `ChatMessageRepository.java` | CRUD messages chat |
| `NotificationRepository.java` | CRUD notifications |
| `KycDocumentRepository.java` | CRUD documents KYC |
| `PaymentRepository.java` | CRUD paiements |
| `WithdrawalRepository.java` | CRUD retraits |
| `PlatformSettingRepository.java` | CRUD paramètres |
| `AuthSessionRepository.java` | CRUD sessions auth |
| `AttestationRepository.java` | CRUD attestations |

### 2.7 DTO & Utilitaires

| Fichier | Rôle |
|---|---|
| `dto/LoginRequest.java` | DTO de connexion |
| `dto/RegistrationRequest.java` | DTO d'inscription |
| `util/InputValidator.java` | Validation des entrées |

### 2.8 WebSocket

| Fichier | Rôle |
|---|---|
| `websocket/ChatWebSocketHandler.java` | Handler WebSocket chat temps réel |

### 2.9 Ressources

| Fichier | Rôle |
|---|---|
| `application.yml` | Config Spring Boot (port, DB, JWT, Paymee) |
| `logback-spring.xml` | Config logging |

### 2.10 Tests

| Fichier | Rôle |
|---|---|
| `controller/AuthIdentityCheckTest.java` | Test identité auth |
| `controller/ChatControllerTest.java` | Test chat controller |

### 2.11 Build

| Fichier | Rôle |
|---|---|
| `pom.xml` | Dépendances Maven (Spring Boot 3.2, OpenPDF 1.3.30, MySQL, JWT) |

---

## 3. Base de Données — `db/`

| Fichier | Rôle |
|---|---|
| `schema.sql` | Schéma initial complet |
| `schema_updated.sql` | Schéma mis à jour |
| `migration_2026_08_add_user_photo.sql` | Ajout photo utilisateur |
| `migration_2026_08_add_portfolio.sql` | Ajout portfolio |
| `migration_2026_08_add_rating.sql` | Ajout note/évaluation |
| `migration_2026_08_add_request_declines.sql` | Ajout refus de missions |
| `migration_2026_08_add_reservation_guards.sql` | Garde de réservation |
| `migration_2026_08_add_client_withdrawals.sql` | Retraits client |
| `migration_2026_08_add_withdrawals.sql` | Retraits technicien |
| `migration_2026_08_add_kyc_documents.sql` | Documents KYC |
| `migration_2026_08_add_notifications.sql` | Notifications |
| `migration_2026_08_add_platform_settings.sql` | Paramètres plateforme |
| `migration_2026_08_add_payment_url.sql` | URL de paiement |
| `migration_2026_08_add_chat_read.sql` | Indicateur de lecture chat |
| `migration_2026_08_add_chat_dispute.sql` | Litiges chat |
| `migration_2026_08_add_dispute_reporter.sql` | Signaleur de litige |
| `migration_2026_08_add_auth_sessions.sql` | Sessions d'authentification |
| `migration_2026_08_add_auth_sessions_expiry.sql` | Expiration sessions |
| `migration_2026_08_add_suspensions.sql` | Suspensions |
| `migration_2026_08_add_attestations.sql` | Attestations de service |

---

## 4. Microservice Node.js — `server/`

| Fichier | Rôle |
|---|---|
| `paymee.js` | Serveur Express pour intégration Paymee |
| `payment-endpoint.example.js` | Exemple endpoint paiement |
| `.env.example` | Variables d'environnement |

---

## 5. Déploiement — `deploy/`

| Fichier | Rôle |
|---|---|
| `nginx.conf` | Config Nginx (reverse proxy) |
| `migrate-db.sh` | Script migration BDD |
| `backup-db.sh` | Script backup BDD |
| `mboa-tech.service` | Service systemd Linux |
| `mboa-tech.env.example` | Variables d'environnement prod |
| `.env.production.example` | Config production |

---

## 6. Flux principal Attestation

```
Frontend (T1Dashboard.tsx)
  → useAttestation.ts (hook)
    → GET /api/attestation/check    → AttestationController → AttestationService.checkEligibility()
    → POST /api/attestation/generate → AttestationController → AttestationService.generate() → generatePdf()
    → GET /api/attestation/history   → AttestationController → AttestationService.getHistory()

PDF généré via OpenPDF (PdfContentByte) :
  Fond crème → Cadre doré → Coins floraux → Motifs circuit
  → Titre → Divider → Paragraphe → Tableau encadré
  → Signatures doubles → Sceau bouclier arc text
```

---

## 7. Dépendances Clés

### Frontend
- **React 19** + React DOM 19
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **Vite 8** + TypeScript 5.7

### Backend
- **Spring Boot 3.2** (Java 17)
- **OpenPDF 1.3.30** (génération PDF — API spécifique : `setColorStroke()`, `circle(x,y,r)`, `drawRoundedRect()` custom)
- **MySQL 8.2** (WampServer)
- **Spring Security** + JWT (filtre token)
- **Spring WebSocket** (chat temps réel)
