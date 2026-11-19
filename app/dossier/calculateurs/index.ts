import { cha2ds2vaCalculateur } from "./definitions/cha2ds2va";
import { hfaIcosHer2 } from "./definitions/hfa-icos-her2";
import { dfgCkdEpi, imcCalculateur, friedewald, qtc } from "./definitions/mesures";
import { cha2ds2vasc, hasBled, heart, spesi, timiNstemi, wellsEp, wellsTvp } from "./definitions/scores";
import type { Calculateur } from "./types";

export const calculateurs: Calculateur[] = [
  hfaIcosHer2,
  cha2ds2vaCalculateur,
  cha2ds2vasc,
  hasBled,
  heart,
  timiNstemi,
  wellsEp,
  wellsTvp,
  spesi,
  qtc,
  friedewald,
  dfgCkdEpi,
  imcCalculateur,
];

export const trouverCalculateur = (slug: string) => calculateurs.find((c) => c.slug === slug);
