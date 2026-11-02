# Comptabilité du cabinet

Onglet **Comptabilité** de l'espace cabinet (`/fr/espace/comptabilite`). Aucune configuration supplémentaire : il
utilise la même base Neon que les dossiers patients (les tables sont créées automatiquement au premier accès).
Tous les montants sont en dirhams (MAD), calculés au centime près.

## Qui voit quoi

| | Secrétaire | Médecin / administrateur |
| --- | --- | --- |
| Établir une facture, encaisser un paiement, imprimer le PDF | oui | oui |
| Tableau de bord, répartition entre médecins, export CSV | non | oui |
| Charges (ajout, suppression) | non | oui |
| Supprimer un paiement, annuler une facture, réglages | non | oui |

Chaque opération est inscrite au **Journal** (administrateur).

## Facturation

- **Nouvelle facture** : depuis la fiche d'un patient (bouton **Facturer**) ou depuis Comptabilité → Factures
  (recherche du patient, ou « personne sans dossier »). On choisit le médecin, puis les actes en un clic (tarifs
  préenregistrés) ou en lignes libres, avec une remise éventuelle.
- **Encaissement** au moment de la facture (espèces, chèque, carte, virement, mutuelle) : total, **acompte**, ou
  « pas encore payé ». Le solde s'encaisse plus tard depuis la facture.
- **Numérotation continue** par année : `2026-0001`, `2026-0002`… Jamais deux fois le même numéro, même si deux
  personnes facturent en même temps.
- Une facture n'est **jamais supprimée** : on l'**annule** (avec un motif). Une facture déjà payée ne peut être
  annulée qu'après suppression de ses paiements (remboursement).
- **PDF** avec l'en-tête du cabinet, le détail, le total en lettres (« arrêtée à la somme de… ») et les règlements.
  Pour afficher l'ICE, renseigner `ice` dans `app/cabinet.ts`.

## Deux médecins associés

Comptabilité → **Réglages** :

- **Médecins** : le premier (celui du site) est créé automatiquement ; ajoutez le second, avec sa **part** (50 / 50
  par défaut). Si vous indiquez l'identifiant de connexion d'un médecin, il est présélectionné quand il facture.
- **Partage** — deux modes :
  - *honoraires individuels* (par défaut) : chacun garde les honoraires de ses propres actes ; les charges communes
    sont partagées selon les parts ;
  - *résultat mis en commun* : tous les honoraires forment un pot, partagé selon les parts, après charges.
- **Tarifs des actes** : les montants de départ (consultation 300 MAD, ECG 150, ETT 500…) sont **indicatifs** :
  corrigez-les. Modifier un tarif ne change pas les factures déjà faites.

## Charges

Comptabilité → **Charges** : date, catégorie (loyer, salaires, CNSS, fournitures, maintenance des appareils…),
montant, mode de paiement, et **à la charge de** : le cabinet (charge commune, partagée) ou un seul médecin.

### Charges récurrentes (loyer, salaire, abonnements…)

Sous la liste des charges : on décrit la dépense une fois (libellé, catégorie, montant, **jour du mois**, date de
début, date de fin facultative, à la charge du cabinet ou d'un médecin). Ensuite, **une charge est créée
automatiquement chaque mois** et entre dans le tableau de bord et l'export.

- Aucune tâche planifiée : les charges échues sont créées à l'ouverture du tableau de bord, de la page Charges ou de
  l'export. Si personne n'ouvre le site pendant des semaines, les mois manqués sont rattrapés à la prochaine ouverture.
- Le 31 devient le dernier jour des mois plus courts (30 septembre, 28 février…).
- Modifier le montant ne touche que les mois **à venir** ; les charges déjà créées restent telles quelles.
- Supprimer une charge créée automatiquement la retire sans la recréer ; **Active** décoché met la récurrence en
  pause ; supprimer la récurrence conserve les charges déjà créées.
- Un début jusqu'à 2 ans en arrière crée d'un coup les mois passés (pratique pour reprendre l'année en cours).

## Tableau de bord

Par mois ou par année : honoraires **encaissés** (comptés à la date du paiement), charges, résultat, reste à
encaisser (toutes périodes), tableau de **répartition entre les médecins**, encaissements par mode de paiement,
charges par catégorie, graphique mois par mois. Le résultat est **avant impôts et cotisations personnelles**.

**Export pour le comptable** : *livre des recettes* et *livre des dépenses* en CSV (s'ouvre dans Excel).

> À faire valider par votre comptable : mentions légales de la facture (ICE, IF, identifiant professionnel,
> régime fiscal) et traitement des honoraires encaissés par la secrétaire ou par chèque.
