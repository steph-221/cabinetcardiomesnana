import { ecg } from "./definitions/ecg";
import { dopplerArteriel, dopplerTSA, dopplerVeineux } from "./definitions/doppler";
import { effort } from "./definitions/effort";
import { holter } from "./definitions/holter";
import { mapa } from "./definitions/mapa";
import type { ModeleExamen } from "./types";

export const modelesExamen: ModeleExamen[] = [ecg, holter, mapa, effort, dopplerVeineux, dopplerArteriel, dopplerTSA];
export const trouverModele = (cle: string) => modelesExamen.find((m) => m.cle === cle);
