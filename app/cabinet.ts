// Informations du cabinet : modifiez ce fichier pour mettre à jour le site.

export const cabinet = {
  nom: "Cabinet de Cardiologie Mesnana",
  nomCourt: "Cardio Mesnana",
  slogan: "Spécialiste des maladies du cœur et des artères à Tanger : prévention, diagnostic et suivi.",
  medecin: {
    nom: "Dr Taouab Zogarh Cursoux",
    titre: "Cardiologue",
    presentation:
      "Le cabinet accueille les patients pour la prévention, le diagnostic et le suivi des maladies cardiovasculaires : hypertension artérielle, douleurs thoraciques, palpitations, essoufflement, insuffisance cardiaque ou bilan avant une intervention ou une reprise du sport. Les examens courants sont réalisés sur place, dans un cabinet récent et équipé.",
  },
  adresse: {
    ligne1: "Résidence Adam, 2ᵉ étage, appartement n° 5",
    ligne2: "Trémie Mesnana, 90000 Tanger",
    pays: "Maroc",
    carte:
      "https://www.google.com/maps/search/?api=1&query=Dr+Taouab+Zogarh+Cursoux+Cabinet+de+cardiologie+mesnana+Tanger",
    carteIntegree: "https://maps.google.com/maps?q=35.752777,-5.85083&z=17&output=embed",
  },
  telephones: [
    { libelle: "Fixe", numero: "05 39 31 85 50", lien: "+212539318550" },
    { libelle: "Mobile", numero: "07 16 74 49 13", lien: "+212716744913" },
  ],
  site: "cabinetcardiomesnana.com",
  // Laissez vide tant que les horaires détaillés ne sont pas confirmés :
  // le site affiche alors seulement la phrase « horairesNote ».
  horaires: [] as { jour: string; heures: string }[],
  horairesNote: "Ouverture à partir de 9h00. Consultations sur rendez-vous : appelez le secrétariat.",
};

export const telephonePrincipal = cabinet.telephones[0];
