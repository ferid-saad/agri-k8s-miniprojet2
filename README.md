# Mini-projet 2 : AgriIrrigation sur Kubernetes (k3s)

Application trois niveaux (frontend, API REST, PostgreSQL) déployée de façon
sécurisée et persistante sur un cluster k3s.

## Architecture
- app/frontend : interface HTML/JS servie par nginx-unprivileged (port 8080)
- app/api : API Node.js/Express (parcelles et arrosages), configuration par
  variables d'environnement, routes /health et /ready
- PostgreSQL : StatefulSet avec volume persistant (à venir)

## Prérequis
- Cluster k3s à 3 nœuds, kubectl configuré
- Docker Desktop (construction des images)
- Node.js 20 ou plus (tests locaux)

## Variables d'environnement de l'API
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, API_PORT
(aucune valeur par défaut : l'API refuse de démarrer si l'une manque)

## Lancer les tests
cd app/api && npm install && npx jest

## Ordre de déploiement
(à compléter au fil des phases)

## Procédure de restauration
(à compléter à la phase 8)