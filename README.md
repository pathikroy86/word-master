# WordMaster GRE App

Full-stack GRE vocabulary app using:

- Next.js frontend in `web/`
- Next.js API routes in `web/pages/api/`
- MongoDB Atlas database `gre_word_master.wordlist`

## Run Locally

```bash
npm install
npm run dev
```

Frontend: `http://localhost:3000`

Backend routes are now served by the same Next.js app under `/api`.

## Environment

Copy `.env.example` to `.env` and set:

```bash
MONGODB_URI=...
MONGODB_DB=gre_word_master
MONGODB_COLLECTION=wordlist
DNS_SERVERS=8.8.8.8,1.1.1.1
```

For local development, these auth values are correct by default:

```bash
BETTER_AUTH_URL=http://localhost:3000/api/auth
NEXT_PUBLIC_AUTH_URL=http://localhost:3000/api/auth
```

If you have old values from the previous Express backend, remove or update them. The app now serves auth at `/api/auth`.

Optional environment variables for auth / external API override:

```bash
NEXT_PUBLIC_AUTH_URL=https://your-app.vercel.app/api/auth
NEXT_PUBLIC_API_URL=https://your-app.vercel.app/api
```

The DNS server override helps Node resolve MongoDB Atlas `mongodb+srv` records on machines where the default resolver refuses SRV lookups.

## Deploy to Vercel

1. Push the repository to GitHub.
2. In Vercel, import the repository.
3. Set the project root to the repository root.
4. Use the build command: `npm run build`.
5. Add the required environment variables in Vercel:
   - `MONGODB_URI`
   - `MONGODB_DB`
   - `MONGODB_COLLECTION`
   - `BETTER_AUTH_SECRET`
   - `AUTH_MONGODB_URI` (optional if auth uses the same MongoDB instance)
   - `NEXT_PUBLIC_AUTH_URL` (optional, only if auth should target a different base URL)
6. Deploy the app.

The Next.js app now serves both the frontend and API routes under `/api`, so no separate Express backend is required.

## API

- `GET /api/health`
- `GET /api/words?search=abate&status=all&limit=50&skip=0`
- `GET /api/words/:id`
- `GET /api/stats`
- `POST /api/words/:id/review` with `{ "status": "learning" | "mastered" | "new" }`

## UI Screens

- Dashboard
- Flashcards
- Word list with detail panel
- Quiz
- Stats
- Saved words
- Settings

The UI is responsive for desktop, tablet, and mobile.

## Deploy To Vercel

This project deploys as one Next.js app. The frontend and API routes both run from the same Vercel deployment.

Use these Vercel settings:

```text
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Development Command: npm run dev
Output Directory: web/.next
Root Directory: .
```

Add these environment variables in Vercel:

```bash
MONGODB_URI=your_gre_words_mongodb_uri
AUTH_MONGODB_URI=your_auth_mongodb_uri
MONGODB_DB=gre_word_master
MONGODB_COLLECTION=wordlist
AUTH_MONGODB_DB=wordmaster_auth
BETTER_AUTH_SECRET=use-a-long-random-secret-at-least-32-characters
NEXT_PUBLIC_API_URL=/api
```

For the first Vercel deployment, `BETTER_AUTH_URL`, `NEXT_PUBLIC_AUTH_URL`, and `WEB_ORIGIN` can be left blank because the app uses Vercel's deployment URL automatically. If you add a custom domain later, set:

```bash
BETTER_AUTH_URL=https://your-domain.com/api/auth
WEB_ORIGIN=https://your-domain.com
```

MongoDB Atlas must allow connections from Vercel. For a quick test, add `0.0.0.0/0` in Atlas Network Access. For production, prefer a tighter network setup if your Vercel plan and infrastructure allow it.

Deploy options:

```bash
npx vercel
```

Or push the repo to GitHub and import it from the Vercel dashboard.
