"use client";

import { Printer } from "lucide-react";

export function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
    >
      <Printer className="h-4 w-4" aria-hidden />
      Imprimer
    </button>
  );
}
