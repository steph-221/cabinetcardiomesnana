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

## 2. Rôles du personnel

Dans **Gérer les comptes**, chaque compte a un rôle :

| Rôle | Agenda | Identité et coordonnées des patients | Contenu médical (antécédents, allergies, traitements…) | Comptes, journal, suppression d'un dossier |
| --- | --- | --- | --- | --- |
| Administrateur (le médecin, `COMPTE_ADMIN`) | oui | oui | oui | oui |
| Médecin (remplaçant) | oui | oui | oui | non |
| Secrétaire | oui | oui | **non** : rien n'est envoyé à son navigateur | non |

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
