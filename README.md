# Mini-projet 2 : AgriIrrigation sur Kubernetes (k3s)

Application trois niveaux (frontend, API REST, base PostgreSQL) que l'on fait
passer d'un projet « qui marche sur mon poste » à un service exploitable sur un
cluster k3s : configuration externalisée, secrets protégés, données
persistantes et sauvegardées, ressources maîtrisées, surface d'attaque réduite.

Cours : Orchestration de conteneurs avec Kubernetes (k3s), Master DevOps & Cloud,
ISET Tozeur. Le détail des preuves (captures, sorties de commandes, réponses aux
questions) se trouve dans [docs/rapport-notes.md](docs/rapport-notes.md).

## Sommaire
1. Application
2. Architecture
3. Structure du dépôt
4. Lancer l'application en local
5. Configuration de l'API
6. Images
7. Déploiement sur Kubernetes
8. Avancement par exigence
9. Sécurité du dépôt
10. Tests
11. Procédure de restauration

## 1. Application
AgriIrrigation permet de gérer des parcelles agricoles et de planifier leurs
arrosages. Chaque entité offre un CRUD complet :
- parcelles : créer, lister, supprimer
- arrosages : planifier, lister, enregistrer la consommation réelle (avec
  calcul de l'écart avec le volume prévu), supprimer

Points de contrôle de l'API :
- `GET /health` : le processus répond (toujours 200)
- `GET /ready` : 200 seulement si la base répond, sinon 503

Les logs sont écrits sur la sortie standard.

![Interface](docs/captures/localhost-8081.png)
![Ajout](docs/captures/interface-ajout.png)
![Suppression](docs/captures/crud-supprimer.png)

## 2. Architecture

    Navigateur -> frontend (nginx, 8080) --/api/--> API Node/Express (3000) -> PostgreSQL (5432)

| Composant | Technologie | Dossier |
|-----------|-------------|---------|
| Frontend | HTML/JS servi par nginx-unprivileged | app/frontend |
| API | Node.js 20, Express, pg | app/api |
| Base | PostgreSQL 16 (image officielle) | k8s/20-db |

Seul le frontend sera exposé par l'Ingress (phase 6) ; il relaie les appels
`/api/` vers l'API, de l'intérieur du cluster. La base n'est joignable que par
l'API et par le job de sauvegarde (NetworkPolicies, phase 10).

Choix : l'authentification JWT du projet d'origine a été retirée pour se
concentrer sur l'exploitation Kubernetes, et la route `DELETE /arrosages/:id`
a été ajoutée pour obtenir un CRUD complet.

## 3. Structure du dépôt

    app/api/              code, tests Jest et Dockerfile de l'API
    app/frontend/         interface web et Dockerfile
    dev/                  configuration nginx pour le test local (Compose)
    k8s/00-namespace/     namespace, ResourceQuota, LimitRange
    k8s/10-config/        ConfigMap ; modèle de Secret dans examples/
    k8s/20-db/            Service headless et StatefulSet PostgreSQL
    k8s/30-app/           API, frontend, Ingress (à venir)
    k8s/40-security/      RBAC, NetworkPolicies (à venir)
    docs/                 rapport et captures
    docker-compose.yml    lancement local des trois services
    .env.example          modèle des variables (le vrai .env n'est jamais versionné)

## 4. Lancer l'application en local (Docker Compose)

Prérequis : Docker Desktop démarré (attendre « Engine running »). Node.js 20 ou
plus n'est nécessaire que pour les tests.

1. Créer le fichier de configuration à partir du modèle, puis y mettre un mot de
   passe de test personnel :

       Copy-Item .env.example .env

2. Construire et démarrer db, api et frontend :

       docker compose up --build -d

3. Vérifier les services : `docker compose ps`
4. Ouvrir l'interface : http://localhost:8081
5. Vérifier l'API : `curl.exe http://localhost:8081/api/ready`

Arrêter et relancer :

       docker compose down        # arrête, les données restent dans le volume dbdata
       docker compose up -d       # relance sans reconstruire

Attention : `docker compose down -v` supprime le volume et donc toutes les
données. À n'utiliser que pour repartir d'une base neuve. C'est nécessaire si
le mot de passe de `.env` change après un premier démarrage, car PostgreSQL
conserve l'ancien mot de passe dans ses données (erreur `password
authentication failed`).

## 5. Configuration de l'API
Toute la configuration passe par des variables d'environnement, sans valeur par
défaut : l'API refuse de démarrer si l'une manque.

| Variable | Rôle | Source dans Kubernetes |
|----------|------|------------------------|
| DB_HOST, DB_PORT | adresse de la base | ConfigMap `app-config` |
| DB_NAME | nom de la base | ConfigMap `app-config` |
| API_PORT | port d'écoute de l'API | ConfigMap `app-config` |
| DB_USER, DB_PASSWORD | identifiants (jamais dans le code ni dans l'image) | Secret `db-credentials` |

## 6. Images

| Composant | Image | Base | Utilisateur |
|-----------|-------|------|-------------|
| API | feridsaad/agri-api:1.0.0 | node:20-alpine | node (non-root, uid 1000) |
| Frontend | feridsaad/agri-frontend:1.0.0 | nginxinc/nginx-unprivileged:1.27-alpine | nginx (non-root, port 8080) |
| Base | postgres:16-alpine | image officielle | utilisateur de l'image |

- Images publiques sur Docker Hub, versionnées (jamais `latest`).
- Aucun secret dans les images ; `.dockerignore` exclut `node_modules`, `tests`
  et `.git`.

Construction et publication :

    docker build -t feridsaad/agri-api:1.0.0 app/api
    docker build -t feridsaad/agri-frontend:1.0.0 app/frontend
    docker push feridsaad/agri-api:1.0.0
    docker push feridsaad/agri-frontend:1.0.0

Preuves : utilisateurs non-root, tag 1.0.0 sur Docker Hub, et Pods `Running` sur
worker1, worker2 et master.

![Non-root](docs/captures/non-root.png)
![Docker Hub](docs/captures/duckerhub.png)
![Pods sur les trois nœuds](docs/captures/pod-test-sur-les-autres-noeuds.png)

## 7. Déploiement sur Kubernetes (k3s)

Prérequis : cluster k3s à 3 nœuds (master, worker1, worker2). Toutes les commandes
`kubectl` se lancent depuis le **master** (l'API Kubernetes n'écoute que là).
Après un arrêt des VM, démarrer le master d'abord, attendre une à deux minutes,
puis vérifier avec `kubectl get nodes`.

Récupérer le dépôt sur le master :

    git clone https://github.com/ferid-saad/agri-k8s-miniprojet2.git
    cd agri-k8s-miniprojet2

Les manifestes sont rangés par dossier et appliqués dans l'ordre. Les fichiers
d'un dossier sont préfixés (00, 10, 20) car `kubectl apply -f <dossier>` les
applique par ordre alphabétique.

| Étape | Dossier | Contenu | Commande |
|-------|---------|---------|----------|
| 1 | k8s/00-namespace | namespace `agri`, ResourceQuota, LimitRange | `kubectl apply -f k8s/00-namespace/` |
| 2 | k8s/10-config | ConfigMap `app-config` et Secret `db-credentials` | voir ci-dessous |
| 3 | k8s/20-db | Service headless et StatefulSet PostgreSQL | `kubectl apply -f k8s/20-db/` |
| 4 | k8s/30-app | API, frontend, Ingress | à venir (phases 5 et 6) |
| 5 | k8s/40-security | RBAC, NetworkPolicies | à venir (phases 9 et 10) |

### Étape 1 : namespace, quotas et limites (phase 2)
Namespace dédié `agri`, avec :
- ResourceQuota `agri-quota` : 2 CPU et 2 Gi de requêtes, 4 CPU et 4 Gi de
  limites, 15 Pods, 4 PVC
- LimitRange `agri-limits` : un conteneur sans `resources` reçoit par défaut
  50m/64Mi de requêtes et 200m/256Mi de limites

Vérification :

    kubectl get ns agri
    kubectl describe quota -n agri
    kubectl describe limitrange -n agri

Un Pod qui dépasse le quota est refusé à la création (erreur `exceeded quota`) :
il n'existe pas, il n'attend pas en `Pending`.

![Quota et LimitRange](docs/captures/quota-limitrange.png)
![Dépassement de quota](docs/captures/depassement-de-quota.png)

### Étape 2 : ConfigMap et Secret (phase 3)
Le ConfigMap se déploie directement :

    kubectl apply -f k8s/10-config/

Le Secret n'est **jamais** versionné. Il est créé à la main sur le master, avec
un mot de passe choisi pour le cluster (différent de celui du `.env` local) :

    kubectl create secret generic db-credentials -n agri \
      --from-literal=POSTGRES_USER=agri \
      --from-literal=POSTGRES_PASSWORD='<mot-de-passe>'

Un modèle aux fausses valeurs est versionné dans
`k8s/10-config/examples/secret.example.yaml`. Il est rangé dans `examples/`
pour ne jamais être appliqué par erreur (`apply -f` n'est pas récursif) : il
écraserait le vrai Secret par `changeme`.

Vérification :

    kubectl get configmap,secret -n agri
    kubectl describe configmap app-config -n agri

Un Secret n'est pas chiffré : il est seulement encodé en base64, donc lisible
par quiconque peut le lire via l'API. Pour qu'il reste confidentiel : RBAC
(phase 9), chiffrement au repos dans etcd, aucun versionnement.

![ConfigMap et Secret](docs/captures/configmap-secret.png)

### Étape 3 : base de données (phase 4)
    kubectl apply -f k8s/20-db/
    kubectl get pods,pvc,svc -n agri

- Service headless `db` (`clusterIP: None`) : nom DNS stable utilisé dans
  `DB_HOST`
- StatefulSet `db` : 1 réplica, `postgres:16-alpine`, identifiants lus depuis le
  Secret et le ConfigMap, readiness probe `pg_isready`, requests 100m/256Mi et
  limits 500m/512Mi
- `PGDATA` placé dans un sous-dossier du point de montage, sinon PostgreSQL
  refuse de démarrer sur un volume qui contient `lost+found`
- Volume : PVC `data-db-0` (1Gi, ReadWriteOnce, StorageClass `local-path`) créé
  par `volumeClaimTemplates`
- Labels du Pod : `app: agri`, `tier: db` (utilisés par les NetworkPolicies)

Résultat attendu : `db-0` en `1/1 Running`, PVC `data-db-0` en `Bound`, service
`db` avec `CLUSTER-IP None`.

![Pods, PVC et Service](docs/captures/pods-pvc-svc.png)

Test de connexion :

    kubectl exec -it db-0 -n agri -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\conninfo"'

Pourquoi un StatefulSet plutôt qu'un Deployment : identité stable (`db-0`), nom
DNS stable via le Service headless, et un volume propre à chaque Pod, rattaché
de nouveau au même Pod après une suppression.

### Étapes suivantes (à compléter au fil des phases)
- Phase 5 : déploiement de l'API (2 réplicas, init container, sondes
  `/ready` et `/health`) et du frontend (configuration nginx dans un ConfigMap)
- Phase 6 : Ingress sur `app.k3s.local`
- Phase 7 : preuve de persistance (suppression de `db-0`)
- Phase 8 : CronJob de sauvegarde
- Phase 9 : RBAC
- Phase 10 : durcissement des Pods et NetworkPolicies

## 8. Avancement par exigence

| N° | Exigence | État |
|----|----------|------|
| E1 | Images versionnées, accessibles à tous les nœuds | fait (phase 1) |
| E2 | Namespace, ResourceQuota, LimitRange | fait (phase 2) |
| E3 | ConfigMap et Secret | fait (phase 3) |
| E4 | Aucun secret réel dans Git | fait (voir section 9) |
| E5 | StatefulSet et Service headless | fait (phase 4) |
| E6 | Persistance après suppression du Pod | à venir (phase 7) |
| E7 | L'API attend la base | à venir (phase 5) |
| E8 | requests et limits | base faite, API et frontend à venir |
| E9 | Sondes readiness et liveness | endpoints prêts, sondes à venir (phase 5) |
| E10 | Seul le frontend exposé par l'Ingress | à venir (phase 6) |
| E11 | CronJob de sauvegarde et restauration | à venir (phase 8) |
| E12 | RBAC | à venir (phase 9) |
| E13 | Durcissement des Pods | images non-root faites, reste à venir (phase 10) |
| E14 | NetworkPolicies | à venir (phase 10) |
| E15 | Dépôt Git et README | en cours |

## 9. Sécurité du dépôt
- `.env` et `secret.yaml` sont ignorés par Git
- `.env.example` et `secret.example.yaml` ne contiennent que de fausses valeurs
- Aucun secret réel dans le code, les manifestes ou les images
- Incident : un fichier `.env` contenant un mot de passe de test a été versionné
  par erreur au début du projet. Il a été retiré du suivi, le mot de passe a été
  changé et n'est plus utilisé, ni en local ni dans le cluster. Il reste visible
  dans l'historique Git : c'est pourquoi un mot de passe ne doit jamais être
  réutilisé après avoir été committé.

## 10. Tests

    cd app/api
    npm install
    npx jest

3 suites, 20 tests : la base est simulée, aucune dépendance externe.

![Tests Jest](docs/captures/test-jest.png)

## 11. Procédure de restauration
(à compléter à la phase 8)