import type { Dictionnaire } from "./fr";

const es: Dictionnaire = {
  meta: {
    titre: "Consulta de Cardiología Mesnana — Dr Taouab Zogarh Cursoux, cardiología en Tánger",
    description:
      "Consulta de cardiología en Mesnana, Tánger: consultas, ECG y ecocardiografía. Citas: +212 5 39 31 85 50.",
  },
  nom: "Consulta de Cardiología Mesnana",
  nomCourt: "Cardio Mesnana",
  nav: {
    soins: "Servicios y pruebas",
    medecin: "El médico",
    cabinet: "La consulta",
    infos: "Información práctica",
    appeler: "Llamar a la consulta",
    ouvrirMenu: "Abrir el menú",
    fermerMenu: "Cerrar el menú",
    langue: "Idioma",
  },
  accueil: {
    titreMedecin: "Cardiología",
    slogan: "Especialista en enfermedades del corazón y de los vasos sanguíneos en Tánger: prevención, diagnóstico y seguimiento.",
    ville: "Mesnana, 90000 Tánger",
    photo: "Sala de exploración de la consulta",
  },
  urgence: {
    titre: "Urgencia:",
    texte:
      "si tiene dolor en el pecho, falta de aire repentina o un desmayo, no espere a una cita: llame inmediatamente al 141 (SAMU) o al 15 (Protección Civil), o acuda a las urgencias más cercanas.",
  },
  soins: {
    titre: "Servicios y pruebas",
    intro: "Las principales pruebas cardiológicas se realizan directamente en la consulta.",
    liste: [
      {
        titre: "Consulta de cardiología",
        texte:
          "Revisión cardiovascular, detección de factores de riesgo, seguimiento de enfermedades cardíacas y valoración antes de una cirugía o de volver a hacer deporte.",
      },
      {
        titre: "Electrocardiograma (ECG)",
        texte: "Registro de la actividad eléctrica del corazón, realizado en la consulta en pocos minutos.",
      },
      {
        titre: "Ecocardiografía",
        texte:
          "Ecografía del corazón para evaluar la contracción, las válvulas y las cavidades cardíacas, sin dolor ni radiación.",
      },
      {
        titre: "Hipertensión y prevención",
        texte:
          "Diagnóstico y seguimiento de la hipertensión arterial, el colesterol y la diabetes para proteger el corazón y las arterias.",
      },
      {
        titre: "Holter ECG",
        texte:
          "Registro del ritmo cardíaco durante 24 a 72 horas para estudiar palpitaciones o trastornos del ritmo.",
      },
      {
        titre: "MAPA",
        texte:
          "Monitorización ambulatoria de la presión arterial durante 24 horas para diagnosticar y controlar la hipertensión.",
      },
      {
        titre: "Prueba de esfuerzo",
        texte:
          "Prueba en bicicleta o cinta para estudiar el corazón durante el ejercicio, sobre todo antes de volver a hacer deporte.",
      },
    ],
  },
  medecin: {
    presentation:
      "La consulta atiende a pacientes para la prevención, el diagnóstico y el seguimiento de las enfermedades cardiovasculares: hipertensión arterial, dolor torácico, palpitaciones, falta de aire, insuficiencia cardíaca o revisión antes de una intervención o de volver a hacer deporte. Las pruebas habituales se realizan en la propia consulta, moderna y bien equipada.",
    photo: "Despacho de consulta",
  },
  cabinet: {
    titre: "La consulta",
    intro: "Una consulta moderna, luminosa y bien equipada, en el corazón de Mesnana.",
    photos: [
      "Sala de exploración con ecógrafo y electrocardiógrafo",
      "Despacho de consulta",
      "Sala de espera",
      "Fachada del edificio con el rótulo de la consulta de cardiología",
    ],
  },
  infos: {
    titre: "Información práctica",
    adresse: "Dirección",
    adresseLignes: ["Résidence Adam, 2.ª planta, apartamento n.º 5", "Trémie Mesnana, 90000 Tánger, Marruecos"],
    carte: "Mapa de acceso a la consulta",
    itineraire: "Cómo llegar con Google Maps",
    horaires: "Horario",
    jours: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
    ferme: "Cerrado",
    horairesNote: "Consultas con cita previa.",
    rdv: "Para su cita",
    aApporterIntro: "Recuerde traer:",
    aApporter: [
      "Documento de identidad o pasaporte",
      "Tarjeta de seguro médico, si dispone de ella",
      "Carta de su médico de cabecera",
      "Recetas y lista de sus tratamientos actuales",
      "Resultados recientes: análisis de sangre, ECG, informes de pruebas o de hospitalización",
    ],
  },
  contact: {
    titre: "Pedir cita",
    texte: "Llame a la secretaría para concertar su cita.",
    fixe: "Fijo",
    mobile: "Móvil",
    whatsapp: "Escribir por WhatsApp",
  },
  pied: {
    mentions: "Aviso legal",
  },
  mentions: {
    titre: "Aviso legal",
    editeur: "Responsable del sitio",
    telephone: "Teléfono",
    hebergement: "Alojamiento",
    hebergeur: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, Estados Unidos",
    informatif: "Carácter informativo",
    informatifTexte:
      "La información de este sitio tiene carácter informativo y no sustituye a una consulta médica. En caso de urgencia, llame al 141 (SAMU) o al 15 (Protección Civil).",
    donnees: "Datos personales",
    donneesTexte:
      "Este sitio no contiene formularios, no recoge datos personales y no utiliza cookies de seguimiento. El mapa lo proporciona Google Maps, sujeto a su propia política de privacidad.",
  },
};

export default es;
