// Lien entre une proposition du « AU TOTAL » et les règles de l'inventaire (seuils.ts), pour afficher sous chaque
// proposition sa référence : la phrase de la recommandation, le lien vers le document à la bonne page, et si le
// médecin l'a validée. La première règle dont le motif correspond au texte est retenue.
// Les propositions qui décrivent seulement ce que le médecin a saisi (« Critère usuel », « Compte rendu opératoire »)
// n'ont pas de référence : elles n'affirment aucune norme.

const regles: Record<string, [RegExp, string[]][]> = {
  ecg: [
    [/^(Bradycardie sinusale|Tachycardie sinusale|Rythme sinusal régulier)/, ["ecg-frequence"]],
    [/^Fibrillation atriale/, ["ecg-fa-rapide"]],
    [/^(Bloc auriculo-ventriculaire|PR court)/, ["ecg-pr"]],
    [/^QRS/, ["ecg-qrs"]],
    [/^QTc/, ["ecg-qtc"]],
    [/^Déviation axiale/, ["ecg-axe"]],
  ],
  holter: [
    [/^Bradycardie/, ["holter-bradycardie"]],
    [/^FC moyenne/, ["holter-fc-moyenne"]],
    [/^Charge d'extrasystoles/, ["holter-esv"]],
    [/^Tachycardie ventriculaire non soutenue/, ["holter-tv"]],
    [/^Fibrillation atriale/, ["holter-fa"]],
    [/^Pause/, ["holter-pauses"]],
  ],
  mapa: [
    [/^Enregistrement de validité/, ["mapa-validite"]],
    [/^Profil/, ["mapa-profil"]],
    [/^(Hypertension nocturne|PA nocturne)/, ["mapa-seuils"]],
    [/^(Hypertension artérielle confirmée|HTA de la blouse blanche|HTA masquée|Normotension|Effet blouse blanche|HTA contrôlée|HTA non contrôlée|HTA masquée non contrôlée)/, ["mapa-seuils", "mapa-consultation"]],
    [/^(Valeurs ambulatoires|MAPA normale)/, ["mapa-seuils"]],
  ],
  effort: [
    [/^Effort (maximal|sous-maximal)/, ["effort-maximal", "effort-fmt"]],
    [/^Sous-décalage de ST/, ["effort-st"]],
    [/^Douleur thoracique/, ["effort-duke"]],
    [/^Épreuve d'effort (négative|non concluante)/, ["effort-maximal", "effort-st"]],
    [/^Score de Duke/, ["effort-duke"]],
    [/^Réponse tensionnelle exagérée/, ["effort-pas-exageree"]],
    [/^Chute de la PAS/, ["effort-chute"]],
    [/^Bonne adaptation tensionnelle/, ["effort-pas-exageree", "effort-chute"]],
  ],
  "doppler-veineux": [
    [/[Tt]hrombose veineuse/, ["veineux-tvp"]],
    [/^(Reflux|Pas de signe d'insuffisance veineuse)/, ["veineux-reflux"]],
  ],
  "doppler-arteriel": [[/^IPS/, ["ips-seuils", "ips-gravite"]]],
  "doppler-tsa": [
    [/^ACI/, ["tsa-vitesse"]],
    [/^Épaisseur intima-média/, ["tsa-epaisseur"]],
  ],
  coroscanner: [
    [/CAD-RADS/, ["cad-rads"]],
    [/^Score calcique/, ["calcique"]],
  ],
  coronarographie: [
    [/(FFR|iFR) à/, ["coro-ffr"]],
    [/^(Sténose significative du tronc commun|Atteinte (mono|bi|tri)tronculaire|Sténose intermédiaire|Lésions athéromateuses non significatives|Coronaires angiographiquement normales)/, ["coro-significatif"]],
    [/FEVG|fonction systolique/, ["fevg"]],
  ],
  ett: [
    [/FEVG|Altération de la fonction systolique/, ["fevg"]],
    [/^Dilatation du ventricule gauche/, ["ett-dtd"]],
    [/^Hypertrophie ventriculaire gauche/, ["ett-masse"]],
    [/^Dilatation (des deux oreillettes|de l'oreillette)/, ["ett-oreillettes"]],
    [/^Pressions de remplissage/, ["ett-eee"]],
    [/(Dysfonction systolique du VD|fonction systolique longitudinale du VD)/, ["ett-tapse"]],
    [/^Rétrécissement mitral/, ["ett-rm"]],
    [/^(Rétrécissement aortique|Discordance)/, ["ett-rao"]],
    [/d'HTAP/, ["ett-htp"]],
  ],
};

// Sources qui ne désignent pas une recommandation : la proposition reprend seulement la saisie du médecin
export const SANS_REFERENCE = ["Critère usuel", "Compte rendu opératoire"];

export function avecSeuils<T extends { texte: string; source: string }>(modele: string, propositions: T[]) {
  return propositions.map((p) => ({
    ...p,
    seuils: SANS_REFERENCE.includes(p.source) ? [] : (regles[modele]?.find(([motif]) => motif.test(p.texte))?.[1] ?? []),
  }));
}
