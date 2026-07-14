export function normalizeStatusValue(value) {
  const status = String(value || "new")
    .toLowerCase()
    .replace("learned", "mastered")
    .replace("known", "mastered")
    .replace("review", "learning");

  return ["new", "learning", "mastered"].includes(status) ? status : "new";
}

export function filterAndSortWords(words, query = {}) {
  let results = [...words];
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "all").toLowerCase();
  const sort = String(query.sort || "rank").toLowerCase();

  if (search) {
    results = results.filter((item) => {
      const haystack = [
        item.word,
        item.meaning,
        item.partOfSpeech,
        ...(item.synonyms || []),
        ...(item.antonyms || [])
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }

  if (status !== "all") {
    results = results.filter((item) => normalizeStatusValue(item.status) === normalizeStatusValue(status));
  }

  return results.sort((a, b) => {
    if (sort === "alpha-desc") return b.word.localeCompare(a.word);
    if (sort === "alpha-asc" || sort === "alphabetical") return a.word.localeCompare(b.word);
    return (a.frequencyRank || 0) - (b.frequencyRank || 0) || a.word.localeCompare(b.word);
  });
}
