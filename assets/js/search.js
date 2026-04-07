(function () {
  const MIN_QUERY_LENGTH = 1;
  const MAX_RESULTS = 10;
  const SEARCH_DATA_URL =
    window.GUIDE_SEARCH_DATA_URL || "/backend-interview-guide/search-data.json";

  let searchIndexPromise;
  let isComposing = false;
  let activeIndex = -1;

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

  function findCompactMatchRange(text, compactQuery) {
    if (!compactQuery) {
      return null;
    }

    const chars = Array.from(String(text || ""));
    const compactChars = [];
    const compactMap = [];

    chars.forEach((char, index) => {
      if (/\s/.test(char)) {
        return;
      }

      compactChars.push(char.toLowerCase());
      compactMap.push(index);
    });

    const compactTextValue = compactChars.join("");
    const compactIndex = compactTextValue.indexOf(compactQuery);
    if (compactIndex < 0) {
      return null;
    }

    const start = compactMap[compactIndex];
    const end = compactMap[compactIndex + compactQuery.length - 1] + 1;
    return { start, end };
  }

  function highlightText(text, query, compactQuery) {
    const rawText = String(text || "");
    if (!rawText || (!query && !compactQuery)) {
      return escapeHtml(rawText);
    }

    const loweredText = rawText.toLowerCase();
    const ranges = [];
    let searchFrom = 0;

    while (query && query.length > 0) {
      const matchIndex = loweredText.indexOf(query, searchFrom);
      if (matchIndex < 0) {
        break;
      }

      ranges.push({
        start: matchIndex,
        end: matchIndex + query.length,
      });
      searchFrom = matchIndex + Math.max(query.length, 1);
    }

    if (!ranges.length) {
      const compactRange = findCompactMatchRange(rawText, compactQuery);
      if (compactRange) {
        ranges.push(compactRange);
      }
    }

    if (!ranges.length) {
      return escapeHtml(rawText);
    }

    let cursor = 0;
    let result = "";
    ranges.forEach((range) => {
      if (range.start < cursor) {
        return;
      }

      result += escapeHtml(rawText.slice(cursor, range.start));
      result += `<mark class="guide-search-highlight">${escapeHtml(
        rawText.slice(range.start, range.end),
      )}</mark>`;
      cursor = range.end;
    });
    result += escapeHtml(rawText.slice(cursor));

    return result;
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
      score += 240;
    }
    if (
      item._title.startsWith(query) ||
      item._titleCompact.startsWith(compactQuery)
    ) {
      score += 140;
    }
    if (item._title.includes(query) || item._titleCompact.includes(compactQuery)) {
      score += 100;
    }
    if (normalizeText(item.category).includes(query)) {
      score += 20;
    }
    if (
      item._description.includes(query) ||
      item._descriptionCompact.includes(compactQuery)
    ) {
      score += 35;
    }
    if (item._content.includes(query) || item._contentCompact.includes(compactQuery)) {
      score += 15;
    }

    if (item.kind === "home") {
      score -= 35;
    } else if (item.kind === "section") {
      score -= 15;
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
      const compactRange = findCompactMatchRange(rawContent, compactQuery);
      if (compactRange) {
        index = compactRange.start;
      }
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

  function renderResults(container, items, query, compactQuery) {
    if (!items.length) {
      container.innerHTML =
        '<div class="guide-search-empty">검색 결과가 없습니다.</div>';
      activeIndex = -1;
      document.documentElement.classList.add("search-active");
      return;
    }

    container.innerHTML = `
      <div class="search-results-list">
        ${items
          .map(
            (item, index) => `
              <a
                class="search-result guide-search-result${index === activeIndex ? " active" : ""}"
                href="${escapeHtml(item.url)}"
                data-search-index="${index}"
              >
                <div class="guide-search-result__meta">
                  <span class="guide-search-result__category">${escapeHtml(item.category)}</span>
                  <span class="search-result-rel-url">${escapeHtml(item.url)}</span>
                </div>
                <strong class="search-result-title">${highlightText(
                  item.title,
                  query,
                  compactQuery,
                )}</strong>
                <span class="search-result-preview">${highlightText(
                  item.snippet,
                  query,
                  compactQuery,
                )}</span>
              </a>
            `,
          )
          .join("")}
      </div>
    `;
    document.documentElement.classList.add("search-active");
  }

  function hideResults(container) {
    container.innerHTML = "";
    activeIndex = -1;
    document.documentElement.classList.remove("search-active");
  }

  function getResultLinks(container) {
    return Array.from(container.querySelectorAll("a.search-result"));
  }

  function setActiveResult(container, index) {
    const links = getResultLinks(container);
    if (!links.length) {
      activeIndex = -1;
      return;
    }

    activeIndex = Math.max(0, Math.min(index, links.length - 1));
    links.forEach((link, linkIndex) => {
      link.classList.toggle("active", linkIndex === activeIndex);
    });

    const activeLink = links[activeIndex];
    if (activeLink) {
      activeLink.scrollIntoView({ block: "nearest" });
    }
  }

  async function runSearch(input, results) {
    const query = normalizeText(input.value);
    const compactQuery = compactText(input.value);

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

    activeIndex = matches.length ? 0 : -1;
    renderResults(results, matches, query, compactQuery);
  }

  function initSearch() {
    const input = document.getElementById("search-input");
    const results = document.getElementById("search-results");

    if (!input || !results) {
      return;
    }

    input.addEventListener("compositionstart", () => {
      isComposing = true;
    });

    input.addEventListener("compositionend", () => {
      isComposing = false;
    });

    input.addEventListener("input", async () => {
      await runSearch(input, results);
    });

    input.addEventListener("focus", async () => {
      try {
        await fetchSearchIndex();
        if (normalizeText(input.value).length >= MIN_QUERY_LENGTH) {
          document.documentElement.classList.add("search-active");
        }
      } catch (error) {
        console.error(error);
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hideResults(results);
        input.blur();
        return;
      }

      if (isComposing || event.isComposing) {
        return;
      }

      if (event.key === "ArrowDown") {
        const links = getResultLinks(results);
        if (links.length) {
          event.preventDefault();
          setActiveResult(results, activeIndex < 0 ? 0 : activeIndex + 1);
        }
        return;
      }

      if (event.key === "ArrowUp") {
        const links = getResultLinks(results);
        if (links.length) {
          event.preventDefault();
          setActiveResult(
            results,
            activeIndex < 0 ? links.length - 1 : activeIndex - 1,
          );
        }
        return;
      }

      if (event.key === "Enter") {
        const links = getResultLinks(results);
        const targetResult =
          activeIndex >= 0 ? links[activeIndex] : links[0];
        if (targetResult) {
          event.preventDefault();
          targetResult.click();
        }
      }
    });

    results.addEventListener("mousemove", (event) => {
      const hoveredResult = event.target.closest("a.search-result");
      if (!hoveredResult) {
        return;
      }

      const hoveredIndex = Number(hoveredResult.dataset.searchIndex);
      if (!Number.isNaN(hoveredIndex)) {
        setActiveResult(results, hoveredIndex);
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".search")) {
        hideResults(results);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initSearch);
})();
