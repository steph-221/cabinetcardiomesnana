// Assistant WhatsApp du cabinet : il ne répond qu'à des questions pratiques (horaires, adresse, prise de rendez-vous) avec
// des textes fixes tirés des informations du cabinet, et renvoie vers les urgences quand le message en évoque une. Il ne
// donne JAMAIS d'avis médical et n'invente rien : tout le reste attend le secrétariat. Aucune IA ici : des règles
// simples, relisibles et testables. Aucun accès réseau ni base.

import { cabinet } from "../cabinet";

export type Intention = "urgence" | "horaires" | "adresse" | "rendez-vous" | "salutation" | "autre";
export type LangueMessage = "fr" | "ar";

const sansAccents = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export const estArabe = (texte: string) => (texte.match(/[؀-ۿ]/g) ?? []).length >= 3;

// Mots qui font traiter le message comme une urgence possible : la réponse renvoie vers le 141 / le 15 et le médecin est
// alerté dans la boîte Messages. Mieux vaut une alerte de trop qu'une de moins.
const URGENCE = [
  /douleur.{0,20}(thorax|thoracique|poitrine|coeur)/,
  /(thorax|poitrine|coeur).{0,20}douleur/,
  /(mal|serre|serrement|oppression).{0,15}(poitrine|thorax|coeur)/,
  /essouffl|souffle coupe|difficulte.{0,10}respir|respire.{0,10}(mal|pas)/,
  /malaise|syncope|perdu connaissance|perte de connaissance|evanou|svanou/,
  /\burgen(t|ce)/,
  /palpitation.{0,30}(malaise|douleur|essouffl)/,
  /ألم.{0,15}(الصدر|القلب)/,
  /(الصدر|القلب).{0,15}ألم/,
  /ضيق.{0,10}(في )?التنفس|صعوبة.{0,10}التنفس/,
  /إغماء|اغماء|فقدان.{0,10}الوعي|مستعجل|حالة استعجالية/,
];

const MOTS = {
  horaires: [/horaire/, /\bouvert/, /ferme\b/, /heure.{0,10}ouverture/, /jusqu.{0,5}quelle heure/, /مواعيد العمل|ساعات العمل|متى تفتح|مفتوح/],
  adresse: [/adresse/, /\bou (se trouve|etes|est le cabinet)/, /localisation|itineraire|comment (venir|aller)|plan d.acces|google maps|\bmaps?\b/, /العنوان|اين|أين|موقع/],
  rdv: [/rendez.?vous|\brdv\b|reserver|prendre (un )?rdv|consultation/, /موعد|حجز|نريد موعد|أريد موعد/],
  salutation: [/^(bonjour|bonsoir|salut|salam|salamu|hello|coucou)\b/, /^(السلام عليكم|سلام|مرحبا|صباح الخير|مساء الخير)/],
};

export function intentionDe(texte: string): Intention {
  const t = sansAccents(texte);
  // Le texte brut sert aux motifs arabes (les marques de voyelles sont retirées par sansAccents)
  if (URGENCE.some((m) => m.test(t) || m.test(texte))) return "urgence";
  if (MOTS.horaires.some((m) => m.test(t) || m.test(texte))) return "horaires";
  if (MOTS.adresse.some((m) => m.test(t) || m.test(texte))) return "adresse";
  if (MOTS.rdv.some((m) => m.test(t) || m.test(texte))) return "rendez-vous";
  // Une simple formule de politesse seule ; « bonjour, j'ai mal… » reste une demande à traiter
  if (t.trim().length <= 40 && MOTS.salutation.some((m) => m.test(t.trim()) || m.test(texte.trim()))) return "salutation";
  return "autre";
}

const JOURS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JOURS_AR = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];

// « lundi au vendredi : 09:00 – 17:00 ; samedi : 09:30 – 14:00 ; dimanche : fermé »
export function texteHoraires(langue: LangueMessage, horaires: (string | null)[] = cabinet.horaires): string {
  const jours = langue === "ar" ? JOURS_AR : JOURS_FR;
  const ferme = langue === "ar" ? "مغلق" : "fermé";
  const au = langue === "ar" ? " إلى " : " au ";
  const groupes: { de: number; a: number; h: string | null }[] = [];
  horaires.forEach((h, i) => {
    const dernier = groupes.at(-1);
    if (dernier && dernier.h === h) dernier.a = i;
    else groupes.push({ de: i, a: i, h });
  });
  return groupes
    .map((g) => `${g.de === g.a ? jours[g.de] : `${jours[g.de]}${au}${jours[g.a]}`} : ${g.h ?? ferme}`)
    .join(langue === "ar" ? " ؛ " : " ; ");
}

const lienRdv = (langue: LangueMessage) => `${cabinet.site}/${langue === "ar" ? "ar" : "fr"}/rendez-vous`;
const tel = () => `${cabinet.telephones.fixe.numero} / ${cabinet.telephones.mobile.numero}`;

export type Reponse = { intention: Intention; texte: string; urgent: boolean };

// Réponse automatique à un message, dans la langue de ce message
export function repondre(texte: string): Reponse {
  const langue: LangueMessage = estArabe(texte) ? "ar" : "fr";
  const intention = intentionDe(texte);
  const fr = langue === "fr";
  const signature = fr ? `Cabinet de cardiologie du ${cabinet.medecin}` : `عيادة أمراض القلب — ${cabinet.medecin}`;
  switch (intention) {
    case "urgence":
      return {
        intention,
        urgent: true,
        texte: fr
          ? `En cas de douleur thoracique, d'essoufflement brutal ou de malaise, n'attendez pas : appelez immédiatement le 141 (SAMU) ou le 15 (Protection civile), ou rendez-vous aux urgences les plus proches. Le cabinet ne peut pas évaluer une urgence par message. Le médecin sera prévenu de votre message.`
          : `في حالة ألم في الصدر أو ضيق مفاجئ في التنفس أو إغماء، لا تنتظروا: اتصلوا فورًا بالرقم 141 (SAMU) أو 15 (الوقاية المدنية)، أو توجهوا إلى أقرب مستعجلات. لا يمكن للعيادة تقييم حالة استعجالية عبر الرسائل. سيتم إخبار الطبيب برسالتكم.`,
      };
    case "horaires":
      return { intention, urgent: false, texte: `${fr ? "Horaires du cabinet" : "مواعيد العمل"} : ${texteHoraires(langue)}.\n${fr ? "Téléphone" : "الهاتف"} : ${tel()}\n${signature}` };
    case "adresse":
      return {
        intention,
        urgent: false,
        texte: `${cabinet.adresse.rue}, ${cabinet.adresse.ville}.\n${fr ? "Plan" : "الخريطة"} : ${cabinet.carte}\n${signature}`,
      };
    case "rendez-vous":
      return {
        intention,
        urgent: false,
        texte: fr
          ? `Pour prendre rendez-vous : en ligne sur ${lienRdv(langue)} (choisissez un créneau libre), ou par téléphone au ${tel()}. Pour confirmer ou annuler un rendez-vous existant, utilisez le lien reçu avec votre rappel.\n${signature}`
          : `لحجز موعد: عبر الموقع ${lienRdv(langue)} (اختاروا موعدًا متاحًا)، أو هاتفيًا على ${tel()}. لتأكيد موعد أو إلغائه، استعملوا الرابط الذي توصلتم به مع التذكير.\n${signature}`,
      };
    case "salutation":
      return {
        intention,
        urgent: false,
        texte: fr
          ? `Bonjour, ici le cabinet de cardiologie du ${cabinet.medecin}. Je peux vous donner nos horaires, notre adresse et le moyen de prendre rendez-vous : écrivez « horaires », « adresse » ou « rendez-vous ». Pour toute autre demande, le secrétariat vous répondra. En cas d'urgence (douleur thoracique, essoufflement brutal, malaise), appelez le 141 ou le 15.`
          : `السلام عليكم، هنا عيادة أمراض القلب — ${cabinet.medecin}. يمكنني إعطاؤكم مواعيد العمل والعنوان وطريقة حجز موعد: اكتبوا «مواعيد» أو «عنوان» أو «موعد». لأي طلب آخر ستجيبكم السكرتارية. في حالة استعجال (ألم في الصدر، ضيق مفاجئ في التنفس، إغماء) اتصلوا بالرقم 141 أو 15.`,
      };
    default:
      return {
        intention: "autre",
        urgent: false,
        texte: fr
          ? `Message bien reçu. Le secrétariat vous répondra pendant les horaires d'ouverture (${texteHoraires("fr")}). Pour un rendez-vous, voir ${lienRdv("fr")}. En cas d'urgence (douleur thoracique, essoufflement brutal, malaise), appelez le 141 ou le 15.`
          : `تم استلام رسالتكم. ستجيبكم السكرتارية خلال ساعات العمل (${texteHoraires("ar")}). لحجز موعد: ${lienRdv("ar")}. في حالة استعجال (ألم في الصدر، ضيق مفاجئ في التنفس، إغماء) اتصلوا بالرقم 141 أو 15.`,
      };
  }
}
