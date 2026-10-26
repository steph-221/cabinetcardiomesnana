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

## Dictée vocale (médecins)

En haut du formulaire de consultation, **Dicter la consultation** écoute le médecin (5 minutes au plus). **C'est
gratuit et il n'y a rien à configurer.**

1. **Reconnaissance de la voix** : celle du navigateur (Chrome, Edge ou Safari ; pas Firefox), la même que la dictée
   du téléphone. Le texte s'affiche pendant que l'on parle. Elle a besoin d'Internet.
2. **Correction gratuite**, faite dans le navigateur avec le vocabulaire de cardiologie et le lexique du cabinet :
   - commandes dictées : « à la ligne », « point », « virgule », « deux points », « pour cent »… ;
   - sigles épelés ou mal écrits : « f e v g » → FEVG, « e t t » → ETT, « avk » → AVK ;
   - médicaments mal reconnus : « sin trom » → Sintrom, « bisoprolole » → bisoprolol (signalés pour vérification) ;
   - valeurs chiffrées, qui remplissent aussi les champs : « TA 13 8 » → 130/80 mmHg, « fréquence cardiaque 45 »,
     « INR 2,83 », « FEVG 55 % », « poids 60 », « taille 1,56 », « créatinine 12 mg/l », « LDL 1,2 g/l » ;
   - rangement dans les rubriques annoncées : « motif », « examen », « ECG », « autres », « conclusion »,
     « conduite à tenir ». Sans rubrique annoncée, le texte va en conclusion.
3. **Relecture par le médecin** : les mots douteux sont signalés, chaque rubrique se corrige sur place, le texte
   reconnu avant correction reste consultable. **Insérer dans la consultation** ajoute le texte à la suite de ce qui
   est déjà saisi ; rien n'est enregistré avant **Enregistrer la consultation**.

Exemple de dictée : « motif : contrôle sous Sintrom, à la ligne, examen : RAS, TA 13 8, fréquence cardiaque 62, à
la ligne, conclusion : bon équilibre tensionnel, à la ligne, conduite à tenir : continuer même traitement ».

**Le lexique apprend** : un mot mal reconnu se corrige avec **Retenir dans le lexique** pendant la relecture, ou sur
la page **Lexique** (bouton sur l'agenda). La correction s'applique à toutes les dictées suivantes.

### Facultatif : « Améliorer avec Claude »

Pour une dictée difficile (sans rubriques annoncées, phrases longues), le bouton **Améliorer avec Claude** fait
corriger et ranger le texte par Claude (Anthropic) : environ 2 centimes de dollar par dictée, et seulement quand on
clique. Seul le texte dicté est envoyé, sans le nom ni l'identité du patient. Pour l'activer :

1. Sur <https://console.anthropic.com/>, créer un compte pour le cabinet, ajouter quelques dollars de crédits (et une
   limite de dépense mensuelle dans **Settings → Limits**), puis **API Keys → Create Key**.
2. Projet Vercel → **Settings → Environment Variables** : ajouter `ANTHROPIC_API_KEY` avec cette clé (les trois
   environnements), puis redéployer.

Sans cette clé, le bouton n'apparaît pas et la dictée reste entièrement gratuite.

**Données de santé** : la voix passe par les serveurs de Google (Chrome, Edge) ou d'Apple (Safari), et, si l'on
utilise Claude, le texte par ceux d'Anthropic, hors du Maroc. Ces transferts doivent figurer dans la demande
d'autorisation à la CNDP (voir plus bas). L'audio n'est jamais enregistré par le site.

## 3. Rôles du personnel

Dans **Gérer les comptes**, chaque compte a un rôle :

| Rôle | Agenda | Identité et coordonnées des patients | Contenu médical (antécédents, allergies, traitements…) | Comptes, journal, suppression d'un dossier |
| --- | --- | --- | --- | --- |
| Administrateur (le médecin, `COMPTE_ADMIN`) | oui | oui | oui | oui |
| Médecin (remplaçant) | oui | oui | oui (y compris consultations, courbes, alertes et dictée) | non |
| Secrétaire | oui | oui, classement des examens, suivis et relances | **non** : rien n'est envoyé à son navigateur (ni conclusions, ni fichiers d'examen) | non |

Les comptes créés avant cette mise à jour sont « secrétaire ». Pour un médecin remplaçant, choisir **médecin** dans la
liste à côté de son nom puis **Changer**.

## Données de santé

Les dossiers contiennent des données de santé, « sensibles » au sens de la loi 09-08 : leur traitement demande une
**autorisation préalable de la CNDP** (<https://www.cndp.ma>), pas une simple déclaration. La base Neon est hébergée
hors du Maroc, tout comme Google Drive, la dictée du navigateur (Google ou Apple) et Claude (Anthropic) s'il est
utilisé : ces transferts doivent être indiqués dans la demande. À faire par le cabinet avant d'y saisir de vrais
dossiers. Les mentions légales du site seront complétées en conséquence.

- Les données sont chiffrées pendant le transfert et sur les disques de Neon ; seul le site y a accès.
- Utiliser des mots de passe longs et différents pour chaque compte, et supprimer un compte dès la fin d'un
  remplacement.
- Neon garde un historique qui permet de restaurer la base à un instant passé (la durée dépend de l'offre choisie).

## Développement local

Pour tester sans Neon, `NEON_FETCH_ENDPOINT` peut pointer vers un émulateur local du point d'accès HTTP de Neon
(par exemple <https://github.com/TimoWilhelm/local-neon-http-proxy>), relié à un Postgres local ; `DATABASE_URL`
indique alors ce Postgres.
