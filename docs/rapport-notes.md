# Notes du rapport

## 1. Application et architecture
AgriIrrigation : suivi de l'irrigation de parcelles agricoles.
- Entités : parcelles et arrosages (création, lecture, modification de la
  consommation réelle, suppression)
- Trois niveaux : frontend (HTML/JS + nginx), API REST (Node.js/Express),
  base PostgreSQL
- Schéma : (à insérer : navigateur, Ingress, frontend, API, base, CronJob)

## 2. Phase 0 : développement et test en local
- Choix : l'authentification JWT du projet d'origine est retirée pour se
  concentrer sur l'exploitation Kubernetes ; la route DELETE /arrosages/:id
  est ajoutée pour un CRUD complet.
- Configuration entièrement par variables d'environnement, sans valeur par défaut.
- Preuves :
  - /health -> {"status":"ok"} ; /ready -> {"status":"ready"}
  - CRUD vérifié : POST, GET, PATCH, DELETE -> 204, puis 404 au second appel

  ![ready](./captures/api-repond.png)
  
  - Tests Jest : 3 suites, 20 tests réussis
  
  ![Tests](./captures/test-jest.png)
  
  - Lancement des trois services : `docker compose up --build -d`
    (captures : docs/img/phase0-compose-ps.png, docs/img/phase0-interface.png)
  
  ![interface](./captures/localhost-8081.png)

- Question : pourquoi un secret ne doit-il jamais figurer dans le code ni dans l'image ?
  Réponse : le code est versionné et partagé, et une image peut être récupérée
  par quiconque y a accès. Un secret qui y figure reste lisible dans
  l'historique Git ou dans les couches de l'image, même après suppression.
  On l'injecte donc à l'exécution (variables d'environnement, Secret Kubernetes).
- Difficultés : lancer les commandes depuis le bon dossier ; Docker Desktop non
  démarré ; dossier d'origine rattaché au dépôt du projet semestriel, d'où un
  nouveau dépôt Git dédié.

## 3. Phase 1 : conteneuriser et publier
(à compléter)

## Tableau des exigences (preuves)
| N° | Exigence | Preuve |
|----|----------|--------|
| E1 | Images versionnées, accessibles à tous les nœuds | à compléter |
| E2 | Namespace, ResourceQuota, LimitRange | à compléter |
| E3 | ConfigMap et Secret | à compléter |
| E4 | Aucun secret dans Git | .env dans .gitignore, .env.example versionné |
| E5 | StatefulSet et Service headless | à compléter |
| E6 | Persistance après suppression du Pod | à compléter |
| E7 | L'API attend la base | à compléter |
| E8 | requests et limits | à compléter |
| E9 | Sondes readiness et liveness | /ready et /health existent (phase 0) |
| E10 | Seul le frontend est exposé par l'Ingress | à compléter |
| E11 | CronJob de sauvegarde et restauration | à compléter |
| E12 | ServiceAccount dédié, compte de consultation | à compléter |
| E13 | Durcissement des Pods | à compléter |
| E14 | NetworkPolicies | à compléter |
| E15 | Dépôt Git et README | ce dépôt |