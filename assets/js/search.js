(function () {
  const MIN_QUERY_LENGTH = 2;
  const MAX_RESULTS = 8;
  const SEARCH_DATA_URL =
    window.GUIDE_SEARCH_DATA_URL || "/backend-interview-guide/search-data.json";

  let searchIndexPromise;

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactText(value) {
    return normalizeText(value).replace(/\s+/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fetchSearchIndex() {
    if (!searchIndexPromise) {
      searchIndexPromise = fetch(SEARCH_DATA_URL)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to load search data");
          }
          return response.json();
        })
        .then((items) =>
          items.map((item) => ({
            ...item,
            _title: normalizeText(item.title),
            _description: normalizeText(item.description),
            _content: normalizeText(item.content),
            _titleCompact: compactText(item.title),
            _descriptionCompact: compactText(item.description),
            _contentCompact: compactText(item.content),
          })),
        );
    }

    return searchIndexPromise;
  }

  function scoreItem(item, query, compactQuery) {
    let score = 0;

    if (item._title === query || item._titleCompact === compactQuery) {
      score += 120;
    }
    if (item._title.includes(query) || item._titleCompact.includes(compactQuery)) {
      score += 80;
    }
    if (
      item._description.includes(query) ||
      item._descriptionCompact.includes(compactQuery)
    ) {
      score += 30;
    }
    if (item._content.includes(query) || item._contentCompact.includes(compactQuery)) {
      score += 10;
    }

    return score;
  }

  function buildSnippet(item, query, compactQuery) {
    if (item.description) {
      return item.description;
    }

    const rawContent = String(item.content || "").replace(/\s+/g, " ").trim();
    if (!rawContent) {
      return "";
    }

    const lowerContent = normalizeText(rawContent);
    let index = lowerContent.indexOf(query);

    if (index < 0 && compactQuery) {
      index = compactText(rawContent).indexOf(compactQuery);
    }

    if (index < 0) {
      return rawContent.slice(0, 120);
    }

    const start = Math.max(0, index - 30);
    const end = Math.min(rawContent.length, index + 70);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < rawContent.length ? "..." : "";
    return prefix + rawContent.slice(start, end).trim() + suffix;
  }

  function renderResults(container, items) {
    if (!items.length) {
      container.innerHTML =
        '<div class="guide-search-empty">검색 결과가 없습니다.</div>';
      container.hidden = false;
      return;
    }

    container.innerHTML = items
      .map(
        (item) => `
          <a class="guide-search-result" href="${escapeHtml(item.url)}">
            <span class="guide-search-result__category">${escapeHtml(item.category)}</span>
            <strong class="guide-search-result__title">${escapeHtml(item.title)}</strong>
            <span class="guide-search-result__snippet">${escapeHtml(item.snippet)}</span>
          </a>
        `,
      )
      .join("");
    container.hidden = false;
  }

  function hideResults(container) {
    container.hidden = true;
    container.innerHTML = "";
  }

  function initSearch() {
    const input = document.getElementById("guide-search-input");
    const results = document.getElementById("guide-search-results");

    if (!input || !results) {
      return;
    }

    input.addEventListener("input", async (event) => {
      const query = normalizeText(event.target.value);
      const compactQuery = compactText(event.target.value);

      if (query.length < MIN_QUERY_LENGTH) {
        hideResults(results);
        return;
      }

      const index = await fetchSearchIndex();
      const matches = index
        .map((item) => ({
          ...item,
          score: scoreItem(item, query, compactQuery),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.title.length - b.title.length)
        .slice(0, MAX_RESULTS)
        .map((item) => ({
          ...item,
          snippet: buildSnippet(item, query, compactQuery),
        }));

      renderResults(results, matches);
    });

    input.addEventListener("focus", async () => {
      try {
        await fetchSearchIndex();
      } catch (error) {
        console.error(error);
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideResults(results);
        input.blur();
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".guide-search-shell")) {
        hideResults(results);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initSearch);
})();
