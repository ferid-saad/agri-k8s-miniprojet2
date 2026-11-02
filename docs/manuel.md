# Manuel : lancer l'application AgriIrrigation

Deux modes : **A. en local** (Docker Compose, pour tester vite) et **B. sur le
cluster k3s** (l'objectif du projet).

---

## A. En local avec Docker Compose

### Prérequis
- Docker Desktop installé, démarré, moteur prêt (« Engine running »)
- Le dépôt cloné : `git clone https://github.com/ferid-saad/agri-k8s-miniprojet2.git`

### Premier lancement
```powershell
cd agri-k8s-miniprojet2
Copy-Item .env.example .env
```
Ouvrir `.env` et remplacer `changeme` par un mot de passe de test (sans `$` ni
guillemets). Puis :
```powershell
docker compose up --build -d
docker compose ps
```
Ouvrir **http://localhost:8081**. Vérification : `curl.exe http://localhost:8081/api/ready`
doit répondre `{"status":"ready"}`.

### Lancements suivants
```powershell
docker compose up -d       # relance, les données sont conservées
docker compose down        # arrête, les données restent dans le volume
```
**Ne jamais** ajouter `-v` sauf pour repartir d'une base vide : il supprime le
volume. C'est aussi la solution si le mot de passe de `.env` a changé après un
premier démarrage (erreur `password authentication failed`).

---

## B. Sur le cluster k3s

### Prérequis
- 3 VM : `master`, `worker1`, `worker2` (démarrer le **master en premier**, puis
  les workers ; attendre 1 à 2 minutes)
- Toutes les commandes `kubectl` se lancent **depuis le master**
- Vérifier le cluster : `kubectl get nodes` (trois nœuds `Ready`)

### 1. Récupérer le dépôt (première fois)
```bash
git clone https://github.com/ferid-saad/agri-k8s-miniprojet2.git
cd agri-k8s-miniprojet2
```
Mises à jour ensuite : `git pull --ff-only`.

### 2. Déployer, dans cet ordre
```bash
kubectl apply -f k8s/00-namespace/      # namespace, quota, limites
kubectl apply -f k8s/40-security/       # ServiceAccounts, compte de consultation
kubectl apply -f k8s/10-config/         # ConfigMap
```
Créer le Secret (jamais versionné), avec **votre** mot de passe :
```bash
kubectl create secret generic db-credentials -n agri \
  --from-literal=POSTGRES_USER=agri \
  --from-literal=POSTGRES_PASSWORD='<mot-de-passe>'
```
Puis la base, l'API et le frontend :
```bash
kubectl apply -f k8s/20-db/             # base PostgreSQL + sauvegarde
kubectl apply -f k8s/30-app/            # API, frontend, Ingress
kubectl get pods -n agri -w             # Ctrl+C quand tout est 1/1 Running
```
L'ordre compte : le namespace d'abord, les ServiceAccounts avant les Pods qui
les utilisent, le Secret avant la base.

### 3. Accéder à l'application
1. Récupérer l'IP du master : `kubectl get nodes -o wide`
2. Sous Windows, ouvrir le Bloc-notes **en administrateur** et ajouter à la fin
   de `C:\Windows\System32\drivers\etc\hosts` :
   ```
   <IP-du-master>   app.k3s.local
   ```
3. Ouvrir **http://app.k3s.local** (Ctrl+F5)

Test sans navigateur :
```bash
curl -s -H "Host: app.k3s.local" http://localhost/api/ready
```

### 4. Vérifications utiles
```bash
kubectl get pods,svc,pvc,ingress -n agri
kubectl logs deployment/api -n agri
kubectl describe quota -n agri
```
Attendu : `api` (2 Pods), `frontend`, `db-0` en `1/1 Running`, PVC