# WordMaster Figma Handoff

This is the Figma-ready design package for developing WordMaster with Next.js on the frontend and Express.js on the backend.

## Source Files

- Visual design board: `gre-vocab-design.html`
- Design system and component spec: `gre-vocab-design-spec.md`
- Current Next.js reference app: `web/app/page.jsx`
- Current Express API: `server/index.js`

## Figma File Structure

Create a Figma design file named `WordMaster - GRE Vocabulary App`.

Pages:

- `00 Cover`
- `01 Foundations`
- `02 Components`
- `03 Desktop`
- `04 Tablet`
- `05 Mobile`
- `06 API + Data Notes`

Top-level frames:

- `WordMaster / Desktop / Dashboard + Word List` at `1180 x 760`
- `WordMaster / Tablet / Study Session` at `834 x 1040`
- `WordMaster / Mobile / Flashcards` at `390 x 844`

## Fast Import Workflow

1. Open `gre-vocab-design.html` in a browser.
2. Use the Figma plugin `html.to.design` or a similar HTML importer.
3. Import the page into the Figma file.
4. Rename imported artboards to the frame names above.
5. Convert repeated elements into reusable components listed below.
6. Replace raw imported colors and text styles with the foundation tokens.

## Foundations

Typography:

- Font family: `Inter`
- Hero/page title: `30/38`, weight `700`
- Section title: `20/28`, weight `700`
- Card title: `16/24`, weight `700`
- Body: `14/22`, weight `400`
- Caption: `12/18`, weight `500`

Colors:

- `Ink`: `#17212B`
- `Muted`: `#667085`
- `Line`: `#D9E0E8`
- `Surface`: `#FFFFFF`
- `App Background`: `#F8FAFC`
- `Teal`: `#127C79`
- `Blue`: `#315FBC`
- `Gold`: `#B7791F`
- `Coral`: `#D9583F`

Layout:

- Card radius: `8`
- Desktop grid: `252px 1fr 322px`
- Tablet grid: `1.08fr 0.92fr`
- Mobile width: `390`
- List row minimum height: `76`
- Button height: `38-44`

## Components

Create these Figma components from the imported board:

- `Navigation / Sidebar Item`
- `Navigation / Bottom Nav Item`
- `Input / Search`
- `Card / Metric`
- `Card / Study`
- `Row / Word`
- `Panel / Word Detail`
- `Chip / Synonym`
- `Chip / Antonym`
- `Button / Primary`
- `Button / Secondary`
- `Button / Icon`
- `Tabs / Segmented`
- `Status / Pill`

Recommended variants:

- Button: `primary`, `secondary`, `ghost`, `danger`
- Status pill: `new`, `learning`, `mastered`, `review`
- Sidebar item: `default`, `active`, `locked`
- Word row: `default`, `selected`
- Bottom nav item: `default`, `active`

## Next.js Mapping

Use these React components:

- `AppShell`
- `SidebarNav`
- `MobileBottomNav`
- `SessionBar`
- `Dashboard`
- `ProgressMetrics`
- `WordSearch`
- `WordFilterTabs`
- `WordList`
- `WordListRow`
- `WordDetailPanel`
- `FlashcardDeck`
- `StudyCard`
- `QuizPanel`
- `VocabularyChips`
- `ReviewActions`
- `AuthPanel`

Suggested routes:

- `/` public demo/home
- `/dashboard`
- `/words`
- `/words/[id]`
- `/flashcards`
- `/quiz`
- `/stats`
- `/saved`
- `/settings`

## Express API Mapping

Keep the API contract aligned with the current server:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/words`
- `GET /api/words/:id`
- `POST /api/words`
- `POST /api/words/:id/review`
- `POST /api/words/:id/save`
- `GET /api/stats`

Data model:

```ts
export type ReviewStatus = "new" | "learning" | "mastered";

export type Word = {
  id: string;
  word: string;
  partOfSpeech: string;
  pronunciation?: string;
  meaning: string;
  bangla?: string;
  synonyms: string[];
  antonyms: string[];
  example?: string;
  status: ReviewStatus;
  frequencyRank?: number;
  saved?: boolean;
};
```

## Implementation Notes

- Store selected desktop word in URL state, for example `/words?selected=abate`.
- Server-render the first word list page, then hydrate search/filter/review actions client-side.
- Use optimistic updates for review status and saved words.
- Keep mobile flashcards as one-card-per-screen with bottom navigation.
- Keep desktop word detail as a right-side panel, not a modal.
- Preserve the Figma component names in React component names where practical.
