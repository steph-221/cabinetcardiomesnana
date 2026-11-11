# Rapport — reprise des comptes rendus du Dr Taouab

Dossier Drive « DR TAOUAB » examiné le 3 novembre 2026. Aucun nom de patient n'est repris ici.

## 1. Ce qui a été regardé (et ce qui ne l'a pas été)

- **Contenu du dossier** : au moins 105 fichiers Word (.docx), une dizaine de photos (.jpg) et une dizaine d'anciens
  fichiers Word (.doc) ; la liste complète n'a pas été parcourue jusqu'au bout (plusieurs pages restent à lister).
- **Lus en détail** : 11 fichiers représentatifs (consultations, échographies, ETO, bilan préopératoire, contrôle
  après chirurgie, une photo de note manuscrite). Les constats ci-dessous valent pour ces modèles ; ils ne remplacent
  pas un passage sur tous les fichiers.
- **Non testé** : l'extraction par Claude (pas de clé API dans cette session) et l'import dans une vraie base. Les
  corrections de ce dépôt portent sur la lecture de l'identité, vérifiée par des tests automatiques.

## 2. Les types de documents trouvés

| Type | Exemple de nom | Pris en charge aujourd'hui ? |
| --- | --- | --- |
| Rapport de consultation (tableau) | « … cs », « … cst » | Oui |
| Compte rendu d'ETT, modèle complet (2D + Doppler + AU TOTAL) | « … ett » | Oui |
| ETT en texte libre (prothèses valvulaires, thrombose) | « … thrombose » | Partiellement : tout passe dans « AU TOTAL », aucune mesure de prothèse |
| ETO (échographie transœsophagienne) | « … .doc » | Non : pas de type ETO, et fichier .doc refusé |
| Photo de note manuscrite (suite de chimiothérapie, TA, FC, biologie) | « … .jpg » | Non : seuls les .docx sont acceptés |
| Anciens fichiers .doc (2025) | « … .doc » | Refusés (à ouvrir dans Word puis enregistrer en .docx) |
| Modèles vierges | « FICHE CS VIERGE », feuille de rendez-vous | Ils créeraient de faux patients |
| Copies | « … (1) », « … (2) », « … .docx 2.docx », « … 2 » | Chaque copie crée un import séparé |

## 3. Problèmes trouvés dans la lecture de l'identité (corrigés)

Constatés sur les vrais en-têtes, corrigés dans `app/dossier/reprise.ts`, avec tests (`reprise.test.ts`) :

1. **Date avec un espace avant la barre** (« 07/09 /2026 », « 08 /06/2026 ») : la date du document n'était pas lue.
2. **Âge à la place de la date de naissance** (« DATE DE NAISSANCE : 90 ans ») : l'âge était perdu.
3. **ETO** : « Nom : » et « Prénom : » sur deux lignes — seul le nom était lu, le prénom restait vide.

## 4. Patients à plusieurs visites : regroupement

Constats sur les noms de fichiers :

- Un même patient a souvent plusieurs fichiers (consultation + ETT, plusieurs consultations, copies « (1) », « (2) »).
- Le nom change d'un fichier à l'autre : ordre inversé (nom/prénom), faute de frappe (une lettre ou deux de différence),
  un mot en plus ou en moins.
- Des **membres d'une même famille** portent le même nom avec des prénoms différents : il ne faut pas les fusionner.
- Un même nom de famille peut aussi être le **prénom** d'un autre patient.
- L'ordre nom/prénom du nom de fichier n'est pas fiable (certains fichiers sont « prénom nom ») : l'app ne peut pas
  toujours savoir lequel est le nom. Ces cas doivent être signalés « à vérifier ».

Solution ajoutée (`app/dossier/regroupement.ts`, testée dans `regroupement.test.ts`) :

- **Même patient « sûr »** : mêmes mots, quel que soit l'ordre, la casse ou les accents.
- **Même patient « probable »** : tous les mots se correspondent à une faute de frappe près et au moins un mot est
  identique. À confirmer par le médecin, jamais fusionné en silence.
- **Homonymes séparés** : deux dates de naissance différentes, ou deux âges qui diffèrent de plus de 2 ans.
- **Une visite par date** : chaque document devient une consultation ou un compte rendu daté dans le même dossier ;
  les courbes (INR, FEVG…) se nourrissent de toutes les visites.
- Détection du **genre** (consultation, ETT, ETO) et des **modèles vierges** d'après le nom du fichier, et des
  **copies**.

Pas encore branché dans l'écran « Reprise Word » : le module est prêt, il reste à l'afficher (voir §7).

## 5. Cohérence des comptes rendus (pour améliorer l'app et les prompts)

- **Valeurs cohérentes** : dans les échographies lues, le gradient VD-OD et la PAPS concordent avec la vitesse de la
  fuite tricuspide (4 × V²), la pression de l'OD étant de 3 à 5 mmHg. L'app calcule déjà ces valeurs : on peut les
  comparer à ce qui est écrit et signaler un écart.
- **Champs vides dans le modèle** : « Diamètre aorte : mm », « Masse VG = g/m² », « Strain longitudinal global = % »,
  « Diamètre VG télésystole : mm » restent souvent vides. Le prompt les traite déjà comme « null » (règle 6) : bien.
- **Libellé ambigu** : « onde E/A = 0.91 m/s » mélange un rapport E/A (sans unité) et une vitesse E (m/s). L'app a un
  champ « Onde E (m/s) » : une valeur de 0,91 est plausible, mais « E/A = 1.94 » ne l'est pas comme vitesse. À clarifier
  dans le modèle du cabinet (deux lignes : « Onde E = … m/s », « E/A = … »).
- **Fautes de frappe** à corriger par le prompt (règle 8 existe) : « 08m » pour 08 mm, « coplet », « bbd », « mestinon »
  mal écrit, « contorle ».
- **Vocabulaire à ajouter au glossaire** : RVM (remplacement valvulaire mitral), RM, RVA, SBP (méthode de Simpson
  biplan), PTDG, SOG, TSA, ESA, BBD, VCI « compliante ».
- **Prothèses valvulaires** : le modèle d'ETT n'a pas de champs pour le gradient transprothétique ni pour le type de
  prothèse ; ces comptes rendus tombent entièrement dans « AU TOTAL ». À ajouter (voir §7).
- **À relire par le médecin** (jugement clinique, pas une erreur de l'app) : un compte rendu qualifie un
  rétrécissement mitral de « modéré » avec une surface de 1,7 cm². Les recommandations ESC parlent de
  rétrécissement mitral cliniquement significatif à ≤ 1,5 cm² : l'écart mérite relecture.

## 6. Ce qui est corrigé dans cette modification

- `app/dossier/reprise.ts` : trois corrections de lecture de l'identité (§3).
- `app/dossier/regroupement.ts` : regroupement des fichiers d'un même patient, détection des modèles vierges et des
  copies (§4).
- Tests : `reprise.test.ts`, `regroupement.test.ts` (noms fictifs uniquement).

## 7. Lot test de 20 fichiers (extraction faite hors de l'app)

Sans clé API, l'extraction a été faite par Claude Code à partir du texte lu sur Drive, puis déposée dans un fichier
`.json` que l'app charge (bouton « Fichier d'extraction » de la page Reprise). Les patients arrivent dans la file
« à valider », qui sert de classement « à vérifier ». Le fichier contient des données de santé : il n'est pas dans
le dépôt.

Résultat : **20 fichiers lus, 16 extractions, 4 non importés** (3 modèles vides, 1 version antérieure du même jour).
Les 16 extractions passent la validation de l'app (aucune valeur écartée). Ce que le lot a montré :

- **Modèles vides dans le dossier** : trois fichiers sont des modèles non remplis (consultation vide, échographie vide).
  Le nom du fichier ne les distingue pas d'un vrai compte rendu : il faut tester le contenu (aucune valeur, aucun
  nom). À ajouter à la reprise.
- **Plusieurs versions d'une même visite** : pour un patient, trois fichiers du même jour (consultation commencée,
  consultation complétée, échographie). Il faut ne garder que la version la plus complète par date, sinon la
  validation crée des consultations en double.
- **Le nom du fichier peut tromper sur le genre** : un fichier « … cst » (consultation) est une échographie.
- **Homonymes** : deux patients de même nom et de prénoms très proches (55 ans en 2025 et 90 ans en 2026) ne sont
  pas la même personne ; la comparaison des âges les sépare bien.
- **Deux fichiers pour une même patiente, avec le nom écrit différemment** (une ou deux lettres de différence,
  sur trois patients du lot) : le regroupement les réunit comme « probable ».
- **Un seul fichier peut contenir plusieurs visites** (trois dates à la suite) : elles deviennent trois consultations.
- **Notes inachevées** : une visite s'arrête au milieu d'une phrase (« poids= »), une TA est écrite en cmHg
  (« 11/7 ») : laissées vides et signalées.
- **Échographies en texte libre** avec prothèses valvulaires (tricuspide, mitrale, aortique) : les gradients des
  prothèses n'ont pas de champ dédié.

## 8. À faire ensuite (non fait)

1. **Écran de regroupement** dans « Reprise Word » : proposer les groupes « sûrs » et « probables », cocher/décocher,
   fusionner dans un seul dossier.
2. **Classement « À vérifier »** : statut visible dans la liste des patients (pastille orange) pour les dossiers issus
   de la reprise, qui disparaît après relecture ; filtre pour ne voir que ceux-là. Demande une nouvelle migration de
   la base.
3. **Import des photos et PDF** : envoi à Claude (lecture d'image) avec le même masquage de l'identité ; les notes
   manuscrites seront peu fiables, donc toujours « à vérifier ».
4. **Fichiers .doc** : conversion automatique en .docx, ou lecture directe.
5. **Type ETO** et **ETT avec prothèses** dans le modèle d'échographie.
6. **Écarts de cohérence** : comparer le PAPS et les gradients écrits à ceux que l'app calcule.
7. **Détection des modèles vides et des versions multiples d'une même visite** dans la reprise.
8. **Passage sur l'intégralité du dossier** (liste complète, tous les types), puis rapport définitif avec chiffres.
