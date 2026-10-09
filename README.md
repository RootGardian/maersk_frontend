# Maersk Frontend

Ce dépôt contient le code source de l'application frontend Maersk, construite avec **React** et **Vite**.

## 🛠 Technologies

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Conteneurisation**: [Docker](https://www.docker.com/) & Docker Compose
- **Serveur Web**: [Nginx](https://nginx.org/) (pour la production)
- **Websockets**: Socket.io-client
- **Génération de Fichiers**: html2pdf.js, xlsx

## 📁 Structure du Projet

```
maersk_frontend/
├── docker-compose.yml       # Configuration Docker pour lancer le projet
└── frontend/
    ├── Dockerfile           # Fichier de build pour l'image Docker (multi-stage)
    ├── nginx.conf           # Configuration du serveur Nginx (routing SPA)
    ├── package.json         # Dépendances et scripts NPM
    ├── public/              # Fichiers statiques (images, favicon, etc.)
    ├── src/                 # Code source principal (composants React, vues, etc.)
    └── vite.config.js       # Configuration Vite
```

## 🚀 Démarrage Rapide

### Prérequis

- [Node.js](https://nodejs.org/) (version 20 recommandée)
- [Docker](https://www.docker.com/products/docker-desktop) et [Docker Compose](https://docs.docker.com/compose/)

### 1. Développement Local (sans Docker)

Si vous souhaitez développer localement en bénéficiant du *Hot Module Replacement* (HMR) :

```bash
cd frontend
# Installation des dépendances
npm install

# Lancement du serveur de développement
npm run dev
```
L'application sera accessible sur `http://localhost:5173`.

### 2. Démarrage avec Docker (Recommandé)

Pour faire tourner l'application dans un environnement isolé, similaire à celui de production (utilisant Nginx) :

1. Placez-vous à la racine du projet (où se trouve le `docker-compose.yml`).
2. Lancez la commande suivante :

```bash
docker-compose up -d --build
```

L'application sera compilée puis servie par Nginx et accessible à l'adresse : **`http://localhost:3000`**.

Pour arrêter les conteneurs :
```bash
docker-compose down
```

## 📜 Scripts NPM Disponibles

Dans le dossier `frontend`, vous pouvez exécuter :

- `npm run dev` : Lance le serveur de développement Vite.
- `npm run build` : Compile l'application pour la production dans le dossier `dist`.
- `npm run lint` : Vérifie le code avec Oxlint.
- `npm run preview` : Lance un serveur web local pour prévisualiser le build de production.

## 🐳 Détails de la Conteneurisation

L'application utilise un **build multi-stage** Docker pour optimiser l'image de production :
1. **Stage 1 (Build)** : Utilise l'image `node:20-alpine` pour installer les dépendances, et exécuter la commande `npm run build` qui génère les fichiers statiques de l'application dans le dossier `dist`.
2. **Stage 2 (Production)** : Utilise `nginx:alpine` pour servir les fichiers statiques via le port 80 du conteneur. Une configuration personnalisée `nginx.conf` est injectée pour assurer le bon fonctionnement du routeur côté client (SPA fallback vers `index.html`).

Le fichier `.dockerignore` a été configuré pour éviter de copier des répertoires locaux lourds tels que `node_modules` lors du build de l'image.
