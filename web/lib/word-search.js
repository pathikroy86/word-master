export function normalizeStatusValue(value) {
  const status = String(value || "new")
    .toLowerCase()
    .replace("learned", "mastered")
    .replace("known", "mastered")
    .replace("review", "learning");

  return ["new", "learning", "mastered"].includes(status) ? status : "new";
}

export function getSearchScore(item, query) {
  if (!query) return 0;

  const word = String(item.word || "").toLowerCase();
  const meaning = String(item.meaning || "").toLowerCase();
  const bangla = String(item.bangla || "").toLowerCase();
  const partOfSpeech = String(item.partOfSpeech || "").toLowerCase();
  const synonyms = (item.synonyms || []).join(" ").toLowerCase();
  const antonyms = (item.antonyms || []).join(" ").toLowerCase();

  if (word.startsWith(query)) return 1;
  if (word.includes(query)) return 2;

  if (query.length < 3) return 99;

  if (meaning.startsWith(query)) return 3;
  if (meaning.includes(query)) return 4;
  if (synonyms.split(/\s+/).some((term) => term.startsWith(query))) return 5;
  if (synonyms.includes(query)) return 6;
  if (antonyms.split(/\s+/).some((term) => term.startsWith(query))) return 7;
  if (bangla.includes(query)) return 8;
  if (partOfSpeech.startsWith(query)) return 9;

  return 99;
}

export function filterAndSortWords(words, query = {}) {
  let results = [...words];
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "all").toLowerCase();
  const sort = String(query.sort || "rank").toLowerCase();

  if (search) {
    results = results
      .map((item) => ({ item, score: getSearchScore(item, search) }))
      .filter((entry) => entry.score < 99)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.item.word.localeCompare(b.item.word);
      })
      .map((entry) => entry.item);
  }

  if (status !== "all") {
    results = results.filter((item) => item.status === normalizeStatusValue(status));
  }

  if (search) {
    if (sort === "alpha-desc") return results.sort((a, b) => b.word.localeCompare(a.word));
    if (sort === "alpha-asc" || sort === "alphabetical") return results.sort((a, b) => a.word.localeCompare(b.word));
    return results;
  }

  return results.sort((a, b) => {
    if (sort === "alpha-desc") return b.word.localeCompare(a.word);
    if (sort === "alpha-asc" || sort === "alphabetical") return a.word.localeCompare(b.word);
    return (a.frequencyRank || 0) - (b.frequencyRank || 0) || a.word.localeCompare(b.word);
  });
}
