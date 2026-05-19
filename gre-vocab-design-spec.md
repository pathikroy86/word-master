# GRE Word List Design Spec

## Product Direction

Build a focused GRE vocabulary study app with three primary surfaces:

- Word list dashboard for browsing, filtering, and opening a word detail panel.
- Study session view for tablet-sized learning with a card and adjacent word queue.
- Mobile flashcard view optimized for daily review.

The interface is designed to translate cleanly into Next.js with reusable components, predictable breakpoints, and data-driven word cards.

## Artboards

| View | Size | Purpose |
| --- | ---: | --- |
| Desktop | 1180 x 760 | Sidebar navigation, searchable word list, selected word detail panel |
| Tablet | 834 x 1040 | Study card plus due-word queue in a two-column layout |
| Mobile | 390 x 844 | Single-card review flow with bottom navigation |

## Visual System

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#17212b` | Primary text |
| Muted | `#667085` | Secondary text |
| Line | `#d9e0e8` | Borders and dividers |
| Surface | `#ffffff` | Panels and cards |
| App background | `#f8fafc` | Main app background |
| Teal | `#127c79` | Primary action, mastered status |
| Blue | `#315fbc` | New status |
| Gold | `#b7791f` | Review status |
| Coral | `#d9583f` | Antonyms and destructive contrast |

Use `Inter` for all typography. Keep card radius at `8px`, button height between `38px` and `44px`, and list rows at a stable `76px` minimum height.

## Suggested Next.js Components

- `AppShell`
- `SidebarNav`
- `WordSearch`
- `ProgressMetrics`
- `WordFilterTabs`
- `WordList`
- `WordListRow`
- `WordDetailPanel`
- `StudyCard`
- `VocabularyChips`
- `ReviewActions`
- `MobileBottomNav`

## Breakpoints

```ts
export const breakpoints = {
  mobile: 390,
  tablet: 834,
  desktop: 1180,
};
```

Desktop should use a three-column grid: `252px 1fr 322px`.

Tablet should use a two-column content grid: `1.08fr 0.92fr`, then full-width queue below.

Mobile should show one active word card at a time with compact tabs for meaning, synonyms, and antonyms.

## Data Shape

```ts
export type ReviewStatus = "new" | "review" | "mastered";

export type GreWord = {
  id: string;
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  meaning: string;
  synonyms: string[];
  antonyms: string[];
  example: string;
  status: ReviewStatus;
  frequencyRank: number;
};
```

## Sample Data

```ts
export const greWords: GreWord[] = [
  {
    id: "abate",
    word: "Abate",
    partOfSpeech: "verb",
    pronunciation: "uh-BAYT",
    meaning: "To reduce in intensity or amount; to become less severe.",
    synonyms: ["lessen", "subside", "diminish", "wane"],
    antonyms: ["intensify", "amplify", "escalate"],
    example: "The storm began to abate after midnight, leaving the streets quiet and slick.",
    status: "review",
    frequencyRank: 12
  },
  {
    id: "esoteric",
    word: "Esoteric",
    partOfSpeech: "adjective",
    pronunciation: "es-uh-TER-ik",
    meaning: "Known by a small, specialized group; not intended for broad public understanding.",
    synonyms: ["arcane", "obscure", "recondite"],
    antonyms: ["common", "accessible", "mainstream"],
    example: "The professor's esoteric references delighted specialists but confused most readers.",
    status: "new",
    frequencyRank: 26
  },
  {
    id: "pernicious",
    word: "Pernicious",
    partOfSpeech: "adjective",
    pronunciation: "per-NISH-us",
    meaning: "Causing serious harm in a gradual or subtle way.",
    synonyms: ["harmful", "damaging", "deleterious"],
    antonyms: ["beneficial", "benign"],
    example: "The policy had a pernicious effect on public trust.",
    status: "review",
    frequencyRank: 34
  }
];
```

## Figma Layer Plan

Create these top-level frames:

- `GRE Vocab / Desktop / Word List`
- `GRE Vocab / Tablet / Study Session`
- `GRE Vocab / Mobile / Flashcards`

Create reusable Figma components:

- `Navigation / Sidebar Item`
- `Input / Search`
- `Card / Metric`
- `Row / Word`
- `Panel / Word Detail`
- `Chip / Synonym`
- `Chip / Antonym`
- `Button / Primary`
- `Button / Secondary`
- `Tabs / Segmented`
- `Mobile / Bottom Nav Item`

## Implementation Notes

- Store active word in URL state on desktop, for example `/words?selected=abate`.
- Use server-rendered list data for SEO and fast first load.
- Hydrate review actions client-side so spaced-repetition updates feel instant.
- Use a responsive `WordDetailPanel`: side panel on desktop, inline panel or route transition on mobile.
- Keep synonyms and antonyms as arrays so chips remain simple map operations.
