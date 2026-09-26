# Aqaree backend (step 4: skeleton)

Minimal Express API. Right now it only answers `/health` — real
endpoints (auth, properties, …) land here in steps 6–16.

## Run locally

```bash
cd server
cp .env.example .env   # then fill in values
npm install
npm run dev            # or: npm start
curl http://localhost:8000/health
```

## Deploy on Render (step 5)

1. Push this folder to GitHub as its own repo (`aqaree-server`).
2. Render dashboard → New → **Blueprint** → connect the repo
   (uses `render.yaml`; region Frankfurt to sit next to the Neon DB).
3. Fill the `sync: false` env vars (DATABASE_URL, Cloudinary, Brevo).
4. Deploy → open `https://aqaree-server.onrender.com/health`.
