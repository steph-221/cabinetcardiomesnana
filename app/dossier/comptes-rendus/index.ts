import { ecg } from "./definitions/ecg";
import { effort } from "./definitions/effort";
import { mapa } from "./definitions/mapa";
import type { ModeleExamen } from "./types";

export const modelesExamen: ModeleExamen[] = [ecg, mapa, effort];
export const trouverModele = (cle: string) => modelesExamen.find((m) => m.cle === cle);
