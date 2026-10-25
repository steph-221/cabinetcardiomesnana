// Informations du cabinet : modifiez ce fichier pour mettre à jour le site.
// Les valeurs entre crochets [ ... ] sont à remplacer par les vraies informations.

export const cabinet = {
  nom: "Cabinet de Cardiologie Mesnana",
  nomCourt: "Cardio Mesnana",
  slogan: "Prévention, diagnostic et suivi des maladies du cœur et des vaisseaux.",
  medecin: {
    nom: "Dr [Prénom Nom]",
    titre: "Cardiologue",
    presentation:
      "[Présentation du médecin : formation, parcours, domaines d'intérêt. Exemple : diplômé de la faculté de médecine de ..., ancien chef de clinique, spécialisé dans la prise en charge de l'insuffisance cardiaque et des troubles du rythme.]",
    secteur: "[Secteur 1 conventionné — carte Vitale acceptée]",
    rpps: "[Numéro RPPS]",
  },
  adresse: {
    rue: "[Numéro et rue]",
    ville: "[Code postal] [Ville]",
    complement: "[Étage, bâtiment, interphone…]",
    // Lien Google Maps vers le cabinet
    carte: "https://maps.google.com/?q=[adresse+du+cabinet]",
  },
  telephone: "[01 23 45 67 89]",
  telephoneLien: "+33123456789",
  email: "[contact@cabinet-cardio-mesnana.fr]",
  // Lien de prise de rendez-vous en ligne (Doctolib, Maiia, etc.)
  rendezVous: "https://www.doctolib.fr/",
  horaires: [
    { jour: "Lundi", heures: "[9h00 – 12h30 · 14h00 – 18h30]" },
    { jour: "Mardi", heures: "[9h00 – 12h30 · 14h00 – 18h30]" },
    { jour: "Mercredi", heures: "[9h00 – 12h30]" },
    { jour: "Jeudi", heures: "[9h00 – 12h30 · 14h00 – 18h30]" },
    { jour: "Vendredi", heures: "[9h00 – 12h30 · 14h00 – 17h00]" },
    { jour: "Samedi", heures: "Fermé" },
    { jour: "Dimanche", heures: "Fermé" },
  ],
  acces: {
    transports: "[Ligne de bus / métro / tram et arrêt le plus proche]",
    stationnement: "[Parking gratuit devant le cabinet / parking public à proximité]",
    pmr: "Cabinet accessible aux personnes à mobilité réduite.",
  },
};
