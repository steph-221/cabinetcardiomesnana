// Passage de la bibliothèque avec les extraits cités surlignés. La recherche tolère les différences d'espaces et de
// retours à la ligne (le texte importé d'un PDF en contient beaucoup).

const echapper = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function zone(texte: string, extrait: string): [number, number] | null {
  const mots = extrait.trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return null;
  const m = new RegExp(mots.map(echapper).join("\\s+")).exec(texte);
  return m ? [m.index, m.index + m[0].length] : null;
}

export function Surligne({ texte, extraits }: { texte: string; extraits: string[] }) {
  const zones = extraits.flatMap((e) => {
    const z = zone(texte, e);
    return z ? [z] : [];
  });
  zones.sort((a, b) => a[0] - b[0]);
  const morceaux: React.ReactNode[] = [];
  let curseur = 0;
  for (const [debut, fin] of zones) {
    if (fin <= curseur) continue;
    const d = Math.max(debut, curseur);
    if (d > curseur) morceaux.push(texte.slice(curseur, d));
    morceaux.push(
      <mark key={d} className="rounded bg-amber-100 px-0.5 text-slate-900">
        {texte.slice(d, fin)}
      </mark>,
    );
    curseur = fin;
  }
  morceaux.push(texte.slice(curseur));
  return <>{morceaux}</>;
}
