// Petit stockage clé-valeur (Upstash Redis, ajouté depuis Vercel → Storage).
// Vercel renseigne automatiquement KV_REST_API_URL et KV_REST_API_TOKEN.

const config = () => ({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL,
  jeton: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const stockageConfigure = () => {
  const { url, jeton } = config();
  return Boolean(url && jeton);
};

// Exécute une commande Redis, par exemple ["HGET", "comptes", "secretaire"]
export async function commande<T>(...args: string[]): Promise<T> {
  const { url, jeton } = config();
  if (!url || !jeton) throw new Error("Stockage non configuré");
  const reponse = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const { result, error } = (await reponse.json()) as { result: T; error?: string };
  if (!reponse.ok || error) throw new Error(`Stockage : ${error ?? reponse.status}`);
  return result;
}
