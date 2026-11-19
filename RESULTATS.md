# Résultats d'analyses reçus par email — mise en service

Les PDF envoyés par les laboratoires arrivent dans la boîte Gmail du cabinet. Un petit script Google les envoie au
site, qui les range dans le dossier du patient (Google Drive + examen « Biologie »).

- **Nom reconnu sans doute possible** (nom **et** prénom trouvés dans l'objet, le nom du fichier ou le texte, et un
  seul dossier correspond) : le résultat est classé tout seul et marqué **À relire** ; un clic confirme, ou
  « Ce n'est pas lui » le retire du dossier.
- **Sinon** (homonymes, nom mal écrit, patient inconnu) : le résultat attend dans **Résultats → À classer** ;
  on l'ouvre pour vérifier, puis on choisit le patient.
- Tout est inscrit dans le journal. Le même PDF n'est jamais enregistré deux fois.

## 1. Côté site (une seule fois)

Projet Vercel → **Settings → Environment Variables** : ajouter `RESULTATS_SECRET` avec une longue valeur aléatoire
(32 caractères ou plus, par exemple `openssl rand -hex 24`), puis redéployer. Google Drive doit déjà être connecté
(voir DOSSIER.md).

## 2. Côté Gmail (une seule fois)

1. Chaque laboratoire a une étiquette **LABORATOIRE/nom** (déjà le cas : BEKKALI, FRANCO, laboratoireinternat), avec
   un filtre qui l'applique aux emails de ce laboratoire.
2. Sur <https://script.google.com>, connecté au compte Gmail du cabinet : **Nouveau projet**, coller le contenu de
   `scripts/resultats-gmail.gs`.
3. **Paramètres du projet → Propriétés du script** : ajouter `RESULTATS_SECRET`, avec la même valeur que sur Vercel.
4. Lancer une fois `envoyerResultats` et accepter les autorisations (lecture de Gmail, appel d'un site externe).
5. **Déclencheurs → Ajouter un déclencheur** : fonction `envoyerResultats`, déclenché « par minuteur », toutes les
   10 minutes.

## Nouveau laboratoire

Créer l'étiquette **LABORATOIRE/nom du labo** et son filtre dans Gmail. Rien d'autre.

## Limites

- PDF et photos de 4 Mo maximum.
- Seuls les emails portant une étiquette `LABORATOIRE/…` sont envoyés : un email non étiqueté n'est jamais lu.
- Un expéditeur falsifié peut envoyer un faux PDF : la relecture du résultat classé automatiquement reste utile.
