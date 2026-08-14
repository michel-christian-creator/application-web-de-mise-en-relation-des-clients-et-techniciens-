# MboaTech MySQL Database

Ce dossier contient le schéma de base de données MySQL pour le backend MboaTech.

## Comment créer la base

1. Ouvrir MySQL ou MariaDB.
2. Exécuter le script SQL :

```sql
SOURCE db/schema_updated.sql;
```

ou depuis le terminal :

```bash
mysql -u root -p < db/schema_updated.sql
```

## Structure principale

- `users` : comptes de base partagés par tous les utilisateurs, avec un champ `role`.
- `clients` : données spécifiques aux clients.
- `technicians` : données spécifiques aux techniciens/artisans.
- `admins` : données des administrateurs et des rôles administratifs.
- `service_requests` : demandes d'intervention et leur état.
- `chat_messages` : messages échangés autour d'une demande.
- `payments` : paiements tenus en séquestre et leur statut.
- `documents` : fichiers de vérification KYC, certifications et lettres de recommandation.
- `disputes` : litiges ouverts sur une demande.

## Logique d'inscription

1. `client` :
   - Créer un enregistrement dans `users` avec `role = 'client'`.
   - Créer le profil associé dans `clients` avec `user_id` pointant vers `users.id`.

2. `technician` :
   - Créer un enregistrement dans `users` avec `role = 'technician'`.
   - Créer le profil associé dans `technicians` avec `user_id` pointant vers `users.id`.

3. `admin` :
   - Autoriser l'enregistrement uniquement si l'identifiant et le mot de passe correspondent aux informations administrateur prédéfinies.
   - Créer un enregistrement dans `users` avec `role = 'admin'`.
   - Créer le profil associé dans `admins` avec `user_id` pointant vers `users.id`.

## Exemple d’insertion admin

Le mot de passe admin doit être géré en backend et stocké sous forme de hash sécurisé.

```sql
INSERT INTO users (username, email, password_hash, first_name, last_name, role)
VALUES ('admin', 'admin@example.com', '<hash_du_mot_de_passe_admin>', 'Admin', 'N/A', 'admin');

INSERT INTO admins (user_id, role_name)
VALUES (LAST_INSERT_ID(), 'admin');
```

Le reste des informations de l’admin peut être rempli librement, mais le nom `admin` et le mot de passe doivent rester ceux du compte prédéfini.

## Notes

- Les mots de passe doivent être stockés de façon sécurisée avec un hash côté backend.
- Les relations entre tables utilisent InnoDB pour les clés étrangères.
- `charset` et `collation` sont définis pour `utf8mb4` afin de supporter les caractères accentués.

## Suivant

Après avoir créé la base, nous pourrons démarrer le backend Java en connectant cette base au serveur et en exposant des API REST pour l’authentification, les demandes et les paiements.
