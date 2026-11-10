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

Variables de sécurité facultatives (recommandées) :

| Variable | Valeur |
| --- | --- |
| `TOTP_ADMIN` | secret (base32) d'une application d'authentification (Google Authenticator, Authy, 1Password…). Une fois renseignée, la connexion de l'administrateur demande aussi le code à 6 chiffres. À créer d'abord dans l'application (« saisir une clé de configuration »), puis à recopier ici. |
| `TURNSTILE_SECRET_KEY` et `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | clés d'un widget Cloudflare Turnstile (gratuit) : vérification anti-robot supplémentaire sur la réservation en ligne, en plus de la protection décrite plus bas |

La connexion est limitée à 10 essais ratés par adresse et 20 par identifiant toutes les 15 minutes (compteurs dans
Upstash), et chaque connexion, réussie ou ratée, apparaît dans le journal. Le mot de passe de `COMPTE_ADMIN` devrait avoir au moins 12 caractères.

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

- Choisir le **rôle** : « secrétaire » (agenda et identité des patients, sans le contenu médical) ou « médecin »
  (dossier médical complet). Voir DOSSIER.md.
- Pour **retirer un accès** (fin de remplacement) : **Supprimer** ; la personne est déconnectée immédiatement.
- Pour **changer un mot de passe** oublié : ressaisir l'identifiant avec un nouveau mot de passe ; l'ancien ne
  fonctionne plus.
- Les mots de passe sont enregistrés chiffrés ; personne ne peut les relire.
- Une connexion reste ouverte 12 heures.

Chaque rendez-vous ajouté depuis l'espace cabinet indique dans Google Agenda qui l'a créé.

Dans **Ajouter un rendez-vous**, le champ **Type** propose :

- **Consultation** (30 min) : occupe le créneau, qui n'est plus proposé aux patients ;
- **Contrôle** (10 min) : se glisse entre deux consultations, sans retirer de créneau aux patients.

La durée peut être modifiée au besoin. Ces valeurs se règlent dans `app/cabinet.ts` (`dureeRdv`, `dureeControle`).

## 6. Fermer des créneaux (congés, absences)

Pour l'administrateur et le personnel (secrétaire, remplaçant…), dans l'espace cabinet, section **Fermer des créneaux** :

- **Journée entière** (cochée) : fermer un jour, ou plusieurs jours de suite en remplissant « Au » ;
- **Journée entière** décochée : fermer une plage horaire (par exemple de 14:00 à 16:00) ;
- un motif facultatif, visible seulement par le cabinet.

Les créneaux fermés ne sont plus proposés aux patients ; les rendez-vous déjà pris ne sont pas annulés. Le bouton
**Rouvrir**, dans la liste des prochains jours, annule une fermeture. Les fermetures apparaissent aussi dans Google
Agenda (« Fermé — motif »).

## 7. Modifier un rendez-vous et prévenir le patient

Dans la liste des prochains jours, le bouton **Modifier** (secrétaire, médecin, administrateur) s'affiche sur **tous** les
rendez-vous, y compris ceux ajoutés directement dans Google Agenda : date, heure, durée, nom, médecin, téléphone, e-mail,
motif. La modification est écrite dans l'agenda Google et enregistrée au journal.

Si la **date ou l'heure change**, le patient peut être prévenu (cases « Par e-mail » / « Par WhatsApp », cochées par
défaut) : « votre rendez-vous du … est annulé et remplacé par … ». Sans réglage supplémentaire, l'application prépare le
message : un lien ouvre l'e-mail ou WhatsApp avec le texte déjà rédigé, il reste à l'envoyer. Pour un **envoi
automatique**, ajouter ces variables sur Vercel (puis redéployer) :

| Variable | Valeur |
| --- | --- |
| `RESEND_API_KEY` | clé API d'un compte <https://resend.com> (e-mail automatique) |
| `EMAIL_EXPEDITEUR` | adresse d'envoi vérifiée sur Resend, ex. `Cabinet <rdv@cabinetcardiomesnana.com>` |
| `EMAIL_REPONSE` | (facultatif) adresse qui reçoit les réponses des patients |
| `WHATSAPP_TOKEN` | jeton d'accès de l'API WhatsApp Business (Meta) |
| `WHATSAPP_NUMERO_ID` | identifiant du numéro WhatsApp Business |
| `WHATSAPP_MODELE` | nom du modèle de message approuvé par Meta (corps avec 3 variables : `{{1}}` nom du patient, `{{2}}` ancien rendez-vous, `{{3}}` nouveau rendez-vous) |
| `WHATSAPP_LANGUE` | (facultatif) langue du modèle, `fr` par défaut |

Chaque canal est indépendant : e-mail automatique et WhatsApp par lien sont possibles ensemble. WhatsApp impose un modèle
de message approuvé par Meta pour écrire en premier à un patient ; modèle conseillé : « Bonjour {{1}}, votre rendez-vous du
{{2}} au cabinet est annulé et remplacé par un nouveau rendez-vous : {{3}}. En cas de problème, appelez le 05 39 31 85 50. »
Si l'envoi automatique échoue, le lien à envoyer à la main est proposé.

## 8. Rappels, confirmation par le patient et relances automatiques

- Page **Rappels** (Aujourd'hui → Rappels) : rendez-vous des 3 prochains jours avec leur état (pas encore rappelé, rappel
  envoyé sans réponse, **confirmé**). **Envoyer le rappel** envoie l'e-mail si Resend est configuré, sinon prépare l'e-mail
  et le message WhatsApp à envoyer d'un clic. Chaque rappel contient un **lien personnel** : le patient y **confirme sa venue**
  ou **annule** (le créneau est libéré aussitôt, l'événement Google supprimé, l'action inscrite au journal). Le lien est
  signé avec `SESSION_SECRET` (32 caractères au moins) ; sans lui, le rappel invite à téléphoner.
- Une modification de date ou d'heure efface la confirmation et le rappel de l'ancien horaire.
- **Tâche automatique** (`vercel.json`, chaque jour à 15 h UTC, soit 16 h au Maroc hors ramadan) : rappelle les rendez-vous
  du lendemain pas encore confirmés ni rappelés, et **relance par e-mail** les suivis dus des patients qui ont une adresse
  (le suivi passe en « relancé » ; les autres restent pour la secrétaire, avec le lien WhatsApp). Elle demande la variable
  `CRON_SECRET` (16 caractères au moins) et, pour partir toute seule, `RESEND_API_KEY` et `EMAIL_EXPEDITEUR`.
- WhatsApp automatique pour les rappels : modèle distinct de celui des changements, à faire approuver par Meta, et variable
  `WHATSAPP_MODELE_RAPPEL` (corps à 3 variables : `{{1}}` nom, `{{2}}` date et heure, `{{3}}` lien de confirmation ou
  téléphone). Modèle conseillé : « Bonjour {{1}}, rappel de votre rendez-vous au cabinet : {{2}}. Pour confirmer ou annuler :
  {{3}} ». Sans cette variable, le lien WhatsApp est simplement préparé.

## Données personnelles

Le formulaire collecte le nom et le téléphone du patient, et facultativement sa date de naissance, son e-mail et le motif de consultation, avec son accord explicite. Les
mentions légales ont été mises à jour en conséquence (loi 09-08). Selon l'usage, une déclaration auprès de la
CNDP (<https://www.cndp.ma>) peut être nécessaire : à vérifier par le cabinet.

## Protection contre les robots

Le formulaire public est protégé par : un champ piège invisible, un jeton signé (avec `SESSION_SECRET`) qui impose
quelques secondes de remplissage, et des limites de fréquence enregistrées dans Upstash : 5 demandes/heure par
adresse IP, 3/jour par numéro de téléphone, 60/heure au total (`app/agenda/antirobot.ts`). Sans Upstash, seules les
deux premières protections s'appliquent.
