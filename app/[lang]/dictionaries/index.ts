import type { Langue } from "../../cabinet";
import fr, { type Dictionnaire } from "./fr";
import ar from "./ar";
import en from "./en";
import es from "./es";

const dictionnaires: Record<Langue, Dictionnaire> = { fr, ar, en, es };

export const getDictionnaire = (langue: Langue) => dictionnaires[langue];
export type { Dictionnaire };
