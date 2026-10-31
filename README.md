# Mini-projet 2 : AgriIrrigation sur Kubernetes (k3s)

Application trois niveaux (frontend, API REST, base PostgreSQL) que l'on fait
passer d'un projet « qui marche sur mon poste » à un service exploitable sur un
cluster k3s : configuration externalisée, secrets protégés, données
persistantes et sauvegardées, ressources maîtrisées, surface d'attaque réduite.

Cours : Orchestration de conteneurs avec Kubernetes (k3s), Master DevOps & Cloud,
ISET Tozeur.

## Application
AgriIrrigation permet de gérer des parcelles agricoles et de planifier leurs
arrosages. Chaque entité offre un CRUD complet :
- parcelles : créer, lister, supprimer
- arrosages : planifier, lister, enregistrer la consommation réelle, supprimer

## Architecture

    Navigateur -> frontend (nginx, 8080) --/api/--> API Node/Express (3000) -> PostgreSQL (5432)

| Composant | Technologie | Dossier |
|-----------|-------------|---------|
| Frontend | HTML/JS servi par nginx-unprivileged | app/frontend |
| API | Node.js 20, Express, pg | app/api |
| Base | PostgreSQL 16 | (image officielle) |

Seul le frontend est exposé ; il relaie les appels `/api/` vers l'API. La base
n'est joignable que par l'API.

## Structure du dépôt

    app/api/         code, tests Jest et Dockerfile de l'API
    app/frontend/    interface web et Dockerfile
    dev/             configuration nginx pour le test local
    docs/            notes du rapport et captures
    docker-compose.yml   lancement local des trois services
    .env.example     modèle des variables (le vrai .env n'est jamais versionné)

## Prérequis
- Docker Desktop (moteur démarré)
- Node.js 20 ou plus (seulement pour lancer les tests)

## Lancer l'application en local (trois services)

1. Créer le fichier de configuration à partir du modèle, puis y mettre un mot de
   passe de test personnel :

       Copy-Item .env.example .env

2. Construire et démarrer db, api et frontend :

       docker compose up --build -d

3. Vérifier les services : `docker compose ps`
4. Ouvrir l'interface : http://localhost:8081
5. Arrêter : `docker compose down` (données conservées dans le volume `dbdata`).
   Ajouter `-v` pour supprimer les données et repartir d'une base neuve.

Remarque : si le mot de passe de `.env` change après un premier démarrage, il
faut supprimer le volume (`docker compose down -v`), car PostgreSQL conserve
l'ancien mot de passe dans ses données.

## Configuration de l'API
Toute la configuration passe par des variables d'environnement, sans valeur par
défaut : l'API refuse de démarrer si l'une manque.

| Variable | Rôle |
|----------|------|
| DB_HOST, DB_PORT | adresse de la base |
| DB_NAME | nom de la base |
| DB_USER, DB_PASSWORD | identifiants (jamais dans le code ni dans l'image) |
| API_PORT | port d'écoute de l'API |

## Points de contrôle de l'API
- GET /health : le processus répond (toujours 200)
- GET /ready : 200 seulement si la base répond, sinon 503

Les logs sont écrits sur la sortie standard.

## Tests

    cd app/api
    npm install
    npx jest

3 suites, 20 tests (la base est simulée, aucune dépendance externe).

## Sécurité du dépôt
- `.env` et `secret.yaml` sont ignorés par Git
- `.env.example` et `secret.example.yaml` ne contiennent que de fausses valeurs
- aucun secret réel dans le code, les images ou l'historique

## Images

 ![interface](/docs/captures/localhost-8081.png)


  ![ajout](/docs/captures/interface-ajout.png)


  ![supprimer](/docs/captures/crud-supprimer.png)

## Déploiement sur Kubernetes
Ordre de déploiement : (à compléter au fil des phases 2 à 10)

## Procédure de restauration
(à compléter à la phase 8)