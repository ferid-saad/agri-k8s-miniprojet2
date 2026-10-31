# agri-irrigation-service

Microservice de gestion des parcelles et des arrosages du projet **AgriIrrigation**, une application de suivi de l'irrigation agricole à architecture microservices.

Projet semestriel du Master DevOps & Cloud, ISET Tozeur, année universitaire 2026 / 2027.

## Rôle dans l'architecture

| Service | Rôle | Dépôt |
|---|---|---|
| auth-service | Inscription, connexion, jetons JWT | `agri-auth-service` |
| **irrigation-service** (ce dépôt) | Parcelles, planning d'arrosage, consommation d'eau | `agri-irrigation-service` |
| reporting-service | Statistiques et historique de consommation | `agri-reporting-service` |

Chaque service a son propre dépôt et sa propre base de données. Les manifests Kubernetes de l'ensemble sont dans le dépôt `agri-gitops`.

irrigation-service ne gère aucun mot de passe : il **vérifie les jetons JWT** émis par auth-service, avec un secret partagé, sans jamais appeler auth-service.

## Technologies

- Node.js 24 et Express
- PostgreSQL 16 (base `irrigation_db`)
- jsonwebtoken pour la vérification des jetons JWT
- Jest et Supertest pour les tests

## Prérequis

- Git
- Node.js 18 ou plus récent, et npm
- Docker (pour PostgreSQL en local)
- auth-service en fonctionnement, pour obtenir un jeton

## Installation

```bash
git clone https://github.com/ferid-saad/agri-irrigation-service.git
cd agri-irrigation-service
npm install
```

## Base de données

Le service utilise la même instance PostgreSQL que les autres services, avec sa propre base `irrigation_db`. Si le conteneur n'existe pas encore (port local 5433) :

```bash
docker run -d --name agri-postgres \
  -e POSTGRES_USER=agri \
  -e POSTGRES_PASSWORD=agri123 \
  -p 5433:5432 \
  -v agri-pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

docker exec agri-postgres psql -U agri -c "CREATE DATABASE irrigation_db;"
```

Les tables `parcelles` et `arrosages` sont créées automatiquement au démarrage du service.

| Table | Colonnes principales |
|---|---|
| `parcelles` | `id`, `user_id`, `nom`, `surface_ha`, `culture` |
| `arrosages` | `id`, `parcelle_id` (clé étrangère vers `parcelles`), `user_id`, `date_arrosage`, `duree_min`, `volume_l` |

> Les identifiants ci-dessus ne servent qu'au développement local. En production, ils sont fournis par un ConfigMap et un Secret Kubernetes.

## Configuration

| Variable | Description | Valeur par défaut |
|---|---|---|
| `PORT` | Port d'écoute du service | `3001` |
| `DB_HOST` | Hôte PostgreSQL | `localhost` |
| `DB_PORT` | Port PostgreSQL | `5433` |
| `DB_USER` | Utilisateur PostgreSQL | `agri` |
| `DB_PASSWORD` | Mot de passe PostgreSQL | `agri123` |
| `DB_NAME` | Nom de la base | `irrigation_db` |
| `JWT_SECRET` | Secret de vérification des jetons JWT | `dev-secret-change-me` (développement uniquement) |

> `JWT_SECRET` doit avoir **exactement la même valeur** que dans auth-service, sinon tous les jetons sont refusés. Dans Kubernetes, il sera stocké dans un Secret.

## Lancer le service

```bash
npm start
```

Le service écoute sur `http://localhost:3001`.

## Authentification

Les routes `/parcelles` et `/arrosages` exigent un jeton JWT obtenu auprès d'auth-service, envoyé dans l'en-tête :

```
Authorization: Bearer <token>
```

Obtenir un jeton (auth-service doit tourner sur le port 3000) :

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/login -ContentType "application/json" -Body '{"email":"ali@mail.com","password":"secret123"}'
$h = @{Authorization="Bearer $($r.token)"}
```

Sans jeton, ou avec un jeton invalide ou expiré, le service répond `401`.

## API

### `GET /health`

Vérifie que le service est opérationnel (utilisé plus tard par les sondes Kubernetes).

```bash
curl http://localhost:3001/health
```

Réponse `200` :

```json
{ "status": "ok", "service": "irrigation-service" }
```

### `POST /parcelles`

Crée une parcelle pour l'utilisateur du jeton. Le `user_id` vient du jeton, jamais du corps de la requête.

Corps de la requête :

```json
{ "nom": "Parcelle Nord", "surface_ha": 2.5, "culture": "Tomates" }
```

Exemple sous PowerShell :

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/parcelles -Headers $h -ContentType "application/json" -Body '{"nom":"Parcelle Nord","surface_ha":2.5,"culture":"Tomates"}'
```

| Code | Signification |
|---|---|
| `201` | Parcelle créée, la réponse contient `id`, `nom`, `surface_ha` et `culture` |
| `400` | `nom`, `culture` ou `surface_ha` (supérieure à 0) manquant ou invalide |
| `401` | Jeton absent ou invalide |
| `500` | Erreur serveur |

### `POST /arrosages`

Planifie un arrosage sur une parcelle de l'utilisateur.

Corps de la requête :

```json
{ "parcelle_id": 1, "date_arrosage": "2026-11-02", "duree_min": 45, "volume_l": 600 }
```

Exemple sous PowerShell :

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/arrosages -Headers $h -ContentType "application/json" -Body '{"parcelle_id":1,"date_arrosage":"2026-11-02","duree_min":45,"volume_l":600}'
```

| Code | Signification |
|---|---|
| `201` | Arrosage créé, la réponse contient `id`, `parcelle_id`, `date_arrosage`, `duree_min` et `volume_l` |
| `400` | Données manquantes ou invalides (`date_arrosage` au format `AAAA-MM-JJ`, durée et volume supérieurs à 0) |
| `401` | Jeton absent ou invalide |
| `404` | Parcelle introuvable (inexistante ou appartenant à un autre utilisateur) |
| `500` | Erreur serveur |

## Tests

```bash
npm test
```

Les tests couvrent `GET /health`, ainsi que le refus des requêtes sans jeton, avec un jeton invalide ou avec des données incomplètes sur `/parcelles` et `/arrosages`.

## Sécurité

- Vérification de la signature et de l'expiration du jeton JWT sur chaque route protégée
- `user_id` pris dans le jeton vérifié, jamais dans le corps de la requête
- Contrôle que la parcelle appartient à l'utilisateur avant d'enregistrer un arrosage
- Requêtes SQL paramétrées (protection contre l'injection SQL)
- Validation des entrées
- Secret JWT fourni par variable d'environnement ; la valeur par défaut du code ne sert qu'en développement

## Structure du projet

```
agri-irrigation-service/
├── src/
│   ├── app.js                # Application Express et routes
│   ├── server.js             # Démarrage du serveur
│   ├── db.js                 # Connexion PostgreSQL et création des tables
│   ├── middleware/
│   │   └── auth.js           # Vérification du jeton JWT
│   └── routes/
│       ├── parcelles.js      # POST /parcelles
│       └── arrosages.js      # POST /arrosages
├── tests/
│   ├── health.test.js
│   ├── parcelles.test.js
│   └── arrosages.test.js
├── package.json
└── README.md
```

## Workflow Git

| Branche | Usage |
|---|---|
| `main` | Code stable |
| `develop` | Intégration |
| `feature/SCRUM-<n>-<description>` | Une branche par ticket Jira |

Chaque fonctionnalité est intégrée dans `develop` par une pull request relue. Les messages de commit commencent par la clé du ticket Jira, par exemple `SCRUM-11: table arrosages et route POST /arrosages`.

## Avancement

| Ticket | User story | État |
|---|---|---|
| SCRUM-10 | Ajouter une parcelle | Terminé |
| SCRUM-11 | Planifier un arrosage | Terminé |
| SCRUM-12 | Enregistrer la consommation d'eau réelle | À faire |
| SCRUM-13 | Consulter la liste des parcelles et des arrosages | À faire |

Étapes suivantes de la chaîne DevOps : Dockerfile, pipeline CI avec scan Trivy, déploiement Kubernetes, GitOps avec ArgoCD, supervision avec Prometheus et Grafana.

## Auteur

Ferid Saad, Master DevOps & Cloud, ISET Tozeur.
