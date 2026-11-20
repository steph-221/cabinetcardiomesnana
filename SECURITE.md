# Sécurité : l'état des 7 portes

À relancer **avant chaque mise en ligne** et après chaque grosse modification faite par l'IA :

```bash
npm run securite
```

Cette commande lance les tests de sécurité ci-dessous et `npm audit` (failles connues des dépendances). Tout doit
être vert. Elle ne touche ni à la production ni à des données réelles : la base et le stockage sont simulés.

Dernier audit : 6 novembre 2026. Aucune clé n'a fuité (rien dans le code, l'historique Git ni le navigateur) : il n'y
a donc rien à révoquer. Si une clé est un jour partagée par erreur, **la supprimer du code ne suffit pas** : il faut la
révoquer chez le fournisseur et en créer une nouvelle.

| # | Porte | État | Ce qui la protège | Test qui le prouve |
|---|---|---|---|---|
| 1 | Ce que le navigateur montre | Fermée | Aucune variable `NEXT_PUBLIC_` secrète, aucun composant navigateur qui touche un secret, pas de cartes de code source, en-têtes de sécurité (anti-iframe, HSTS…) | `securite.test.ts`, `en-tetes.test.ts` |
| 2 | La clé d'IA | Fermée | Clé uniquement côté serveur ; plafond de 60 demandes/heure et 300/jour par compte | `securite.test.ts`, `api/dictee/budget-ia.test.ts` |
| 3 | RLS (sécurité ligne par ligne) | Sans objet | La base n'est jamais appelée depuis le navigateur, seulement par le serveur avec `DATABASE_URL` (pas de Supabase ni d'API de données). La protection est dans le code (porte 4) | — |
| 4 | À qui appartient chaque donnée | Fermée | Cabinet unique : droits par rôle. Chaque route, action et page revérifie la session et le rôle (médecin / secrétaire / admin) | `securite.test.ts` |
| 5 | L'espace admin | Fermée | Comptes, Drive et Journal exigent le rôle admin côté serveur (pages, actions, routes d'API) ; connexion limitée à 10 essais/15 min par adresse et 20 par identifiant, comptés avant la vérification ; code TOTP facultatif | `espace/connexion.test.ts`, `agenda/totp.test.ts` |
| 6 | Les limites | Fermée | Réservation : 5/heure/adresse, 3/jour/téléphone, 60/heure au total, jeton anti-robot, 30 lectures de créneaux/minute ; pas d'inscription publique donc pas de crédit gratuit ; plafond d'IA par compte | `rendez-vous/limites.test.ts`, `agenda/antirobot.test.ts` |
| 7 | Le webhook | Fermée | Pas de paiement. Seule entrée externe : `/api/resultats` (secret ≥ 24 caractères comparé en temps constant, blocage après 10 essais ratés, envois de plus de 5 min refusés, doublons ignorés par `messageId`) | `api/resultats/webhook.test.ts` |

## À faire de votre côté (je ne peux pas le faire à votre place)
1. **Anthropic** : console → *Limits* → fixer un plafond de dépense mensuel. C'est la dernière barrière si le plafond
   de l'appli était contourné.
2. **Vercel → Environment Variables** :
   - `COMPTE_ADMIN` : mot de passe d'au moins 12 caractères (l'appli vous avertit sur l'agenda si c'est trop court) ;
   - `TOTP_ADMIN` : active le code à usage unique (Google Authenticator…) pour le compte administrateur ;
   - `RESULTATS_HORODATAGE_OBLIGATOIRE=1`, **après** avoir recopié `scripts/resultats-gmail.gs` dans le script Google
     (il envoie désormais l'en-tête `X-Horodatage`) ;
   - facultatif : `TURNSTILE_SECRET_KEY` et `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (anti-robot Cloudflare, voir RESERVATION.md).
3. **Neon** : mot de passe de base fort, sauvegardes activées. Les données patients sont en clair dans la base.

## Limites connues (choix assumés)
- La CSP ne limite pas les scripts (`script-src`) : cela demande un rendu dynamique de toutes les pages.
- Sans le stockage Redis, les limites sont ignorées (le site continue de fonctionner plutôt que de bloquer le cabinet).
- Un verrouillage de connexion par identifiant peut gêner pendant 15 minutes la personne visée par une attaque :
  c'est le prix pour qu'on ne puisse pas deviner un mot de passe en rafale.

## Quand ajouter une route ou une action publique
`securite.test.ts` échoue si une route d'API ou une action serveur n'exige pas de session. Si l'ouverture est voulue,
il faut l'ajouter (avec la raison) à la liste en haut de ce test, et lui donner une limite d'essais.
