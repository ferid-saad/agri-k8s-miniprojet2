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


  ![ajout](./captures/interface-ajout.png)


  ![supprimer](./captures/crud-supprimer.png)

  - Point de contrôle : création, lecture, modification (consommation réelle) et
  suppression d'une parcelle et d'un arrosage vérifiées depuis l'interface, en
  local, avec Docker Compose (captures : docs/captures/crud-modification.png,
  docs/captures/crud-suppression.png)
- Lancement des trois services : `docker compose up --build -d` ; API en non-root
  (`id` -> uid=1000(node))
- Difficulté : port 8081 déjà occupé par un conteneur de test, qui causait une
  erreur 502 ; résolu en arrêtant ce conteneur et en recréant le frontend.

- Question : pourquoi un secret ne doit-il jamais figurer dans le code ni dans l'image ?
  Réponse : le code est versionné et partagé, et une image peut être récupérée
  par quiconque y a accès. Un secret qui y figure reste lisible dans
  l'historique Git ou dans les couches de l'image, même après suppression.
  On l'injecte donc à l'exécution (variables d'environnement, Secret Kubernetes).
- Difficultés : lancer les commandes depuis le bon dossier ; Docker Desktop non
  démarré ; dossier d'origine rattaché au dépôt du projet semestriel, d'où un
  nouveau dépôt Git dédié.

## 3. Phase 1 : conteneuriser et publier

### Images
| Composant | Image | Base | Utilisateur |
|-----------|-------|------|-------------|
| API | feridsaad/agri-api:1.0.0 | node:20-alpine | node (non-root) |
| Frontend | feridsaad/agri-frontend:1.0.0 | nginxinc/nginx-unprivileged:1.27-alpine | nginx (non-root), port 8080 |
| Base | postgres:16-alpine | image officielle | utilisateur de l'image |

- Les images sont versionnées (tag 1.0.0), jamais `latest` (exigence E1).
- Publication : Docker Hub, dépôts publics (option A du §6). Les nœuds k3s
  récupèrent les images par Internet, sans identifiants.
- Un fichier `.dockerignore` exclut `node_modules`, `tests` et `.git` du
  contexte de construction de l'API.
- Aucun secret dans les images : la configuration est injectée à l'exécution
  par variables d'environnement.

### Construction et vérification
```
docker build -t feridsaad/agri-api:1.0.0 app/api
docker build -t feridsaad/agri-frontend:1.0.0 app/frontend
docker run --rm --entrypoint id feridsaad/agri-api:1.0.0
docker run --rm --entrypoint id feridsaad/agri-frontend:1.0.0
docker push feridsaad/agri-api:1.0.0
docker push feridsaad/agri-frontend:1.0.0
```
- Sortie de `id` pour l'API : (à coller, attendu uid=1000(node))
- Sortie de `id` pour le frontend : (à coller, attendu uid=101(nginx))

![non-root](./captures/non-root.png)

- Capture Docker Hub avec le tag 1.0.0 : 

![Dockerhub1.0.0](./captures/duckerhub.png)

### Point de contrôle : l'image est accessible à tous les nœuds
Un Pod du frontend a été forcé sur chaque nœud avec `--overrides` (nodeName) :
```
kubectl run test-front  --image=feridsaad/agri-frontend:1.0.0 --restart=Never
kubectl run test-w2     --image=feridsaad/agri-frontend:1.0.0 --restart=Never \
  --overrides='{"spec":{"nodeName":"worker2"}}'
kubectl run test-master --image=feridsaad/agri-frontend:1.0.0 --restart=Never \
  --overrides='{"spec":{"nodeName":"master"}}'
kubectl get pods -o wide
```
Résultat : les trois Pods sont `Running` (1/1), sur worker1, worker2 et master.

| Pod | Nœud | Statut |
|-----|------|--------|
| test-front | worker1 | Running |
| test-w2 | worker2 | Running |
| test-master | master | Running |

Capture : ![Runnig sur les autres noeuds](/docs/captures/pod-test-sur-les-autres-noeuds.png)

Image de l'API : un Pod de test a bien téléchargé l'image (événement
« Successfully pulled »). Il s'arrête ensuite en erreur de démarrage, ce qui est
attendu : l'API refuse de démarrer sans ses variables d'environnement `DB_*`
(à confirmer par la sortie de `kubectl describe pod test-api`). Les Pods de
test ont ensuite été supprimés.

### Question : imagePullPolicy Always ou IfNotPresent, et risque du tag latest ?
- `Always` interroge le registre à chaque démarrage de Pod : l'image est
  vérifiée à chaque fois, mais le démarrage est plus lent et dépend du réseau
  et de la disponibilité du registre.
- `IfNotPresent` réutilise l'image déjà présente sur le nœud, ce qui est plus
  rapide et fonctionne sans réseau, mais ne détecte pas une image modifiée sous
  le même tag.
- Le tag `latest` est mobile : il peut désigner des contenus différents selon
  le moment et selon le nœud qui a téléchargé l'image. Les déploiements
  deviennent non reproductibles, un retour en arrière est difficile, et deux
  Pods du même Deployment peuvent exécuter des versions différentes. Kubernetes
  applique d'ailleurs `Always` par défaut avec `latest`. Un tag de version fixe
  garantit que tous les nœuds exécutent exactement la même image.

### Difficultés rencontrées
- `kubectl` lancé depuis un worker : refus de connexion, car l'API Kubernetes ne
  tourne que sur le master.
- (compléter si besoin)

## 4. Phase 2 : Namespace, quotas et limites (séance 1)

- `kubectl describe quota -n agri` :
```
Resource                Used  Hard
limits.cpu              0     4
limits.memory           0     4Gi
persistentvolumeclaims  0     4
pods                    0     15
requests.cpu            0     2
requests.memory         0     2Gi
```
- `kubectl describe limitrange -n agri` : défauts memory 64Mi / 256Mi, cpu 50m / 200m

![quotas-limitrange](./captures/quota-limitrange.png)

Pod sans resources (valeurs ajoutées par le LimitRange) :
```
{"limits":{"cpu":"200m","memory":"256Mi"},"requests":{"cpu":"50m","memory":"64Mi"}}
```
Le quota a alors enregistré : requests.cpu 50m, requests.memory 64Mi,
limits.cpu 200m, limits.memory 256Mi, pods 1.

Dépassement de quota :
```
Error from server (Forbidden): pods "trop-gros" is forbidden: exceeded quota:
agri-quota, requested: limits.cpu=5,requests.cpu=3, used: limits.cpu=0,
requests.cpu=0, limited: limits.cpu=4,requests.cpu=2
```
`kubectl get pods -n agri` : « No resources found » (le Pod n'a pas été créé).
![Depassement](./captures/depassement-de-quota.png)

## 5. Phase 3 : Phase 3 : ConfigMap et Secret


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