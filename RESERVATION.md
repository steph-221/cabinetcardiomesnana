# Prise de rendez-vous en ligne — mise en service

Le site utilise **l'agenda Google du cabinet** comme carnet de rendez-vous :

- les patients choisissent un créneau libre sur `/fr/rendez-vous` (aussi en arabe, anglais, espagnol) ;
- le rendez-vous est créé directement dans l'agenda Google ;
- tout événement déjà présent dans l'agenda (congé, absence, réunion…) rend le créneau indisponible ;
- le médecin (administrateur) et le personnel qu'il a ajouté (secrétaire, médecin remplaçant…) se connectent sur `/fr/espace` (lien « Espace cabinet » en bas de
  chaque page) pour voir les rendez-vous des 14 prochains jours, en ajouter (pris par téléphone/WhatsApp) et en
  annuler.

Les horaires, la durée d'un créneau (30 min), le délai minimum (2 h) et la période réservable (21 jours) se
règlent dans `app/cabinet.ts`.

## 1. Créer le compte de service Google (une seule fois)

1. Aller sur <https://console.cloud.google.com/>, se connecter avec le compte Google du cabinet et créer un
   projet (par exemple « Site cabinet »).
2. Menu **API et services → Bibliothèque** : activer **Google Calendar API**.
3. Menu **IAM et administration → Comptes de service** : **Créer un compte de service** (nom : `site-rendez-vous`),
   sans rôle particulier.
4. Ouvrir le compte de service → onglet **Clés** → **Ajouter une clé → Créer une clé → JSON**. Un fichier `.json`
   est téléchargé : il contient `client_email` et `private_key`. **Ne jamais le publier ni l'envoyer par
   WhatsApp/e-mail.**

## 2. Partager l'agenda

Dans Google Agenda (sur ordinateur), sur l'agenda des rendez-vous du cabinet : **Paramètres et partage →
Partager avec des personnes spécifiques** :

- ajouter l'adresse `client_email` du compte de service avec le droit **« Apporter des modifications aux
  événements »** ;
- (facultatif) ajouter aussi les adresses Gmail de la secrétaire et du médecin remplaçant avec ce même droit :
  ils verront et modifieront l'agenda directement depuis l'application Google Agenda de leur téléphone.

Plus bas dans la même page, **Intégrer l'agenda → ID de l'agenda** donne la valeur de `GOOGLE_CALENDAR_ID`
(l'adresse Gmail du cabinet s'il s'agit de l'agenda principal).

## 3. Variables d'environnement sur Vercel

Projet Vercel → **Settings → Environment Variables** :

| Variable | Valeur |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` du fichier JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` du fichier JSON (tout le texte, de `-----BEGIN` à `END PRIVATE KEY-----\n`) |
| `GOOGLE_CALENDAR_ID` | ID de l'agenda (étape 2) |
| `COMPTE_ADMIN` | le compte administrateur, sous la forme `identifiant:motdepasse` (ex. `taouab:UnMotDePasseLong`) |
| `SESSION_SECRET` | une longue chaîne aléatoire d'au moins 32 caractères (par exemple générée par un gestionnaire de mots de passe) |

Puis **redéployer** le site pour que les variables soient prises en compte. Tant que les variables Google ne sont
pas renseignées, la page de rendez-vous affiche simplement le numéro du secrétariat.

## 4. Activer le stockage des comptes (une seule fois)

Les comptes du personnel sont enregistrés dans une petite base gratuite, Upstash Redis :

1. Projet Vercel → **Storage** → **Create Database** → **Upstash** (Redis) → offre gratuite.
2. Le relier au projet **cabinetcardiomesnana** (tous les environnements). Vercel ajoute tout seul les variables
   `KV_REST_API_URL` et `KV_REST_API_TOKEN`.
3. Redéployer.

## 5. Donner accès à la secrétaire et au médecin remplaçant

1. Se connecter sur `/fr/espace` avec le compte administrateur (`COMPTE_ADMIN`).
2. Cliquer sur **Gérer les comptes**.
3. Saisir un identifiant (ex. `secretaire`, `remplacant`) et un mot de passe d'au moins 10 caractères, puis
   **Enregistrer le compte**. Transmettre l'identifiant et le mot de passe à la personne.

- Pour **retirer un accès** (fin de remplacement) : **Supprimer** ; la personne est déconnectée immédiatement.
- Pour **changer un mot de passe** oublié : ressaisir l'identifiant avec un nouveau mot de passe ; l'ancien ne
  fonctionne plus.
- Les mots de passe sont enregistrés chiffrés ; personne ne peut les relire.
- Une connexion reste ouverte 12 heures.

Chaque rendez-vous ajouté depuis l'espace cabinet indique dans Google Agenda qui l'a créé.

## Données personnelles

Le formulaire collecte le nom, le téléphone et le motif (facultatif) du patient, avec son accord explicite. Les
mentions légales ont été mises à jour en conséquence (loi 09-08). Selon l'usage, une déclaration auprès de la
CNDP (<https://www.cndp.ma>) peut être nécessaire : à vérifier par le cabinet.
