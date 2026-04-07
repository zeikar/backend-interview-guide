const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSnippet,
  compactText,
  findCompactMatchRange,
  highlightText,
  normalizeText,
  scoreItem,
} = require("../assets/js/search-utils.js");

test("normalizeText lowercases and collapses whitespace", () => {
  assert.equal(normalizeText("  Load   Balancing  "), "load balancing");
});

test("compactText removes all whitespace after normalization", () => {
  assert.equal(compactText("Load   Balancing"), "loadbalancing");
});

test("findCompactMatchRange matches across spaces", () => {
  assert.deepEqual(findCompactMatchRange("로드 밸런싱", "로드밸런싱"), {
    start: 0,
    end: 6,
  });
});

test("highlightText highlights direct query matches safely", () => {
  assert.equal(
    highlightText("Redis <Cache>", "redis", "redis"),
    '<mark class="guide-search-highlight">Redis</mark> &lt;Cache&gt;',
  );
});

test("highlightText highlights compact matches across spaces", () => {
  assert.equal(
    highlightText("로드 밸런싱", "로드밸런싱", "로드밸런싱"),
    '<mark class="guide-search-highlight">로드 밸런싱</mark>',
  );
});

test("buildSnippet prefers description when available", () => {
  assert.equal(
    buildSnippet(
      {
        description: "설명 텍스트",
        content: "본문 텍스트",
      },
      "설명",
      "설명",
    ),
    "설명 텍스트",
  );
});

test("buildSnippet finds compact match in content", () => {
  const snippet = buildSnippet(
    {
      description: "",
      content: "트래픽은 로드 밸런싱 계층을 지나 분산됩니다.",
    },
    "로드밸런싱",
    "로드밸런싱",
  );

  assert.match(snippet, /로드 밸런싱/);
});

test("scoreItem ranks article matches above home matches", () => {
  const query = "캐싱";
  const compactQuery = "캐싱";

  const homeScore = scoreItem(
    {
      _title: "캐싱",
      _titleCompact: "캐싱",
      _description: "",
      _descriptionCompact: "",
      _content: "",
      _contentCompact: "",
      category: "홈",
      kind: "home",
    },
    query,
    compactQuery,
  );

  const articleScore = scoreItem(
    {
      _title: "캐싱",
      _titleCompact: "캐싱",
      _description: "",
      _descriptionCompact: "",
      _content: "",
      _contentCompact: "",
      category: "데이터베이스",
      kind: "article",
    },
    query,
    compactQuery,
  );

  assert.ok(articleScore > homeScore);
});
