// Exemples (dictée → compte rendu) pour le prompt de rédaction. Ils partent de quatre comptes rendus réels du cabinet,
// anonymisés, mis en forme et complétés : rubriques regroupées, valeurs de référence, calculs (masse VG, FMT, SC, IMC),
// raisonnement diagnostique dans « AU TOTAL », et une liste « À VÉRIFIER » des incohérences et des données manquantes.
// Sortie : titre, lignes d'en-tête, SECTIONS EN MAJUSCULES, puces « - ». Le bloc « À VÉRIFIER » n'est jamais imprimé.

export const SEPARATEUR_VERIFICATIONS = "--- À VÉRIFIER ---";

export type Exemple = {
  type: string;
  entree: string; // ce que dicte le médecin (ou les données saisies)
  sortie: string; // compte rendu complet
  verifier: string[]; // points à vérifier (5 au maximum)
};

export const exemples: Exemple[] = [
  {
    type: "Échocardiographie (ETT)",
    entree: `ETT, 67 ans, bilan préop, 23/07/2026. Ao ?, OG surface 17, OD 12. Septum 10, paroi post 12, DTD 46. FEVG 68 Simpson biplan.
VD bonne contractilité TAPSE 28. Cinétique segmentaire et globale bonne. Péricarde normal, VCI fine.
Mitrale fine, onde E/A 0,91 m/s, E/E' 6, pressions de remplissage correctes. Aortique légèrement épaissie, ouverture correcte, ITV sous-aortique 26.
Tricuspide fuite modérée, Vmax IT 2,80, gradient VD-OD 31, PAPS 35.
Au total : cavités de taille normale, bonne fonction systolique des deux ventricules, pas de valvulopathie significative, PAPS à 35.`,
    sortie: `COMPTE RENDU D'ÉCHOCARDIOGRAPHIE-DOPPLER TRANSTHORACIQUE
Patient : [NOM Prénom] · 67 ans · Poids / taille : [À COMPLÉTER] · Date : 23/07/2026
Indication : bilan préopératoire
Opérateur : Dr [nom]

VENTRICULE GAUCHE
- Diamètre télédiastolique 46 mm ; diamètre télésystolique [À COMPLÉTER] mm
- Septum interventriculaire 10 mm ; paroi postérieure 12 mm ; épaisseur relative 0,52
- Masse VG 181 g ; indexation impossible (surface corporelle non renseignée)
- FEVG 68 % (Simpson biplan) ; strain longitudinal global [À COMPLÉTER] %
- Cinétique segmentaire et globale normale

VENTRICULE DROIT, OREILLETTES
- VD : bonne contractilité, bonne fonction systolique longitudinale (TAPSE 28 mm)
- Oreillette gauche : surface 17 cm² ; diamètre [À COMPLÉTER] mm
- Oreillette droite : surface 12 cm²

VALVES ET DOPPLER
- Mitrale : valves fines ; onde E 0,91 m/s ; E/e' 6 ; pressions de remplissage VG normales
- Aortique : valve légèrement épaissie, d'ouverture correcte ; ITV sous-aortique 26 cm ; Vmax [À COMPLÉTER] m/s
- Tricuspide : fuite modérée ; Vmax IT 2,80 m/s ; gradient VD-OD 31 mmHg

AORTE, PÉRICARDE, VCI
- Diamètre de l'aorte [À COMPLÉTER] mm
- Péricarde normal
- VCI fine (pression OD estimée à 3 mmHg)

HÉMODYNAMIQUE
- PAPS estimée à 35 mmHg

AU TOTAL
- Fonction systolique du ventricule gauche conservée (FEVG 68 %), sans trouble de la cinétique segmentaire ; bonne fonction systolique du ventricule droit (TAPSE 28 mm).
- Oreillettes de taille normale.
- Paroi postérieure à 12 mm avec une épaisseur relative à 0,52 : remodelage concentrique possible, à confirmer par la masse indexée (poids et taille à renseigner) et à rapprocher de la pression artérielle.
- Valve aortique légèrement remaniée, d'ouverture correcte, sans argument pour une sténose ; la Vmax aortique est à renseigner pour l'affirmer.
- Insuffisance tricuspide modérée, mécanisme à préciser ; pas d'autre valvulopathie significative.
- PAPS estimée à 35 mmHg avec une Vmax IT à 2,80 m/s et sans autre signe d'hypertension pulmonaire : probabilité faible (ESC/ERS 2022).
- Sur le plan échographique, pas d'élément contre-indiquant l'intervention envisagée [à valider par le médecin].`,
    verifier: [
      "Onde « E/A = 0,91 m/s » : une vitesse en m/s est une onde E, un rapport E/A n'a pas d'unité ; confirmer.",
      "ITV sous-aortique 26 cm : au-dessus de la plage usuelle (18 à 22 cm) ; confirmer la mesure.",
      "Fuite tricuspide dite « modérée » mais « pas de valvulopathie significative » dicté : j'ai gardé l'insuffisance tricuspide modérée dans la conclusion ; confirmer.",
      "PAPS dictée à 35 mmHg ; calcul 31 + POD 3 = 34 mmHg.",
      "Données manquantes : aorte, diamètre OG, DTS, strain, Vmax aortique, poids et taille (masse indexée).",
    ],
  },
  {
    type: "Échographie cardiaque d'effort",
    entree: `Écho d'effort 13/10/2026, 56 ans, recherche d'ischémie. FDR dyslipidémie, ondes T négatives antérieur étendu.
Effort 25 W / 2 min, FMT 220-âge, max 75 W = 4 METs. Asymptomatique, TA repos 118/70, effort 140/85, normalisation à la récupération. Arrêt pour fatigue musculaire.
ECG repos RAS ; effort disparition des ondes T négatives en latéral, pas de trouble du rythme ni de conduction ; récupération sans modification.
Écho repos cinétique normale ; effort cinétique segmentaire et globale normale, pas d'anomalie hémodynamique. 77 % de la FMT.
Au total échographie d'effort négative sur le plan clinique, électrique et échographique.`,
    sortie: `COMPTE RENDU D'ÉCHOGRAPHIE CARDIAQUE D'EFFORT
Patient : [NOM Prénom] · 56 ans · Date : 13/10/2026
Indication : recherche d'ischémie myocardique
Contexte : dyslipidémie ; ondes T négatives en antérieur étendu sur l'ECG de repos
Traitement en cours : [À COMPLÉTER] (bêtabloquant, inhibiteur calcique)

PROTOCOLE
- Effort sur bicyclette, paliers de 25 W toutes les 2 minutes
- FMT théorique 164 bpm (220 − âge) ; 85 % de la FMT : 139 bpm
- Puissance maximale 75 W (4,0 METs) ; durée [À COMPLÉTER]
- Motif d'arrêt : fatigue musculaire

RÉSULTATS
Clinique
- Asymptomatique, sans douleur thoracique ; FC maximale [À COMPLÉTER] bpm
- TA 118/70 mmHg au repos, 140/85 mmHg à l'effort ; normalisation à la récupération
ECG
- Repos : ondes T négatives [territoire à préciser]
- Effort : disparition des ondes T négatives ; pas de trouble significatif du rythme ni de la conduction ; ST [À COMPLÉTER]
- Récupération : pas de modification
Échocardiographie
- Repos : cinétique segmentaire et globale normale ; FEVG [À COMPLÉTER] %
- Effort : cinétique segmentaire et globale normale ; pas d'anomalie hémodynamique

CONCLUSION
- Effort conduit à 77 % de la FMT (environ 126 bpm), sous le seuil de 85 %, pour 75 W (4,0 METs) : test sous-maximal.
- Pas de douleur thoracique, pas d'anomalie électrique significative.
- Pas d'anomalie de la cinétique segmentaire à l'effort.
- Bonne adaptation tensionnelle.

AU TOTAL
- Échographie d'effort négative sur les plans clinique, électrique et échographique, mais sous-maximale (77 % de la FMT, arrêt pour fatigue musculaire) : la valeur prédictive négative est moins robuste qu'avec un effort atteignant 85 % de la FMT.
- La disparition des ondes T négatives à l'effort est un phénomène de pseudo-normalisation, non spécifique ; l'origine des ondes T négatives de repos n'est pas expliquée par ce test.
- À discuter selon la probabilité clinique : coroscanner coronaire, ou nouvelle épreuve avec un objectif de FMT atteint ; contrôle du bilan lipidique et prise en charge des facteurs de risque.`,
    verifier: [
      "Ondes T négatives : « antérieur étendu » dans le contexte, « RAS » dicté à l'ECG de repos, puis disparition « en latéral » à l'effort ; confirmer le territoire.",
      "FC maximale non dictée : 126 bpm déduit de 77 % de la FMT (164 bpm).",
      "Test sous-maximal dicté « négatif » : j'ai gardé « négative » avec la réserve ; confirmer la formulation.",
      "Non précisés : ST à l'effort, FEVG repos et effort, durée, traitement bêtabloquant.",
    ],
  },
  {
    type: "Doppler vasculaire",
    entree: `Écho veines membres inférieurs, 72 ans, 11/09/2026. Réseau veineux perméable et compressible, flux Doppler normal, pas de signe d'insuffisance veineuse.
Infiltration œdémateuse du membre inférieur droit remontant au genou, avec adénopathie inguinale.
Au total : pas de thrombose veineuse ce jour, probable érysipèle.`,
    sortie: `COMPTE RENDU D'ÉCHO-DOPPLER VEINEUX DES MEMBRES INFÉRIEURS
Patient : [NOM Prénom] · 72 ans · Date : 11/09/2026
Indication : œdème du membre inférieur droit [à confirmer]
Côté examiné : [À COMPLÉTER : droit / gauche / bilatéral]

AXES PROFONDS
- Réseau veineux perméable et compressible, flux Doppler normal
- Segments examinés : [À COMPLÉTER : fémoral commun, fémoral, poplité, jambiers, veines musculaires]

RÉSEAU SUPERFICIEL
- Pas de signe d'insuffisance veineuse (saphènes : [À COMPLÉTER])

PARTIES MOLLES
- Infiltration œdémateuse du membre inférieur droit remontant jusqu'au genou
- Adénopathie inguinale [siège, taille et aspect : À COMPLÉTER]
- Kyste poplité, hématome, collection : [À COMPLÉTER]

AU TOTAL
- Pas de thrombose veineuse profonde sur les segments examinés ce jour.
- Pas d'insuffisance veineuse.
- Œdème du membre inférieur droit avec adénopathie inguinale : tableau compatible avec un érysipèle probable, diagnostic clinique à confirmer (fièvre, placard inflammatoire, porte d'entrée).
- Diagnostics différentiels à discuter : lymphangite, cellulite infectieuse, œdème lymphatique secondaire.
- À discuter : recherche d'une porte d'entrée (intertrigo interdigital) ; contrôle écho-doppler en cas d'aggravation ou de persistance de l'œdème ; exploration de l'adénopathie si elle persiste après traitement.`,
    verifier: [
      "Indication et côté examiné non dictés (œdème du membre inférieur droit déduit de la dictée).",
      "Segments veineux examinés non précisés ; « pas de thrombose » est limité aux segments examinés.",
      "Adénopathie inguinale : taille, siège, aspect à renseigner.",
      "« Probable érysipèle » est un diagnostic clinique : formulé comme tel, à valider.",
    ],
  },
  {
    type: "Consultation",
    entree: `Consultation 27/07/2026, 54 ans, suivi. Remplacement valvulaire en 2023, prothèse mécanique (laquelle ?), sous Sintrom seul.
TA 125/83, FC 75, taille 173, poids 80, examen RAS. ECG : rythme sinusal régulier, ailleurs RAS.
ETT : prothèse mitrale + AT ok, gradient 3,7, ailleurs RAS. TSA normales. Conclusion : récupérer le bilan.`,
    sortie: `RAPPORT DE CONSULTATION DE CARDIOLOGIE
Date : 27/07/2026
Patient : [NOM Prénom] · 54 ans
Motif de consultation : suivi

ANTÉCÉDENTS / FDRCV
- Remplacement valvulaire en 2023 par prothèse mécanique [modèle et position : À COMPLÉTER ; mitrale d'après l'ETT]
- Facteurs de risque cardiovasculaire : [À COMPLÉTER]

TRAITEMENT EN COURS
- Acénocoumarol (Sintrom) seul ; posologie [À COMPLÉTER]
- INR cible [À COMPLÉTER] ; dernier INR et temps passé dans la cible [À COMPLÉTER]

EXAMEN PHYSIQUE
- TA 125/83 mmHg ; FC 75 bpm ; SpO₂ [À COMPLÉTER] %
- Taille 173 cm ; poids 80 kg ; surface corporelle 1,96 m² ; IMC 26,7 kg/m²
- Examen clinique sans particularité [à détailler : cliquetis de prothèse, souffle, signes d'insuffisance cardiaque]

ELECTROCARDIOGRAMME
- Rythme sinusal régulier, sans autre anomalie

ÉCHOCARDIOGRAPHIE
- Prothèse mitrale fonctionnelle, gradient moyen 3,7 mmHg [unité à confirmer]
- Le reste de l'examen est sans particularité
- Troncs supra-aortiques normaux

CONCLUSION ET CONDUITE
- Suivi d'une prothèse valvulaire mécanique (2023) sous antivitamine K : patient cliniquement stable, rythme sinusal, prothèse normofonctionnelle à l'ETT.
- Récupérer le bilan biologique (INR et temps passé dans la cible, créatinine, NFS) avant de statuer sur le traitement.
- À discuter : rappel de l'INR cible et de la conduite en cas d'intervention ou de saignement, antibioprophylaxie de l'endocardite, prochain rendez-vous de suivi.`,
    verifier: [
      "Modèle de la prothèse mécanique non précisé (« laquelle ? » dans la note) ; position mitrale déduite de l'ETT.",
      "« Prothèse mitrale + AT ok » : abréviation « AT » non comprise (anneau tricuspide ?) ; omise du compte rendu, à préciser.",
      "Gradient « 3,7 » : j'ai écrit gradient moyen en mmHg ; confirmer.",
      "INR cible, dernier INR, posologie du Sintrom, SpO₂ non dictés.",
    ],
  },
];

// Texte d'un exemple tel qu'il est montré au modèle
export function texteExemple(e: Exemple) {
  return [
    `<exemple type="${e.type}">`,
    `<dictee>\n${e.entree}\n</dictee>`,
    `<compte_rendu>\n${e.sortie}\n\n${SEPARATEUR_VERIFICATIONS}\n${e.verifier.map((v) => `- ${v}`).join("\n")}\n</compte_rendu>`,
    `</exemple>`,
  ].join("\n");
}
