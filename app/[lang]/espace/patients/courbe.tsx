// Petite courbe d'évolution d'une valeur (INR, TA, FC, poids, FEVG…), dessinée côté serveur en SVG.
// Une seule échelle par courbe ; survol : date et valeur de chaque point ; tableau des valeurs en dessous.

export type Serie = { nom: string; couleur: string; points: { date: string; valeur: number }[] };

// Couleurs des séries (palette validée pour les daltonismes) : bleu, puis orange
export const couleurs = ["#2a78d6", "#eb6834"];

const L = 320;
const H = 140;
const marge = { gauche: 34, droite: 30, haut: 10, bas: 20 };

const jourCourt = (d: string) => {
  const [a, m, j] = d.split("-");
  return `${j}/${m}/${a.slice(2)}`;
};
const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

// Graduations « rondes » couvrant l'intervalle
function graduations(min: number, max: number) {
  const pas0 = (max - min) / 3 || 1;
  const puissance = 10 ** Math.floor(Math.log10(pas0));
  const pas = [1, 2, 2.5, 5, 10].map((k) => k * puissance).find((p) => p >= pas0)!;
  const debut = Math.floor(min / pas) * pas;
  const fin = Math.ceil(max / pas) * pas;
  const liste: number[] = [];
  for (let v = debut; v <= fin + pas / 2; v += pas) liste.push(Math.round(v * 1000) / 1000);
  return liste;
}

export function Courbe({
  titre,
  unite,
  series,
  bande,
}: {
  titre: string;
  unite: string;
  series: Serie[];
  bande?: { min: number; max: number };
}) {
  const points = series.flatMap((s) => s.points);
  if (!points.length) return null;

  const temps = (d: string) => new Date(`${d}T12:00:00Z`).getTime();
  const t0 = Math.min(...points.map((p) => temps(p.date)));
  const t1 = Math.max(...points.map((p) => temps(p.date)));
  const valeurs = [...points.map((p) => p.valeur), ...(bande ? [bande.min, bande.max] : [])];
  const ticks = graduations(Math.min(...valeurs), Math.max(...valeurs));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];

  const x = (d: string) =>
    t1 === t0
      ? (marge.gauche + L - marge.droite) / 2
      : marge.gauche + ((temps(d) - t0) / (t1 - t0)) * (L - marge.gauche - marge.droite);
  const y = (v: number) => H - marge.bas - ((v - y0) / (y1 - y0 || 1)) * (H - marge.haut - marge.bas);
  const dates = [...new Set(points.map((p) => p.date))].sort();
  const derniere = (s: Serie) => s.points[s.points.length - 1];

  return (
    <figure className="rounded-xl border border-slate-200 p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-slate-900">
          {titre} {unite && <span className="font-normal text-slate-500">({unite})</span>}
        </span>
        {/* Légende dès deux séries ; la zone cible est nommée aussi */}
        {(series.length > 1 || bande) && (
          <span className="flex flex-wrap gap-3 text-xs text-slate-600">
            {series.length > 1 &&
              series.map((s) => (
                <span key={s.nom} className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.couleur }} aria-hidden />
                  {s.nom}
                </span>
              ))}
            {bande && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm bg-slate-200" aria-hidden />
                zone cible {fr(bande.min)}–{fr(bande.max)}
              </span>
            )}
          </span>
        )}
      </figcaption>

      <svg viewBox={`0 0 ${L} ${H}`} className="mt-2 w-full" role="img" aria-label={`Évolution : ${titre}`}>
        {bande && (
          <rect
            x={marge.gauche}
            width={L - marge.gauche - marge.droite}
            y={y(bande.max)}
            height={y(bande.min) - y(bande.max)}
            fill="#e2e8f0"
            opacity={0.7}
          />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={marge.gauche} x2={L - marge.droite} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={marge.gauche - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={9} fill="#64748b">
              {fr(t)}
            </text>
          </g>
        ))}
        <text x={x(dates[0])} y={H - 4} fontSize={9} fill="#64748b" textAnchor={dates.length > 1 ? "start" : "middle"}>
          {jourCourt(dates[0])}
        </text>
        {dates.length > 1 && (
          <text x={x(dates[dates.length - 1])} y={H - 4} fontSize={9} fill="#64748b" textAnchor="end">
            {jourCourt(dates[dates.length - 1])}
          </text>
        )}

        {series.map((s) => (
          <g key={s.nom}>
            <polyline
              points={s.points.map((p) => `${x(p.date)},${y(p.valeur)}`).join(" ")}
              fill="none"
              stroke={s.couleur}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.points.map((p, i) => (
              <g key={i}>
                <circle cx={x(p.date)} cy={y(p.valeur)} r={4} fill={s.couleur} stroke="#ffffff" strokeWidth={2} />
                {/* Zone de survol plus large que le point */}
                <circle cx={x(p.date)} cy={y(p.valeur)} r={10} fill="transparent">
                  <title>{`${jourCourt(p.date)} — ${series.length > 1 ? `${s.nom} ` : ""}${fr(p.valeur)}${unite ? ` ${unite}` : ""}`}</title>
                </circle>
              </g>
            ))}
            {/* Dernière valeur écrite au bout de la courbe */}
            <text
              x={x(derniere(s).date) + 7}
              y={y(derniere(s).valeur)}
              dy="0.32em"
              fontSize={9}
              fontWeight={600}
              fill="#334155"
            >
              {fr(derniere(s).valeur)}
            </text>
          </g>
        ))}
      </svg>

      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-900">Tableau des valeurs</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 font-medium">Date</th>
              {series.map((s) => (
                <th key={s.nom} className="py-1 font-medium">
                  {s.nom}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {[...dates].reverse().map((d) => (
              <tr key={d} className="border-t border-slate-100">
                <td className="py-1">{jourCourt(d)}</td>
                {series.map((s) => {
                  const p = s.points.find((q) => q.date === d);
                  return (
                    <td key={s.nom} className="py-1">
                      {p ? fr(p.valeur) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
