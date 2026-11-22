---
nom: cabinetcardiomesnana
repo: steph-221/cabinetcardiomesnana
type: app web
client: Cabinet de cardiologie Taouab (Tanger)
hebergement: [Vercel, Neon]
prod: https://www.cabinetcardiomesnana.com
staging:
projet: cardio
local: C:\Sites et APP\cabinetcardiomesnana
claude_projet: VERCEL Cardio TAOUAB (cible : Cabinet cardio)
env_local: cardio
env_cloud: cabinetcardio
ssh:
vercel: cabinet-cardio-mesnana/cabinetcardiomesnana
neon: round-block-76931875 (cabinet-dossiers)
---
# cabinetcardiomesnana

Application du cabinet de cardiologie : dossier patient, consultation, ordonnances et certificats imprimables, facturation, liste d'attente, assistant WhatsApp.

## Environnement de travail
- Dossier local : `C:\Sites et APP\cabinetcardiomesnana` (branche `ci/github-actions`)
- Projet Claude : « VERCEL Cardio TAOUAB » ; environnement local « cardio » ; environnement cloud « cabinetcardio » (premier projet cloud, synchronisation à valider)
- Chaîne : local → GitHub → Vercel ; Neon `cabinet-dossiers`

## Stack
- Next.js `16.4.6`
- React `19.3.0`
- Tailwind CSS `^4`
- TypeScript `^5`

## Hébergement & déploiement
- Hébergeur : Vercel, Neon
- Vercel (déploiement auto sur push)
- Déploiement : Push sur `main` : Vercel déploie ; CI GitHub (lint, tests, build) à chaque pull request

## Liens
| Quoi | URL |
|---|---|
| Dépôt | https://github.com/steph-221/cabinetcardiomesnana |
| Production | https://www.cabinetcardiomesnana.com |
| Admin / back-office | https://www.cabinetcardiomesnana.com/fr/espace/connexion (connexion du médecin) |
| Console hébergeur | https://vercel.com/cabinet-cardio-mesnana/cabinetcardiomesnana · Neon : https://console.neon.tech/app/projects/round-block-76931875 · DNS : https://admin.gandi.net/domain |

## Variables d'environnement
> Noms uniquement. Les valeurs restent chez l'hébergeur ou dans le gestionnaire de mots de passe.

| Nom | Où est stockée la valeur |
|---|---|
| À COMPLÉTER | |

Secrets GitHub Actions : aucun détecté

## Accès SSH
Aucun (déploiement par plateforme).

## Docs existantes dans le repo
`README.md`, `scripts/guide/README.md`

## Points d'attention
- **Données médicales** (base Neon `cabinet-dossiers`) : aucune donnée réelle hors production, accès limité.
- D'après le registre du 19/11 : `CRON_SECRET` absent sur Vercel, donc les deux crons (veille 02h, secrétariat 15h) renvoient 503 ; à re-vérifier.
- D'après le registre : 2 tests échouent en local (fuseau horaire Casablanca) et les scripts guide ne passent pas le lint.
- Le README est celui, par défaut, de create-next-app : à remplacer.
- ⚠ `CRON_SECRET` absent des variables Vercel (constaté le 22/11) : les crons répondent 503. À ajouter : https://vercel.com/cabinet-cardio-mesnana/cabinetcardiomesnana/settings/environment-variables
