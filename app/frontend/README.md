# agri-frontend

Interface web du projet **AgriIrrigation**, une application de suivi de l'irrigation agricole à architecture microservices.

Projet semestriel du Master DevOps \& Cloud, ISET Tozeur, année universitaire 2026 / 2027.

## Rôle dans l'architecture

|Composant|Rôle|Dépôt|
|-|-|-|
|**agri-frontend** (ce dépôt)|Interface web et point d'entrée (Nginx)|`agri-frontend`|
|auth-service|Inscription, connexion, jetons JWT|`agri-auth-service`|
|irrigation-service|Parcelles, planning d'arrosage|`agri-irrigation-service`|
|reporting-service|Statistiques et historique|`agri-reporting-service`|

Les manifests Kubernetes de l'ensemble sont dans le dépôt `agri-gitops`.

L'interface est une page HTML, CSS et JavaScript pur, sans framework. Elle est servie par **Nginx**, qui joue aussi le rôle de reverse proxy : le navigateur ne connaît qu'une seule adresse, et Nginx redirige les appels vers les bons services. Cela évite le problème du CORS sans modifier les services. Dans Kubernetes, l'objet Ingress reprendra ce rôle de routage.

|Adresse appelée par le navigateur|Destination|
|-|-|
|`/`|Page web (fichiers statiques)|
|`/api/auth/...`|auth-service (port 3000)|
|`/api/irrigation/...`|irrigation-service (port 3001)|

## Fonctionnalités

* Inscription et connexion (le jeton JWT est conservé dans `sessionStorage`)
* Ajout d'une parcelle (nom, surface en hectares, culture)
* Planification d'un arrosage (numéro de parcelle, date, durée, volume)
* Messages de succès et d'erreur ; déconnexion automatique si le jeton a expiré (réponse `401`)

La consultation des parcelles et des arrosages viendra avec la story SCRUM-13 d'irrigation-service.

## Prérequis

* Git
* Docker (Docker Desktop doit être démarré)
* auth-service et irrigation-service en fonctionnement sur les ports 3000 et 3001, avec PostgreSQL

## Installation

```bash
git clone https://github.com/ferid-saad/agri-frontend.git
cd agri-frontend
```

## Lancer l'interface

Démarrer d'abord les deux services (`npm start` dans `agri-auth-service` et dans `agri-irrigation-service`), puis lancer Nginx dans le dossier `agri-frontend`.

Sous PowerShell :

```powershell
docker run -d --name agri-frontend -p 8080:80 -v "${PWD}\\\\\\\\public:/usr/share/nginx/html:ro" -v "${PWD}\\\\\\\\nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine
```

Sous Linux ou macOS :

```bash
docker run -d --name agri-frontend -p 8080:80 \\\\\\\\
  -v "$PWD/public:/usr/share/nginx/html:ro" \\\\\\\\
  -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \\\\\\\\
  nginx:alpine
```

Ouvrir ensuite **http://localhost:8080**.

Arrêter et supprimer le conteneur :

```bash
docker rm -f agri-frontend
```

> `host.docker.internal` (utilisé dans `nginx.conf`) désigne la machine hôte depuis le conteneur. Il fonctionne avec Docker Desktop. Un Dockerfile dédié et la configuration Kubernetes seront ajoutés aux étapes suivantes du projet.

## Scénario d'utilisation

1. Saisir un email et un mot de passe de 6 caractères minimum, puis cliquer sur **Créer un compte**.
2. Cliquer sur **Se connecter**.
3. Ajouter une parcelle : l'interface affiche son numéro.
4. Planifier un arrosage en indiquant ce numéro.

## Sécurité

* Les messages sont affichés avec `textContent` et non `innerHTML`, ce qui évite l'injection de code dans la page (XSS)
* Le jeton JWT est conservé dans `sessionStorage` : il disparaît à la fermeture de l'onglet (un cookie `HttpOnly` serait plus sûr en production)
* Les contrôles de sécurité restent côté serveur : l'interface ne remplace pas la vérification du jeton dans chaque service

## Structure du projet

```
agri-frontend/
├── public/
│   ├── index.html     # Page : connexion, parcelles, arrosages
│   ├── style.css      # Mise en forme
│   └── app.js         # Appels aux API, gestion du jeton
├── nginx.conf         # Fichiers statiques et reverse proxy
└── README.md
```

## Workflow Git

|Branche|Usage|
|-|-|
|`main`|Code stable|
|`develop`|Intégration|
|`feature/SCRUM-<n>-<description>`|Une branche par ticket Jira|

Chaque fonctionnalité est intégrée dans `develop` par une pull request relue. Les messages de commit commencent par la clé du ticket Jira, par exemple `SCRUM-23: interface web (connexion, parcelles, arrosages)`.

## Avancement

|Fonctionnalité (epic Interface)|État|
|-|-|
|Inscription et connexion depuis l'interface|Terminé|
|Ajout d'une parcelle et planification d'un arrosage|Terminé|
|Liste des parcelles et des arrosages|À faire (après SCRUM-13)|
|Consommation d'eau réelle|À faire (après SCRUM-12)|
|Dockerfile, pipeline CI avec Trivy, déploiement Kubernetes|À faire|

## Auteur

Ferid Saad, Master DevOps \& Cloud, ISET Tozeur.

