import { cha2ds2vaCalculateur } from "./definitions/cha2ds2va";
import { hfaIcosHer2 } from "./definitions/hfa-icos-her2";
import type { Calculateur } from "./types";

export const calculateurs: Calculateur[] = [hfaIcosHer2, cha2ds2vaCalculateur];

export const trouverCalculateur = (slug: string) => calculateurs.find((c) => c.slug === slug);
