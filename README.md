# WordMaster

Cross-platform GRE vocabulary app built with React Native and Expo.

## Run Locally

```bash
npm install
npm run dev
```

Then choose a target from the Expo terminal:

- `a` for Android emulator or a connected Android device
- `i` for iOS simulator on macOS
- scan the QR code with Expo Go on a phone
- `w` for the web build

Direct scripts are also available:

```bash
npm run android
npm run ios
npm run web
```

## Store Builds

This app is configured for EAS production builds.

First install dependencies and log in to Expo:

```bash
npm install
npm install --global eas-cli
eas login
```

Set the production API URL before building. For store builds, set it in EAS project environment variables:

```bash
EXPO_PUBLIC_API_URL=https://your-api.example.com/api
```

For the first build, EAS may ask to create or link an Expo project and configure Android/iOS signing credentials.

Build the Play Store Android App Bundle:

```bash
npm run build:android
```

Build the App Store iOS IPA:

```bash
npm run build:ios
```

Build both:

```bash
npm run build:all
```

EAS will ask for the signing credentials needed by Google Play and Apple App Store Connect. When the builds finish, Expo gives you download links for the `.aab` and `.ipa` files.

Submit builds through EAS:

```bash
npm run submit:android
npm run submit:ios
```

## Features

- Native dashboard with study stats
- Flashcards with pronunciation
- Multiple-choice quiz
- Searchable word list with review status
- Saved words
- Weekly activity and quiz accuracy
- Offline local persistence with AsyncStorage
- Optional API sync through `EXPO_PUBLIC_API_URL`

## Environment

The mobile app reads and writes MongoDB through the local API server in `server/index.js`. Do not connect a mobile app directly to MongoDB because that would expose your database credentials.

Create `.env` from `.env.example`:

```bash
PORT=4000
MONGODB_URI=mongodb+srv://USER:PASSWORD@HOST/?appName=Cluster0
MONGODB_DB=gre_word_master
MONGODB_COLLECTION=wordlist
JWT_SECRET=replace-this-with-a-long-random-secret
DNS_SERVERS=8.8.8.8,1.1.1.1
EXPO_PUBLIC_API_URL=http://localhost:4000/api
```

Run the API:

```bash
npm run api
```

Run the app in another terminal:

```bash
npm run dev
```

For Android emulator, `http://localhost:4000/api` usually works through Expo web but a physical phone needs your computer LAN IP, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.25:4000/api
```

Your phone and computer must be on the same Wi-Fi, and the API listens on `0.0.0.0`.

## Production API

For login and progress sync from any device, deploy the API server publicly. This repo includes:

- `server/index.js` for the Express API
- `Procfile` for Procfile-based Node hosts
- `render.yaml` for Render blueprint deployment

On your hosting provider, set these environment variables:

```bash
MONGODB_URI=your_mongodb_atlas_connection_string
MONGODB_DB=gre_word_master
MONGODB_COLLECTION=wordlist
JWT_SECRET=use-a-long-random-secret
```

Use this start command:

```bash
npm run start:api
```

After deployment, verify:

```text
https://your-api-domain.com/api/health
```

It should return:

```json
{ "ok": true, "database": "connected" }
```

Then set your mobile app API URL to the public API before building store apps:

```bash
EXPO_PUBLIC_API_URL=https://your-api-domain.com/api
```

For EAS builds, set `EXPO_PUBLIC_API_URL` in the EAS production environment, then rebuild:

```bash
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://your-api-domain.com/api
npm run build:android
npm run build:ios
```

Expected API routes:

- `POST /auth/register` with `{ "email": "...", "password": "...", "name": "..." }`
- `POST /auth/login` with `{ "email": "...", "password": "..." }`
- `GET /auth/me`
- `GET /words?limit=200`
- `POST /words/:id/review` with `{ "status": "learning" | "mastered" | "new" }`
- `POST /words/:id/save` with `{ "saved": true | false }`

Review and save routes require `Authorization: Bearer <token>`. User progress is stored in MongoDB in the `word_progress` collection, keyed by user and word, so each email account can sync its own progress across devices.

## Project Structure

```text
App.js                  Native app shell and screens
src/data/words.js       Bundled offline word list
src/lib/storage.js      AsyncStorage helpers
src/lib/word-search.js  Shared filtering and status helpers
web/                    Previous web implementation kept for reference
```

## Notes

This repository no longer runs as a Next.js app by default. The root scripts now target Expo so the same React Native code can run on iOS, Android, and web.
