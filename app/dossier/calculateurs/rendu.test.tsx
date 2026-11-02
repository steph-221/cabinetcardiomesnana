import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CalculateurInteractif } from "../../[lang]/espace/calculateurs/calculateur";
import { calculateurs } from ".";

describe("interface générique", () => {
  it.each(calculateurs.map((c) => [c.slug]))("%s s'affiche avec ses seuls props sérialisables", (slug) => {
    const html = renderToString(<CalculateurInteractif slug={slug} />);
    expect(html).toContain("aria-live");
  });
});
