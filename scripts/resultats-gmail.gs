/**
 * Envoie au site du cabinet les PDF de résultats d'analyses reçus par email.
 * À coller dans Google Apps Script, connecté au compte Gmail du cabinet (voir RESULTATS.md).
 *
 * Il traite toute étiquette Gmail dont le nom commence par « LABORATOIRE/ » : pour un nouveau laboratoire,
 * il suffit de créer l'étiquette (et son filtre) ; ce script n'est pas à modifier.
 */
const ADRESSE = "https://www.cabinetcardiomesnana.com/api/resultats";
const PREFIXE = "LABORATOIRE/";
const JOURS = 7; // fenêtre de recherche à chaque passage

function envoyerResultats() {
  const secret = PropertiesService.getScriptProperties().getProperty("RESULTATS_SECRET");
  if (!secret) throw new Error("Propriété RESULTATS_SECRET absente (Paramètres du projet → Propriétés du script).");

  const props = PropertiesService.getUserProperties();
  const deja = JSON.parse(props.getProperty("deja") || "{}"); // « idMessage|fichier » → date d'envoi
  const limite = Date.now() - 45 * 24 * 3600 * 1000;
  for (const cle in deja) if (deja[cle] < limite) delete deja[cle];

  const etiquettes = GmailApp.getUserLabels().filter((e) => e.getName().indexOf(PREFIXE) === 0);
  for (const etiquette of etiquettes) {
    const labo = etiquette.getName().slice(PREFIXE.length);
    const fils = GmailApp.search('label:"' + etiquette.getName() + '" has:attachment newer_than:' + JOURS + "d");
    for (const fil of fils) {
      for (const message of fil.getMessages()) {
        const pieces = message
          .getAttachments({ includeInlineImages: false })
          .filter((p) => p.getContentType() === "application/pdf" || /\.pdf$/i.test(p.getName()));
        for (const piece of pieces) {
          const cle = message.getId() + "|" + piece.getName();
          if (deja[cle]) continue;
          const reponse = UrlFetchApp.fetch(ADRESSE, {
            method: "post",
            headers: { Authorization: "Bearer " + secret },
            muteHttpExceptions: true,
            payload: {
              fichier: piece.copyBlob().setContentType("application/pdf"),
              messageId: message.getId(),
              labo: labo,
              expediteur: message.getFrom(),
              sujet: message.getSubject(),
              corps: message.getPlainBody().slice(0, 3000),
              date: Utilities.formatDate(message.getDate(), "Africa/Casablanca", "yyyy-MM-dd"),
            },
          });
          const code = reponse.getResponseCode();
          if (code === 200) deja[cle] = Date.now();
          else console.error(code + " " + reponse.getContentText() + " — " + cle); // réessayé au prochain passage
        }
      }
    }
  }
  props.setProperty("deja", JSON.stringify(deja));
}
