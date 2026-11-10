# Régénérer le guide du médecin

Le guide (`docs/guide-medecin/`) est fabriqué avec des **données fictives** : un Postgres local, un serveur qui imite l'accès
HTTP de Neon, un agenda Google simulé, puis Playwright pour les captures et le PDF. À refaire quand l'interface change.

```bash
npm i --no-save pg                      # client Postgres pour le faux serveur Neon (hors dépendances du projet)
# 1. Postgres local (port 5496, base « demo », utilisateur postgres, accès « trust »), puis :
node scripts/guide/neon-proxy.cjs &     # imite POST /sql de Neon (port 4444)
# 2. Variables : voir ci-dessous, puis  npm run build && npx next start -p 3200
# 3. Se connecter une fois (crée les tables), puis insérer les données fictives :
psql -h /tmp -p 5496 -U postgres demo -f scripts/guide/seed.sql
# 4. Captures, guide et PDF :
node scripts/guide/captures.cjs && python3 scripts/guide/guide.py && node scripts/guide/pdf.cjs
```

Variables de l'application de démonstration :

```bash
export DATABASE_URL="postgres://postgres@localhost/demo"
export NEON_FETCH_ENDPOINT="http://localhost:4444/sql"
export GOOGLE_SERVICE_ACCOUNT_EMAIL="demo@demo.iam.gserviceaccount.com"
export GOOGLE_PRIVATE_KEY="$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048)"   # clé jetable
export GOOGLE_CALENDAR_ID="demo"
export COMPTE_ADMIN="taouab:MotDePasseDemoTresLong1"
export SESSION_SECRET="dddddddddddddddddddddddddddddddddddddddd"
export ANTHROPIC_API_KEY="cle-de-demonstration-jamais-utilisee"   # affiche les boutons IA, aucun appel n'est fait
export NODE_OPTIONS="--require $PWD/scripts/guide/mock-google.cjs"
```

Aucun vrai patient, aucun vrai service : l'agenda Google et la base sont simulés, les appels à Claude ne sont jamais déclenchés.
