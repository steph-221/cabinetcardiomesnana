// Documents PDF du cabinet : ordonnance (A5), rapport de consultation et compte rendu d'ETT (A4),
// avec l'en-tête du cabinet. Ils reprennent la présentation des documents Word du cabinet.

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { cabinet } from "../cabinet";
import { surfaceCorporelle } from "./calculs";
import type { Facture, Paiement } from "./compta";
import { libelleMode, montant, montantEnLettres, totalLignes } from "./compta-calculs";
import type { Consultation } from "./consultations";
import { trouverModele } from "./comptes-rendus";
import { lignesExamen, type DonneesExamen } from "./comptes-rendus/types";
import { lignesETT, type DonneesETT } from "./ett";
import { mesures } from "./mesures";
import type { LigneOrdonnance, TypeOrdonnance } from "./ordonnances";
import type { ElementsRapport } from "./rapport-consultation";
import { age, libellePatient, type Patient } from "./patients";

// Les polices intégrées des PDF ne connaissent que l'alphabet latin courant : le reste est remplacé
const REMPLACEMENTS: Record<string, string> = { "\u202f": " ", "−": "-", "₂": "2", "≥": ">=", "≤": "<=", "→": "->", "≈": "~", " ": "\n" };
const AUTORISES = /[\n -ÿŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]/;
export function propre(texte: string) {
  return [...texte.normalize("NFC")]
    .map((c) => REMPLACEMENTS[c] ?? (AUTORISES.test(c) ? c : c.normalize("NFD").replace(/[^ -ÿ]/g, "")))
    .join("");
}

const jourLong = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${jour}T12:00:00Z`),
  );
const jour = (d: string) => d.split("-").reverse().join("/");
const fr = (n: number, chiffres = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: chiffres });

const s = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#0f172a",
  },
  petitePage: {
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 28,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#0f172a",
  },
  entete: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: "#dc2626",
    paddingBottom: 8,
    marginBottom: 14,
  },
  medecin: { fontFamily: "Helvetica-Bold", fontSize: 13, color: "#b91c1c" },
  gris: { color: "#475569" },
  droite: { alignItems: "flex-end" },
  titre: { fontFamily: "Helvetica-Bold", fontSize: 13, textAlign: "center", marginVertical: 12, letterSpacing: 0.5 },
  gras: { fontFamily: "Helvetica-Bold" },
  ligneTableau: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cbd5e1", paddingVertical: 5 },
  libelle: { width: "30%", fontFamily: "Helvetica-Bold", paddingRight: 8 },
  valeur: { width: "70%" },
  section: { fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4, color: "#b91c1c" },
  pied: { position: "absolute", bottom: 18, left: 40, right: 40, textAlign: "center", fontSize: 7.5, color: "#94a3b8" },
  signature: {
    marginTop: 28,
    alignSelf: "flex-end",
    width: 170,
    height: 70,
    borderTopWidth: 0.5,
    borderTopColor: "#94a3b8",
    paddingTop: 4,
    textAlign: "center",
    fontSize: 8,
    color: "#64748b",
  },
});

// Sur une ordonnance A5, l'adresse passe sous le nom faute de place
function Entete({ compact = false }: { compact?: boolean }) {
  const { adresse, telephones } = cabinet;
  if (compact) {
    return (
      <View style={[s.entete, { flexDirection: "column" }]} fixed>
        <Text style={s.medecin}>{propre(cabinet.medecin)}</Text>
        <Text>
          {propre(cabinet.specialite)}
          {cabinet.inpe ? `  ·  INPE : ${propre(cabinet.inpe)}` : ""}
        </Text>
        <Text style={[s.gris, { fontSize: 8, marginTop: 3 }]}>
          {propre(`${adresse.rue}, ${adresse.codePostal} ${adresse.ville}`)}
        </Text>
        <Text style={[s.gris, { fontSize: 8 }]}>
          Tél. {telephones.fixe.numero} · {telephones.mobile.numero}
        </Text>
      </View>
    );
  }
  return (
    <View style={s.entete} fixed>
      <View>
        <Text style={s.medecin}>{propre(cabinet.medecin)}</Text>
        <Text>{propre(cabinet.specialite)}</Text>
        {cabinet.inpe && <Text style={s.gris}>INPE : {propre(cabinet.inpe)}</Text>}
      </View>
      <View style={s.droite}>
        <Text style={s.gris}>{propre(adresse.rue)}</Text>
        <Text style={s.gris}>{propre(`${adresse.codePostal} ${adresse.ville}`)}</Text>
        <Text style={s.gris}>
          Tél. {telephones.fixe.numero} · {telephones.mobile.numero}
        </Text>
      </View>
    </View>
  );
}

function Pied() {
  return (
    <Text style={s.pied} fixed>
      Cabinet de Cardiologie Mesnana — {cabinet.site.replace("https://", "")}
    </Text>
  );
}

// Plusieurs lignes : chaque retour à la ligne devient une ligne du PDF
function Paragraphes({ texte }: { texte: string }) {
  return (
    <>
      {propre(texte)
        .split("\n")
        .filter((l) => l.trim())
        .map((l, i) => (
          <Text key={i}>{l}</Text>
        ))}
    </>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <View style={s.ligneTableau} wrap={false}>
      <Text style={s.libelle}>{libelle}</Text>
      <View style={s.valeur}>{children}</View>
    </View>
  );
}

// --- Ordonnance ---

export function pdfOrdonnance(
  o: { date: string; lignes: LigneOrdonnance[]; remarque: string; examens?: string; type?: TypeOrdonnance },
  patient: Patient,
) {
  const biologie = o.type === "biologie";
  const ans = age(patient.naissance, o.date);
  return renderToBuffer(
    <Document title={`${biologie ? "Prescription d'analyses" : "Ordonnance"} ${libellePatient(patient)} ${jour(o.date)}`} author={cabinet.medecin}>
      <Page size="A5" style={s.petitePage}>
        <Entete compact />
        <Text style={{ textAlign: "right" }}>
          {propre(cabinet.adresse.ville)}, le {jourLong(o.date)}
        </Text>
        <Text style={{ marginTop: 8 }}>
          <Text style={s.gras}>{propre(libellePatient(patient))}</Text>
          {ans !== null ? `  —  ${ans} ans` : ""}
        </Text>
        <Text style={s.titre}>{biologie ? "PRESCRIPTION D'ANALYSES BIOLOGIQUES" : "ORDONNANCE"}</Text>
        {biologie && <Text style={{ marginBottom: 6 }}>Prière de bien vouloir effectuer les analyses suivantes :</Text>}
        {o.lignes.map((l, i) =>
          biologie ? (
            <Text key={i} style={{ marginBottom: 3, marginLeft: 8 }}>
              {"-  "}
              {propre(l.medicament)}
            </Text>
          ) : (
          <View key={i} style={{ marginBottom: 9 }} wrap={false}>
            <Text style={s.gras}>
              {i + 1}. {propre(l.medicament)}
            </Text>
            {(l.posologie || l.duree) && (
              <Text style={{ marginLeft: 12 }}>
                {propre([l.posologie, l.duree && `pendant ${l.duree}`].filter(Boolean).join(" — "))}
              </Text>
            )}
          </View>
          ),
        )}
        {o.remarque && (
          <View style={{ marginTop: 6 }}>
            <Paragraphes texte={o.remarque} />
          </View>
        )}
        {o.examens?.trim() && (
          <View style={{ marginTop: 8 }}>
            <Text style={s.gras}>Examens demandés :</Text>
            <Paragraphes texte={o.examens} />
          </View>
        )}
        <Text style={s.signature}>Signature et cachet</Text>
        <Pied />
      </Page>
    </Document>,
  );
}

// --- Certificat médical ---

export function pdfCertificat(c: { date: string; modele: string; texte: string }, patient: Patient, format: "A5" | "A4" = "A5") {
  const petit = format === "A5";
  // Un paragraphe par bloc séparé d'une ligne vide ; les retours à la ligne simples sont conservés (liste de lésions)
  const blocs = propre(c.texte)
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const dernier = blocs.length - 1;
  return renderToBuffer(
    <Document title={`Certificat ${libellePatient(patient)} ${jour(c.date)}`} author={cabinet.medecin}>
      <Page size={format} style={petit ? s.petitePage : s.page}>
        <Entete compact={petit} />
        <Text style={{ textAlign: "right" }}>
          {propre(cabinet.adresse.ville)}, le {jourLong(c.date)}
        </Text>
        <Text style={s.titre}>CERTIFICAT MÉDICAL</Text>
        {blocs.map((b, i) => (
          <View key={i} style={{ marginBottom: 8 }} wrap={i !== dernier}>
            {b.split("\n").map((l, j) => (
              <Text key={j} style={{ lineHeight: 1.1 }}>
                {l}
              </Text>
            ))}
          </View>
        ))}
        <Text style={s.signature}>Signature et cachet</Text>
        <Pied />
      </Page>
    </Document>,
  );
}

// --- Courrier au confrère ---

export function pdfCourrier(c: { date: string; destinataire: string; objet: string; texte: string }) {
  return renderToBuffer(
    <Document title={propre(c.objet)} author={cabinet.medecin}>
      <Page size="A4" style={s.page}>
        <Entete />
        <Text style={{ textAlign: "right" }}>
          {propre(cabinet.adresse.ville)}, le {jourLong(c.date)}
        </Text>
        {c.destinataire && (
          <Text style={[s.gras, { marginTop: 14 }]}>{propre(c.destinataire)}</Text>
        )}
        <Text style={[s.gras, { marginTop: 14, marginBottom: 12 }]}>{propre(c.objet)}</Text>
        {propre(c.texte)
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((p, i) => (
            <Text key={i} style={{ marginBottom: 8, lineHeight: 1.4 }}>
              {p.trim()}
            </Text>
          ))}
        <Text style={s.signature}>Signature et cachet</Text>
        <Pied />
      </Page>
    </Document>,
  );
}

// --- Rapport de consultation ---

export function pdfConsultation(
  c: Consultation,
  patient: Patient,
  traitements: string[],
  // Examens, calculs, ordonnances et facture rattachés à la consultation
  rattaches: ElementsRapport = { calculs: [], examens: [], ordonnances: [], factures: [] },
) {
  const ans = age(patient.naissance, c.date);
  const sc = surfaceCorporelle(c.poids, c.taille);
  const constantes = [
    c.taSys && c.taDia && `TA : ${c.taSys}/${c.taDia} mmHg`,
    c.fc && `FC : ${c.fc} bpm`,
    c.spo2 && `SpO2 : ${c.spo2} %`,
    c.taille && `Taille : ${c.taille} cm`,
    c.poids && `Poids : ${fr(c.poids)} kg`,
    sc && `SC : ${fr(sc, 2)} m²`,
  ].filter(Boolean);
  const valeurs = mesures.flatMap((m) =>
    c.mesures[m.cle] !== undefined ? [`${m.libelle} : ${fr(c.mesures[m.cle]!, 2)}${m.unite ? ` ${m.unite}` : ""}`] : [],
  );
  const antecedents = [patient.facteursRisque.join(", "), patient.antecedents].filter(Boolean).join("\n");

  return renderToBuffer(
    <Document title={`Consultation ${libellePatient(patient)} ${jour(c.date)}`} author={cabinet.medecin}>
      <Page size="A4" style={s.page}>
        <Entete />
        <Text style={{ textAlign: "right" }}>Date : {jour(c.date)}</Text>
        <Text style={s.titre}>RAPPORT DE CONSULTATION DE CARDIOLOGIE</Text>
        <Ligne libelle="Nom, prénom">
          <Text>{propre(libellePatient(patient))}</Text>
        </Ligne>
        {patient.naissance && (
          <Ligne libelle="Date de naissance">
            <Text>
              {jour(patient.naissance)}
              {ans !== null ? ` (${ans} ans)` : ""}
            </Text>
          </Ligne>
        )}
        {antecedents && (
          <Ligne libelle="Antécédents / FDRCV">
            <Paragraphes texte={antecedents} />
          </Ligne>
        )}
        {patient.allergies && (
          <Ligne libelle="Allergies">
            <Text>{propre(patient.allergies)}</Text>
          </Ligne>
        )}
        {traitements.length > 0 && (
          <Ligne libelle="Traitement en cours">
            <Paragraphes texte={traitements.join("\n")} />
          </Ligne>
        )}
        {c.motif && (
          <Ligne libelle="Motif de consultation">
            <Paragraphes texte={c.motif} />
          </Ligne>
        )}
        {(constantes.length > 0 || c.examen) && (
          <Ligne libelle="Examen physique">
            {constantes.length > 0 && <Text>{propre(constantes.join("   "))}</Text>}
            {c.examen && <Paragraphes texte={c.examen} />}
          </Ligne>
        )}
        {c.ecg && (
          <Ligne libelle="Électrocardiogramme">
            <Paragraphes texte={c.ecg} />
          </Ligne>
        )}
        {c.echo && (
          <Ligne libelle="Échographie cardiaque">
            <Paragraphes texte={c.echo} />
          </Ligne>
        )}
        {(valeurs.length > 0 || c.autres) && (
          <Ligne libelle="Biologie et autres résultats">
            {valeurs.length > 0 && <Text>{propre(valeurs.join("   "))}</Text>}
            {c.autres && <Paragraphes texte={c.autres} />}
          </Ligne>
        )}
        {rattaches.examens.length > 0 && (
          <Ligne libelle="Examens complémentaires">
            <Paragraphes texte={rattaches.examens.join("\n")} />
          </Ligne>
        )}
        {rattaches.calculs.length > 0 && (
          <Ligne libelle="Calculs et scores">
            <Paragraphes texte={rattaches.calculs.join("\n")} />
          </Ligne>
        )}
        {c.conclusion && (
          <Ligne libelle="Conclusion">
            <Paragraphes texte={c.conclusion} />
          </Ligne>
        )}
        {c.conduite && (
          <Ligne libelle="Conduite à tenir">
            <Paragraphes texte={c.conduite} />
          </Ligne>
        )}
        {rattaches.ordonnances.length > 0 && (
          <Ligne libelle="Ordonnance">
            <Paragraphes texte={rattaches.ordonnances.join("\n")} />
          </Ligne>
        )}
        {rattaches.factures.length > 0 && (
          <Ligne libelle="Facture">
            <Paragraphes texte={rattaches.factures.join("\n")} />
          </Ligne>
        )}
        <Text style={s.signature}>Signature et cachet</Text>
        <Pied />
      </Page>
    </Document>,
  );
}

// --- Compte rendu d'échocardiographie-Doppler ---

export function pdfETT(d: DonneesETT, date: string, patient: Patient) {
  const ans = age(patient.naissance, date);
  const { mesures2D, doppler, sc } = lignesETT(d);
  return renderToBuffer(
    <Document title={`ETT ${libellePatient(patient)} ${jour(date)}`} author={cabinet.medecin}>
      <Page size="A4" style={s.page}>
        <Entete />
        <Text style={s.titre}>COMPTE RENDU D&apos;ÉCHOCARDIOGRAPHIE-DOPPLER</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text>
            <Text style={s.gras}>Malade : </Text>
            {propre(libellePatient(patient))}
          </Text>
          {ans !== null && (
            <Text>
              <Text style={s.gras}>Âge : </Text>
              {ans} ans
            </Text>
          )}
          <Text>
            <Text style={s.gras}>Date : </Text>
            {jour(date)}
          </Text>
        </View>
        {d.indication && (
          <Text>
            <Text style={s.gras}>Indication : </Text>
            {propre(d.indication)}
          </Text>
        )}
        <Text>
          <Text style={s.gras}>Opérateur : </Text>
          {propre(d.operateur)}
          {sc ? `      SC : ${fr(sc, 2)} m²` : ""}
        </Text>

        {mesures2D.length > 0 && (
          <>
            <Text style={s.section}>Mesures 2D</Text>
            {mesures2D.map((l, i) => (
              <Text key={i} style={{ marginBottom: 2 }}>
                {propre(l)}
              </Text>
            ))}
          </>
        )}
        {doppler.length > 0 && (
          <>
            <Text style={s.section}>Doppler</Text>
            {doppler.map((l, i) => (
              <Text key={i} style={{ marginBottom: 2 }}>
                {propre(l)}
              </Text>
            ))}
          </>
        )}
        {d.total && (
          <View wrap={false}>
            <Text style={[s.section, { fontSize: 11 }]}>AU TOTAL</Text>
            <View style={s.gras}>
              <Paragraphes texte={d.total} />
            </View>
          </View>
        )}
        {d.references && d.references.length > 0 && (
          <View wrap={false}>
            <Text style={s.section}>Références</Text>
            {d.references.map((l, i) => (
              <Text key={i} style={{ fontSize: 8, color: "#475569", marginBottom: 2 }}>
                {propre(l)}
              </Text>
            ))}
          </View>
        )}
        <Text style={s.signature}>Signature et cachet</Text>
        <Pied />
      </Page>
    </Document>,
  );
}

// --- Compte rendu d'ECG, de MAPA ou d'épreuve d'effort ---

export function pdfCompteRendu(d: DonneesExamen, date: string, patient: Patient) {
  const modele = trouverModele(d.modele);
  if (!modele) throw new Error(`Modèle inconnu : ${d.modele}`);
  const ans = age(patient.naissance, date);
  const { sections, calculs } = lignesExamen(modele, d);
  return renderToBuffer(
    <Document title={`${modele.bouton} ${libellePatient(patient)} ${jour(date)}`} author={cabinet.medecin}>
      <Page size="A4" style={s.page}>
        <Entete />
        <Text style={s.titre}>{propre(modele.titre)}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text>
            <Text style={s.gras}>Malade : </Text>
            {propre(libellePatient(patient))}
          </Text>
          {ans !== null && (
            <Text>
              <Text style={s.gras}>Âge : </Text>
              {ans} ans
            </Text>
          )}
          <Text>
            <Text style={s.gras}>Date : </Text>
            {jour(date)}
          </Text>
        </View>
        {d.indication && (
          <Text>
            <Text style={s.gras}>Indication : </Text>
            {propre(d.indication)}
          </Text>
        )}
        <Text>
          <Text style={s.gras}>Opérateur : </Text>
          {propre(d.operateur)}
        </Text>
        {sections.map((sec) => (
          <View key={sec.titre}>
            <Text style={s.section}>{propre(sec.titre)}</Text>
            {sec.lignes.map((l, i) => (
              <Text key={i} style={{ marginBottom: 2 }}>
                {propre(l)}
              </Text>
            ))}
          </View>
        ))}
        {calculs.length > 0 && (
          <>
            <Text style={s.section}>Calculs</Text>
            {calculs.map((l, i) => (
              <Text key={i} style={{ marginBottom: 2 }}>
                {propre(l)}
              </Text>
            ))}
          </>
        )}
        {d.total && (
          <View wrap={false}>
            <Text style={[s.section, { fontSize: 11 }]}>AU TOTAL</Text>
            <View style={s.gras}>
              <Paragraphes texte={d.total} />
            </View>
          </View>
        )}
        {d.references && d.references.length > 0 && (
          <View wrap={false}>
            <Text style={s.section}>Références</Text>
            {d.references.map((l, i) => (
              <Text key={i} style={{ fontSize: 8, color: "#475569", marginBottom: 2 }}>
                {propre(l)}
              </Text>
            ))}
          </View>
        )}
        <Text style={s.signature}>Signature et cachet</Text>
        <Pied />
      </Page>
    </Document>,
  );
}

// --- Facture (honoraires) ---

export function pdfFacture(f: Facture, paiements: Paiement[], patient: Patient | null) {
  const reste = f.totalCts - f.payeCts;
  const colonnes = { designation: { width: "52%" }, quantite: { width: "10%", textAlign: "right" as const }, prix: { width: "19%", textAlign: "right" as const }, total: { width: "19%", textAlign: "right" as const } };
  const mad = (cts: number) => `${montant(cts)} MAD`;
  return renderToBuffer(
    <Document title={`Facture ${f.numero}`} author={cabinet.medecin}>
      <Page size="A4" style={s.page}>
        <Entete />
        {cabinet.ice && <Text style={[s.gris, { fontSize: 8 }]}>ICE : {propre(cabinet.ice)}</Text>}
        <Text style={s.titre}>FACTURE N° {f.numero}</Text>
        {f.annulee && (
          <Text style={{ textAlign: "center", color: "#b91c1c", fontFamily: "Helvetica-Bold", marginBottom: 8 }}>
            ANNULEE{f.motifAnnulation ? ` — ${propre(f.motifAnnulation)}` : ""}
          </Text>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
          <View>
            <Text style={s.gris}>Patient</Text>
            <Text style={s.gras}>{propre(f.patientNom)}</Text>
            {patient?.cin ? <Text style={s.gris}>CIN : {propre(patient.cin)}</Text> : null}
          </View>
          <View style={s.droite}>
            <Text>
              {propre(cabinet.adresse.ville)}, le {jourLong(f.date)}
            </Text>
            <Text style={s.gris}>Médecin : {propre(f.praticienNom)}</Text>
          </View>
        </View>

        <View style={[s.ligneTableau, { borderBottomColor: "#0f172a", borderBottomWidth: 1 }]}>
          <Text style={[s.gras, colonnes.designation]}>Désignation</Text>
          <Text style={[s.gras, colonnes.quantite]}>Qté</Text>
          <Text style={[s.gras, colonnes.prix]}>Prix unitaire</Text>
          <Text style={[s.gras, colonnes.total]}>Montant</Text>
        </View>
        {f.lignes.map((l, i) => (
          <View key={i} style={s.ligneTableau} wrap={false}>
            <Text style={colonnes.designation}>{propre(l.libelle)}</Text>
            <Text style={colonnes.quantite}>{fr(l.quantite, 2)}</Text>
            <Text style={colonnes.prix}>{mad(l.prixCts)}</Text>
            <Text style={colonnes.total}>{mad(Math.round(l.quantite * l.prixCts))}</Text>
          </View>
        ))}

        <View style={{ marginTop: 10, alignSelf: "flex-end", width: "50%" }} wrap={false}>
          {f.remiseCts > 0 && (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={s.gris}>Sous-total</Text>
                <Text>{mad(totalLignes(f.lignes))}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={s.gris}>Remise</Text>
                <Text>- {mad(f.remiseCts)}</Text>
              </View>
            </>
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
            <Text style={[s.gras, { fontSize: 12 }]}>TOTAL</Text>
            <Text style={[s.gras, { fontSize: 12 }]}>{mad(f.totalCts)}</Text>
          </View>
          {f.payeCts > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
              <Text style={s.gris}>Déjà réglé</Text>
              <Text>{mad(f.payeCts)}</Text>
            </View>
          )}
          {!f.annulee && reste > 0 && f.payeCts > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={s.gras}>Reste à payer</Text>
              <Text style={s.gras}>{mad(reste)}</Text>
            </View>
          )}
        </View>

        <Text style={{ marginTop: 16 }}>
          Arrêtée la présente facture à la somme de{" "}
          <Text style={s.gras}>{propre(montantEnLettres(f.totalCts))}</Text>.
        </Text>
        {paiements.length > 0 && (
          <Text style={[s.gris, { marginTop: 6 }]}>
            Règlement :{" "}
            {propre(paiements.map((p) => `${jour(p.date)} ${libelleMode(p.mode).toLowerCase()} ${mad(p.montantCts)}`).join(" ; "))}
            {!f.annulee && reste === 0 ? " — acquittée." : "."}
          </Text>
        )}
        {f.note && <Text style={[s.gris, { marginTop: 6 }]}>{propre(f.note)}</Text>}
        <Text style={s.signature}>Signature et cachet</Text>
        <Pied />
      </Page>
    </Document>,
  );
}
