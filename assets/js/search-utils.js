(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.GuideSearchUtils = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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
    const description = String(item.description || "").trim();
    const normalizedDescription = normalizeText(description);
    const compactDescription = compactText(description);

    if (
      description &&
      (
        (query && normalizedDescription.includes(query)) ||
        (compactQuery && compactDescription.includes(compactQuery))
      )
    ) {
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
      if (description) {
        return description;
      }
      return rawContent.slice(0, 120);
    }

    const start = Math.max(0, index - 30);
    const end = Math.min(rawContent.length, index + 70);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < rawContent.length ? "..." : "";
    return prefix + rawContent.slice(start, end).trim() + suffix;
  }

  return {
    buildSnippet,
    compactText,
    escapeHtml,
    findCompactMatchRange,
    highlightText,
    normalizeText,
    scoreItem,
  };
});
