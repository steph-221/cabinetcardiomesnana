"use client";

import { useFormStatus } from "react-dom";
import { Unplug } from "lucide-react";
import { deconnexionDrive } from "./actions";

export function BoutonDeconnexion({ langue }: { langue: string }) {
  return (
    <form action={deconnexionDrive.bind(null, langue)}>
      <Envoyer />
    </form>
  );
}

function Envoyer() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm("Déconnecter Google Drive ? Les examens ne pourront plus être ajoutés ni ouverts jusqu'à la reconnexion.")) {
          e.preventDefault();
        }
      }}
      className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      <Unplug className="h-4 w-4" aria-hidden />
      Déconnecter
    </button>
  );
}
