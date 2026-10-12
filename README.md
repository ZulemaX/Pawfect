# 🐾 Pawfect — Des câlins pour chaque patte

> Un projet de portfolio **Full Stack** : React + TypeScript + Express + PostgreSQL.
>
> Trouver un pet-sitter, envoyer une demande de garde, discuter avec lui et laisser un avis à la fin.

## ✨ Fonctionnalités

- 🐶 Recherche de pet-sitters (ville, type d'animal, budget) ; profils et favoris locaux
- 🔐 Inscription, connexion, mots de passe hachés (`bcryptjs`) et sessions JWT en cookies HTTP-only
- 🐱 Création de profils d'animaux
- 📆 Demandes de réservation, tarifs calculés côté serveur, acceptation/refus et prévention des conflits de dates à l'acceptation
- 💬 Messagerie privée rattachée à une réservation (participation vérifiée côté serveur)
- ⭐ Avis accessibles seulement après une réservation terminée
- 📊 Tableau de bord propriétaire / pet-sitter et modification du profil pet-sitter
- 📱 Interface responsive

## 🚀 Démarrer sur Windows (PowerShell)

### Pré-requis

- **Node.js 20 ou 22** (`node --version`)
- **Git** (`git --version`)
- **Docker Desktop** (avec le moteur Docker démarré) pour PostgreSQL

Dans PowerShell, à la racine du projet :

```powershell
Copy-Item .env.example .env
# Édite .env : remplace JWT_SECRET par une longue valeur secrète aléatoire

docker compose up -d
npm.cmd install
npm.cmd run db:init
npm.cmd run db:seed
npm.cmd run dev
```

Puis ouvre **http://localhost:5173**. Conserve la fenêtre PowerShell ouverte.

**Pour voir uniquement le design sans Docker :** après `npm.cmd install`, lance `npm.cmd run dev:preview` ; la page affiche alors des **profils fictifs en mode aperçu** tant que PostgreSQL est indisponible. La connexion et les réservations exigent la base de données.

> ⚠️ La commande `npm.cmd` évite le blocage de scripts PowerShell (`npm.ps1`).
>
> Pour vérifier que PostgreSQL tourne : `docker compose ps`.

### Connexion démo

Une fois le seed exécuté :

- **Propriétaire** : `demo@pawfect.app` / `Demo123!`
- **Pet-sitter** : `lea@pawfect.app` / `Demo123!`

Comptes de démonstration **pour la machine locale uniquement**. Ne déploie jamais le jeu de données de démonstration ni ces identifiants en production.

**Parcours de test** : connecte-toi en propriétaire, sélectionne un profil, ajoute/choisis un animal, demande une réservation. Déconnecte-toi et connecte-toi avec le compte de Léa pour accepter la demande. Les deux comptes peuvent ensuite échanger des messages.

### Si le dossier GitHub existe déjà

Si tu as déjà cloné ce dépôt :

```powershell
git pull
npm.cmd install
npm.cmd run dev
```

Si `npm install` indique que `package.json` est introuvable, tu n'es pas dans le bon dossier. Vérifie avec : `Get-ChildItem`.

## 🧩 Architecture

```
pawfect/
├── apps/
│   ├── web/                  React + Vite + TypeScript
│   │   └── src/              UI, styles, client API
│   └── api/                  Node.js + Express + TypeScript
│       └── src/              Routes, auth, SQL, seed et tests
├── docs/                     Feuille de route
├── docker-compose.yml        PostgreSQL local
├── .env.example              Exemple de configuration
└── package.json              npm workspaces
```

L'application React tourne sur **5173** et appelle `/api`. Vite transmet les requêtes au serveur Express sur **4000**, qui communique avec PostgreSQL sur **5433** (port local). Toutes les requêtes SQL utilisent des paramètres ; les autorisations d'accès sont vérifiées côté API.

## 📡 Aperçu de l'API

| Méthode | Route | Usage |
|---|---|---|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/me` | Session en cours |
| GET | `/api/sitters` | Recherche de pet-sitters |
| GET | `/api/sitters/:id` | Profil et avis |
| GET/POST | `/api/pets` | Animaux du propriétaire |
| GET/POST | `/api/bookings` | Réservations |
| PATCH | `/api/bookings/:id/status` | Gérer une réservation |
| GET/POST | `/api/bookings/:id/messages` | Conversation |
| POST | `/api/bookings/:id/review` | Avis après une garde |
| PATCH | `/api/sitter/profile` | Édition du profil |

## 🧪 Commandes utiles

```powershell
npm.cmd run build     # Compile le frontend et le backend
npm.cmd run test -w @pawfect/api
npm.cmd run db:seed   # Ré-exécutable, ne duplique pas les profils

docker compose down   # Arrête PostgreSQL, conserve les données
```

## 🔒 À savoir

Projet pédagogique, pas un service de garde réel : pas de paiement, pas de contrôle d'identité, pas de géolocalisation ni de vérification des pet-sitters. Avant une mise en production, ajouter une protection CSRF dédiée, le HTTPS, un processus de vérification, une politique de confidentialité, des confirmations email, du monitoring et davantage de tests.

Ne commite jamais le fichier `.env` ni les vrais mots de passe.

## 🗺️ Suite du projet

Voir [docs/ROADMAP.md](docs/ROADMAP.md).

---

Construit avec beaucoup d'amour pour les animaux 🧡
