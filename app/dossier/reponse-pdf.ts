// Réponse HTTP d'un PDF généré par le site : affiché dans le navigateur, jamais mis en cache

export const reponsePdf = (contenu: Buffer, nom: string) =>
  new Response(new Uint8Array(contenu), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

export const nomFichier = (type: string, patient: { nom: string; prenom: string }, date: string) =>
  `${date} ${type} ${patient.nom.toUpperCase()} ${patient.prenom}.pdf`.replace(/[\\/:*?"<>|]/g, " ");
