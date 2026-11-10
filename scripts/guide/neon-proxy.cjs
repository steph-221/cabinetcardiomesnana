// Imite le point d'accès HTTP de Neon (POST /sql) au-dessus d'un Postgres local, pour faire tourner l'application en démonstration.
const http = require("http");
const { Pool } = require("pg");
const brut = { getTypeParser: () => (v) => v };
const pool = new Pool({ host: "/tmp", port: 5496, user: "postgres", database: "demo", max: 8 });
async function executer(client, { query, params }) {
  const r = await client.query({ text: query, values: params ?? [], rowMode: "array", types: brut });
  return { command: r.command, rowCount: r.rowCount, rows: r.rows, fields: (r.fields ?? []).map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })), rowAsArray: true };
}
http
  .createServer((req, res) => {
    let corps = "";
    req.on("data", (c) => (corps += c));
    req.on("end", async () => {
      const envoyer = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
      try {
        const q = JSON.parse(corps);
        if (Array.isArray(q.queries)) {
          const c = await pool.connect();
          try {
            await c.query("BEGIN");
            const results = [];
            for (const x of q.queries) results.push(await executer(c, x));
            await c.query("COMMIT");
            envoyer(200, { results });
          } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
        } else envoyer(200, await executer(pool, q));
      } catch (e) {
        console.error("SQL:", e.message);
        envoyer(400, { message: e.message, code: e.code, severity: e.severity, detail: e.detail });
      }
    });
  })
  .listen(4444, () => console.log("proxy neon prêt"));
