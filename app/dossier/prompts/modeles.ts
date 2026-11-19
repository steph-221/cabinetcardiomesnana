// Trames des comptes rendus du cabinet, un modèle par type d'examen (mêmes noms que typesExamen dans examens.ts).
// Chaque trame donne les rubriques dans l'ordre. Une rubrique sans donnée devient « [À COMPLÉTER : …] ».
// Format commun : titre, ligne « Patient », lignes d'en-tête, puis des SECTIONS EN MAJUSCULES avec des lignes « - ».

export const ENTETE = `[TITRE DU COMPTE RENDU]
Patient : [NOM Prénom] · [âge] ans · Date : [JJ/MM/AAAA]
Indication : [indication]
Opérateur : Dr [nom]`;

export const modeles: Record<string, string> = {
  ECG: `ELECTROCARDIOGRAMME DE REPOS
En-tête (patient, date, indication, traitement en cours : antiarythmique, bêtabloquant, digitalique)
TRACÉ : rythme (sinusal / FA / autre) · FC · axe du QRS · PR · QRS · QT/QTc
ANALYSE : onde P · conduction (BAV, blocs) · hypertrophies · segment ST et onde T (dérivations) · onde Q · repolarisation
COMPARAISON avec le tracé antérieur (date) · AU TOTAL`,

  "Échocardiographie (ETT)": `COMPTE RENDU D'ÉCHOCARDIOGRAPHIE-DOPPLER TRANSTHORACIQUE
En-tête (patient, âge, poids, taille, surface corporelle, date, indication, opérateur)
VENTRICULE GAUCHE : DTD · DTS · septum · paroi postérieure · épaisseur relative · masse VG et masse indexée · FEVG (méthode) · SLG · cinétique segmentaire
VENTRICULE DROIT ET OREILLETTES : VD (contractilité, TAPSE) · surface OG · diamètre OG · surface OD
VALVES ET DOPPLER : mitrale (aspect, E, E/e') · aortique (aspect, ITV sous-aortique, Vmax, gradient moyen, surface) · tricuspide (fuite, Vmax IT, gradient VD-OD, anneau)
AORTE, PÉRICARDE, VCI : diamètre aorte · péricarde · VCI et POD estimée
HÉMODYNAMIQUE : PAPS estimée (gradient VD-OD + POD) · pressions de remplissage VG
AU TOTAL : puces, de l'élément principal vers les éléments secondaires`,

  "Holter ECG": `ENREGISTREMENT HOLTER ECG
En-tête (patient, date, indication, traitement en cours)
ENREGISTREMENT : durée · qualité · rythme de base
FRÉQUENCE : FC minimale, moyenne, maximale (heures)
ARYTHMIES VENTRICULAIRES : nombre d'ESV, % · doublets · salves / TV (durée, FC)
ARYTHMIES SUPRAVENTRICULAIRES : nombre d'ESSV · salves · épisodes de FA (durée, charge)
PAUSES ET CONDUCTION : pauses (nombre, durée maximale) · BAV · bradycardie nocturne
CORRÉLATION avec les symptômes / le journal du patient · AU TOTAL`,

  MAPA: `MESURE AMBULATOIRE DE LA PRESSION ARTÉRIELLE (MAPA) DES 24 HEURES
En-tête (patient, date, indication, traitement antihypertenseur en cours)
VALIDITÉ : durée · nombre de mesures valides (jour, nuit)
PRESSION ARTÉRIELLE : moyenne 24 h · jour · nuit · charge tensionnelle (% des valeurs élevées) · FC moyenne
PROFIL NOCTURNE : baisse nocturne en % (dipper / non-dipper / riser)
COMPARAISON avec les mesures de consultation (HTA blouse blanche ou masquée) · AU TOTAL`,

  "Épreuve d'effort": `ÉPREUVE D'EFFORT
En-tête (patient, date, indication, facteurs de risque, traitement en cours dont bêtabloquant, ECG de repos)
PROTOCOLE : type (tapis / bicyclette) · paliers · FMT théorique (220 − âge) et 85 % de la FMT
RÉSULTATS CLINIQUES : symptômes · durée · puissance maximale (W ou METs) · FC maximale et % de la FMT · PA repos / pic / récupération · motif d'arrêt
ECG : repos · effort (ST, onde T, arythmies, conduction) · récupération
AU TOTAL : positive / négative / non concluante, avec la raison (test maximal ou non, ECG interprétable ou non)`,

  "Échographie cardiaque d'effort": `COMPTE RENDU D'ÉCHOGRAPHIE CARDIAQUE D'EFFORT
En-tête (patient, date, indication, facteurs de risque, ECG de repos, traitement en cours)
PROTOCOLE : type d'effort · paliers · FMT théorique et 85 % de la FMT · puissance maximale (W, METs) · motif d'arrêt
RÉSULTATS : clinique (symptômes, FC maximale, PA repos / effort / récupération) · ECG (repos, effort, récupération) · échographie (repos, effort : cinétique segmentaire, FEVG, hémodynamique)
CONCLUSION : puces (niveau d'effort atteint, clinique, électrique, échographique, adaptation tensionnelle)
AU TOTAL : négative / positive / non concluante sur les plans clinique, électrique et échographique, avec la limite éventuelle (test sous-maximal)`,

  "Doppler vasculaire": `COMPTE RENDU D'ÉCHO-DOPPLER VEINEUX (OU ARTÉRIEL) DES MEMBRES INFÉRIEURS (OU DES TRONCS SUPRA-AORTIQUES)
En-tête (patient, date, indication, côté examiné)
AXES PROFONDS (veineux) : segments examinés · perméabilité · compressibilité · flux Doppler
RÉSEAU SUPERFICIEL : saphènes · reflux (siège, durée) · varices
PARTIES MOLLES : œdème (niveau) · collection · kyste poplité · adénopathie (siège, taille, aspect)
(Artériel : plaques par segment, sténose en % ou en vitesses, flux, index de pression systolique si mesuré)
AU TOTAL : puces, du diagnostic principal vers les diagnostics différentiels et la conduite à discuter`,

  Coroscanner: `COROSCANNER
En-tête (patient, date, indication, fréquence cardiaque, produit de contraste, qualité)
SCORE CALCIQUE : score d'Agatston · dominance
ARTÈRES : tronc commun · IVA · circonflexe · coronaire droite (sténose en % par segment)
EXTRA-CORONAIRE : anomalies cardiaques et thoraciques
AU TOTAL : CAD-RADS et conduite proposée`,

  Coronarographie: `CORONAROGRAPHIE
En-tête (patient, date, indication, voie d'abord)
RÉSEAU CORONAIRE : tronc commun · IVA · circonflexe · coronaire droite · pontages / stents
VENTRICULOGRAPHIE : FEVG et cinétique si faite
GESTE RÉALISÉ : angioplastie (artère, stent), pression de remplissage
COMPLICATIONS · AU TOTAL et conduite (traitement, suivi)`,

  Biologie: `INTERPRÉTATION DU BILAN BIOLOGIQUE
En-tête (patient, date, indication, traitement en cours)
VALEURS ANORMALES EN TÊTE : valeur, unité, norme
VALEURS CLÉS : créatinine et DFG · kaliémie · LDL · HbA1c · NT-proBNP · troponine · INR · TSH · NFS
RETENTISSEMENT SUR LE TRAITEMENT : adaptation au DFG, kaliémie, interactions
À CONTRÔLER : examen à refaire, délai`,

  Consultation: `RAPPORT DE CONSULTATION DE CARDIOLOGIE
DATE · tableau : NOM, prénom · date de naissance / âge
MOTIF DE CONSULTATION
ANTÉCÉDENTS / FDRCV : antécédents cardiovasculaires et chirurgicaux (type de prothèse), facteurs de risque, allergies
TRAITEMENT EN COURS : médicament (DCI), dose
EXAMEN PHYSIQUE : TA · FC · SpO₂ · taille · poids · surface corporelle · IMC · examen clinique (auscultation, signes d'insuffisance cardiaque, pouls, œdèmes)
ELECTROCARDIOGRAMME · AUTRES EXAMENS · ETT (résumé)
CONCLUSION ET CONDUITE : diagnostic, bilan à demander, traitement, prochain rendez-vous`,
};

export const typesAvecModele = Object.keys(modeles);
