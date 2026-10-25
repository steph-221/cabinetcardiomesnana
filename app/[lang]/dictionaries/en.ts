import type { Dictionnaire } from "./fr";

const en: Dictionnaire = {
  meta: {
    titre: "Mesnana Cardiology Practice — Dr Taouab Zogarh Cursoux, cardiologist in Tangier",
    description:
      "Cardiology practice in Mesnana, Tangier: consultations, ECG and echocardiography. Appointments: +212 5 39 31 85 50.",
  },
  nom: "Mesnana Cardiology Practice",
  nomCourt: "Cardio Mesnana",
  nav: {
    soins: "Care & tests",
    medecin: "The doctor",
    cabinet: "The practice",
    infos: "Practical info",
    appeler: "Call the practice",
    ouvrirMenu: "Open menu",
    fermerMenu: "Close menu",
    langue: "Language",
  },
  accueil: {
    titreMedecin: "Cardiologist",
    slogan: "Specialist in diseases of the heart and blood vessels in Tangier: prevention, diagnosis and follow-up.",
    ville: "Mesnana, 90000 Tangier",
    photo: "Examination room at the practice",
  },
  urgence: {
    titre: "Emergency:",
    texte:
      "if you have chest pain, sudden shortness of breath or feel faint, do not wait for an appointment: call 141 (SAMU ambulance) or 15 (Civil Protection) immediately, or go to the nearest emergency department.",
  },
  soins: {
    titre: "Care & tests",
    intro: "The main cardiology tests are carried out directly at the practice.",
    liste: [
      {
        titre: "Cardiology consultation",
        texte:
          "Cardiovascular check-up, risk factor screening, follow-up of heart conditions and assessment before surgery or returning to sport.",
      },
      {
        titre: "Electrocardiogram (ECG)",
        texte: "Recording of the heart's electrical activity, done at the practice in a few minutes.",
      },
      {
        titre: "Echocardiography",
        texte:
          "Ultrasound of the heart to assess its pumping, valves and chambers — painless and radiation-free.",
      },
      {
        titre: "Hypertension and prevention",
        texte:
          "Diagnosis and follow-up of high blood pressure, cholesterol and diabetes to protect the heart and arteries.",
      },
      {
        titre: "Holter monitoring",
        texte: "Recording of the heart rhythm over 24 to 72 hours to investigate palpitations or rhythm disorders.",
      },
      {
        titre: "Ambulatory blood pressure monitoring",
        texte: "Blood pressure measured over 24 hours to diagnose and monitor hypertension.",
      },
      {
        titre: "Exercise stress test",
        texte:
          "Test on a bike or treadmill to study the heart during exercise, especially before returning to sport.",
      },
    ],
  },
  medecin: {
    presentation:
      "The practice sees patients for the prevention, diagnosis and follow-up of cardiovascular disease: high blood pressure, chest pain, palpitations, shortness of breath, heart failure, or a check-up before surgery or returning to sport. Routine tests are done on site, in a modern, well-equipped practice.",
    photo: "Consultation office",
  },
  cabinet: {
    titre: "The practice",
    intro: "A modern, bright and well-equipped practice in the heart of Mesnana.",
    photos: [
      "Examination room with ultrasound and ECG machines",
      "Consultation office",
      "Waiting room",
      "Building front with the cardiology practice sign",
    ],
  },
  infos: {
    titre: "Practical info",
    adresse: "Address",
    adresseLignes: ["Résidence Adam, 2nd floor, apartment no. 5", "Trémie Mesnana, 90000 Tangier, Morocco"],
    carte: "Map to the practice",
    itineraire: "Directions with Google Maps",
    horaires: "Opening hours",
    jours: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    ferme: "Closed",
    horairesNote: "Consultations by appointment.",
    rdv: "For your appointment",
    aApporterIntro: "Please bring:",
    aApporter: [
      "National ID card or passport",
      "Health insurance card, if you have one",
      "Referral letter from your doctor",
      "Prescriptions and a list of your current medication",
      "Recent results: blood tests, ECGs, test or hospital reports",
    ],
  },
  contact: {
    titre: "Book an appointment",
    texte: "Call the reception to book your appointment.",
    fixe: "Landline",
    mobile: "Mobile",
    whatsapp: "Message on WhatsApp",
  },
  pied: {
    mentions: "Legal notice",
  },
  mentions: {
    titre: "Legal notice",
    editeur: "Site publisher",
    telephone: "Phone",
    hebergement: "Hosting",
    hebergeur: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA",
    informatif: "For information only",
    informatifTexte:
      "The information on this site is provided for information only and does not replace a medical consultation. In an emergency, call 141 (SAMU ambulance) or 15 (Civil Protection).",
    donnees: "Personal data",
    donneesTexte:
      "This site has no forms, collects no personal data and uses no tracking cookies. The map is provided by Google Maps, which has its own privacy policy.",
  },
};

export default en;
