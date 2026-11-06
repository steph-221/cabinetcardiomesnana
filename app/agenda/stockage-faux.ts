// Faux stockage Redis en mémoire, pour les tests de sécurité (jamais utilisé par le site lui-même).
// Chaque commande rend la main une fois (`await`) comme le ferait un vrai appel réseau : les essais
// simultanés se croisent donc comme en production.

export function creerStockageFaux() {
  const donnees = new Map<string, string>();
  async function commande<T>(...args: string[]): Promise<T> {
    await Promise.resolve();
    const [cmd, cle, ...reste] = args;
    switch (cmd) {
      case "INCR":
      case "DECR": {
        const n = (Number(donnees.get(cle)) || 0) + (cmd === "INCR" ? 1 : -1);
        donnees.set(cle, String(n));
        return n as T;
      }
      case "EXPIRE":
        return 1 as T;
      case "GET":
        return (donnees.get(cle) ?? null) as T;
      case "DEL":
        donnees.delete(cle);
        return 1 as T;
      case "SET":
        if (reste.includes("NX") && donnees.has(cle)) return null as T;
        donnees.set(cle, reste[0]);
        return "OK" as T;
      default:
        throw new Error(`Commande non gérée par le faux stockage : ${cmd}`);
    }
  }
  return { commande, stockageConfigure: () => true, donnees };
}
