# WordMaster GRE App

Full-stack GRE vocabulary app using:

- Next.js frontend in `web/`
- Express API in `server/`
- MongoDB Atlas database `gre_word_master.wordlist`

## Run Locally

```bash
npm install
npm run dev
```

Frontend: `http://localhost:3000`

Backend health check: `http://localhost:4000/api/health`

## Environment

Copy `.env.example` to `.env` and set:

```bash
MONGODB_URI=...
MONGODB_DB=gre_word_master
MONGODB_COLLECTION=wordlist
PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
DNS_SERVERS=8.8.8.8,1.1.1.1
```

The DNS server override helps Node resolve MongoDB Atlas `mongodb+srv` records on machines where the default resolver refuses SRV lookups.

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
