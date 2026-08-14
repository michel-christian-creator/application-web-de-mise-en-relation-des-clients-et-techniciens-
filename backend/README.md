# MboaTech Backend

Ce backend Java Spring Boot gère l'inscription automatique des clients, techniciens et administrateurs.

## Installation

1. Assure-toi que MySQL/WAMP est lancé et que la base `mboatech` existe.
2. Vérifie que le fichier `db/schema_updated.sql` a bien été importé.
3. Depuis `backend/`, exécute :

```bash
mvn clean package
```

## Configuration

Le fichier `src/main/resources/application.yml` contient :

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mboatech?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
    username: root
    password: ""
  jpa:
    hibernate:
      ddl-auto: none
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.MySQL8Dialect
server:
  port: 8080

admin:
  username: admin
  password: admin123
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

L'API est accessible sur `http://localhost:8080/api/register`.
