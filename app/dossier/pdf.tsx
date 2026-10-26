// Documents PDF du cabinet : ordonnance (A5), rapport de consultation et compte rendu d'ETT (A4),
// avec l'en-tête du cabinet. Ils reprennent la présentation des documents Word du cabinet.

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { cabinet } from "../cabinet";
import { surfaceCorporelle } from "./calculs";
import type { Consultation } from "./consultations";
import { lignesETT, type DonneesETT } from "./ett";
import { mesures } from "./mesures";
import type { LigneOrdonnance } from "./ordonnances";
import { age, libellePatient, type Patient } from "./patients";

// Les polices intégrées des PDF ne connaissent que l'alphabet latin courant : le reste est remplacé
const REMPLACEMENTS: Record<string, string> = { "₂": "2", "≥": ">=", "≤": "<=", "→": "->", "≈": "~", " ": "\n" };
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

export function pdfOrdonnance(o: { date: string; lignes: LigneOrdonnance[]; remarque: string }, patient: Patient) {
  const ans = age(patient.naissance, o.date);
  return renderToBuffer(
    <Document title={`Ordonnance ${libellePatient(patient)} ${jour(o.date)}`} author={cabinet.medecin}>
      <Page size="A5" style={s.petitePage}>
        <Entete compact />
        <Text style={{ textAlign: "right" }}>
          {propre(cabinet.adresse.ville)}, le {jourLong(o.date)}
        </Text>
        <Text style={{ marginTop: 8 }}>
          <Text style={s.gras}>{propre(libellePatient(patient))}</Text>
          {ans !== null ? `  —  ${ans} ans` : ""}
        </Text>
        <Text style={s.titre}>ORDONNANCE</Text>
        {o.lignes.map((l, i) => (
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
        ))}
        {o.remarque && (
          <View style={{ marginTop: 6 }}>
            <Paragraphes texte={o.remarque} />
          </View>
        )}
        <Text style={s.signature}>Signature et cachet</Text>
        <Pied />
      </Page>
    </Document>,
  );
}

// --- Rapport de consultation ---

export function pdfConsultation(c: Consultation, patient: Patient, traitements: string[]) {
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
        {(valeurs.length > 0 || c.autres) && (
          <Ligne libelle="Autres">
            {valeurs.length > 0 && <Text>{propre(valeurs.join("   "))}</Text>}
            {c.autres && <Paragraphes texte={c.autres} />}
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
        <Text style={s.signature}>Signature et cachet</Text>
        <Pied />
      </Page>
    </Document>,
  );
}
