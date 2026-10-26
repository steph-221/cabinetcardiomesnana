# Dossiers patients — mise en service

L'espace cabinet (`/fr/espace`) contient maintenant les **dossiers patients** : bouton **Patients** en haut de
l'agenda.

- **Recherche** par nom et prénom (dans n'importe quel ordre, avec ou sans accents), par téléphone (06…, +212…,
  00212…) ou par numéro de dossier. Depuis l'agenda, le lien **Dossier** d'un rendez-vous cherche le patient par son
  téléphone.
- **Fiche patient** : identité, coordonnées (avec lien WhatsApp), couverture (CNSS, CNOPS, AMO Tadamon…),
  facteurs de risque, antécédents, allergies (affichées en rouge), notes, traitements en cours et arrêtés.
- **Doublons** : à la création, un dossier qui a le même téléphone, ou les mêmes nom, prénom et date de naissance,
  est signalé ; on peut l'ouvrir ou créer quand même un nouveau dossier.
- **Journal** (administrateur seulement) : qui a ouvert, créé ou modifié chaque dossier, et quand.

## 1. Activer la base de données (une seule fois)

Les dossiers sont enregistrés dans une base Postgres gratuite, Neon :

1. Projet Vercel → **Storage** → **Create Database** → **Neon** (Postgres) → offre gratuite. Choisir la région la
   plus proche (Europe, par exemple Francfort).
2. La relier au projet **cabinetcardiomesnana** (tous les environnements). Vercel ajoute tout seul la variable
   `DATABASE_URL`.
3. Redéployer.

Les tables sont créées automatiquement à la première ouverture de la page **Patients** ; il n'y a rien d'autre à
faire. Les évolutions futures de la base s'appliquent de la même façon.

## 2. Connecter Google Drive (une seule fois)

Les examens (PDF des appareils, photos de papiers ou de résultats de laboratoire) sont rangés dans le Google Drive du
cabinet : un dossier « Cabinet — Dossiers patients », puis un sous-dossier par patient (« NOM Prénom — n° 12 »), et
des fichiers nommés par date et type (« 2025-04-18 Échocardiographie (ETT) — compte-rendu.pdf »). Le site ne voit
que les fichiers qu'il a lui-même créés : le reste du Drive lui reste invisible.

1. Sur <https://console.cloud.google.com/>, dans le même projet que l'agenda : **API et services → Bibliothèque** →
   activer **Google Drive API**.
2. **Google Auth Platform** (ou « Écran de consentement OAuth ») : type **Externe**, nom « Site cabinet », adresse
   de contact du cabinet. Puis **Audience → Publier l'application** (état « En production »). Sans cette étape,
   Google coupe l'accès au bout de 7 jours. La portée utilisée (`drive.file`) ne demande pas de vérification par
   Google.
3. **Clients → Créer un client** → type **Application Web**. Dans **URI de redirection autorisés**, ajouter :
   - `https://www.cabinetcardiomesnana.com/api/drive/retour`
   - `https://cabinetcardiomesnana.com/api/drive/retour`
   - l'adresse `…vercel.app/api/drive/retour` du projet, si l'espace cabinet est parfois ouvert par cette adresse.
4. Projet Vercel → **Settings → Environment Variables** :

   | Variable | Valeur |
   | --- | --- |
   | `GOOGLE_OAUTH_CLIENT_ID` | l'« ID client » affiché à l'étape 3 |
   | `GOOGLE_OAUTH_CLIENT_SECRET` | le « Code secret du client » de l'étape 3 |

   Puis redéployer.
5. Se connecter à l'espace cabinet avec le compte administrateur → **Google Drive** → **Connecter Google Drive**, et
   choisir le compte Google du cabinet.

Ensuite, dans chaque dossier patient, section **Examens** :

- choisir le type et la date, puis **Choisir des fichiers** (plusieurs PDF à la fois, ou glisser-déposer) ou
  **Prendre une photo** (sur téléphone, ouvre directement l'appareil photo) ;
- les photos sont réduites automatiquement (environ 1 Mo) ; 4 Mo maximum par fichier ;
- la secrétaire peut classer les examens ; seuls les médecins écrivent une conclusion et ouvrent les fichiers ;
- **Supprimer** met le fichier dans la corbeille de Google Drive (récupérable pendant 30 jours).

Le jeton d'accès à Google Drive est enregistré chiffré dans la base. **Déconnecter** (page Google Drive) le révoque.

## Consultations, courbes et alertes (médecins)

Dans un dossier, **Nouvelle consultation** reprend les rubriques du rapport de consultation du cabinet : motif,
examen physique (TA, FC, SpO₂, taille reprise de la dernière fois, poids, surface corporelle et IMC calculés
pendant la saisie), ECG, valeurs (INR, FEVG, LDL-c en g/L, créatinine en mg/L, HbA1c, NT-proBNP), autres,
conclusion et conduite à tenir. Une virgule ou un point conviennent pour les décimales ; une valeur
invraisemblable (FC à 500…) est refusée.

La fiche du patient affiche ensuite :

- **les courbes d'évolution** de chaque valeur, avec la zone cible de l'INR (à régler dans **Modifier**, rubrique
  « Zone cible de l'INR ») ; le survol d'un point donne sa date et sa valeur, et chaque courbe a son tableau ;
- **les calculs** : surface corporelle, IMC, DFG estimé (CKD-EPI 2021, d'après la dernière créatinine, l'âge et le
  sexe) ;
- **le score CHA₂DS₂-VA** (recommandations ESC 2024 sur la fibrillation atriale), pré-rempli avec l'âge, l'HTA et
  le diabète du dossier ; les autres critères se cochent sur place (rien n'est enregistré) ;
- **les alertes**, en haut du dossier :
  - INR hors de la zone cible ;
  - bradycardie (FC < 50), en précisant le bêtabloquant en cours s'il y en a un ;
  - TA ≥ 140/90 ;
  - DFG < 60 (< 30 : critique), pour penser à adapter les posologies ;
  - FEVG ≤ 40 % ou en baisse d'au moins 10 points.

Ces calculs et alertes sont des aides : ils ne remplacent pas le jugement du médecin.

## Suivis et relances (tout le personnel)

- En fin de consultation, la rubrique **Prochain suivi** (« Échocardiographie (ETT) dans 6 mois ») crée un suivi ;
  on peut aussi en ajouter un depuis le dossier (section **Suivi à prévoir**), avec un délai ou une date précise.
- La page **Suivis** (bouton sur l'agenda, avec le nombre de suivis en retard) les classe : en retard, dans les
  7 jours, dans le mois.
- **Message WhatsApp** ouvre WhatsApp avec un rappel déjà rédigé (nom du patient, examen, date, téléphone du
  cabinet et lien de prise de rendez-vous en ligne) : il suffit de l'envoyer. Puis **Relancé** (la date et la
  personne sont notées), et **Fait** une fois le rendez-vous pris.
- Sur l'agenda, le lien **Dossier** d'un rendez-vous ouvre directement le dossier du patient quand son téléphone
  est connu.

## 3. Rôles du personnel

Dans **Gérer les comptes**, chaque compte a un rôle :

| Rôle | Agenda | Identité et coordonnées des patients | Contenu médical (antécédents, allergies, traitements…) | Comptes, journal, suppression d'un dossier |
| --- | --- | --- | --- | --- |
| Administrateur (le médecin, `COMPTE_ADMIN`) | oui | oui | oui | oui |
| Médecin (remplaçant) | oui | oui | oui (y compris consultations, courbes et alertes) | non |
| Secrétaire | oui | oui, classement des examens, suivis et relances | **non** : rien n'est envoyé à son navigateur (ni conclusions, ni fichiers d'examen) | non |

Les comptes créés avant cette mise à jour sont « secrétaire ». Pour un médecin remplaçant, choisir **médecin** dans la
liste à côté de son nom puis **Changer**.

## Données de santé

Les dossiers contiennent des données de santé, « sensibles » au sens de la loi 09-08 : leur traitement demande une
**autorisation préalable de la CNDP** (<https://www.cndp.ma>), pas une simple déclaration. La base Neon est hébergée
hors du Maroc : ce transfert doit être indiqué dans la demande. À faire par le cabinet avant d'y saisir de vrais
dossiers. Les mentions légales du site seront complétées en conséquence.

- Les données sont chiffrées pendant le transfert et sur les disques de Neon ; seul le site y a accès.
- Utiliser des mots de passe longs et différents pour chaque compte, et supprimer un compte dès la fin d'un
  remplacement.
- Neon garde un historique qui permet de restaurer la base à un instant passé (la durée dépend de l'offre choisie).

## Développement local

Pour tester sans Neon, `NEON_FETCH_ENDPOINT` peut pointer vers un émulateur local du point d'accès HTTP de Neon
(par exemple <https://github.com/TimoWilhelm/local-neon-http-proxy>), relié à un Postgres local ; `DATABASE_URL`
indique alors ce Postgres.
