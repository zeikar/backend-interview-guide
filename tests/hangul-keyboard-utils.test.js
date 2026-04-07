const test = require("node:test");
const assert = require("node:assert/strict");

const {
  convertEnglishTypedKorean,
  convertKoreanTypedEnglish,
} = require("../assets/js/hangul-keyboard-utils.js");

test("convertEnglishTypedKorean converts simple English keyboard input to Hangul", () => {
  assert.equal(convertEnglishTypedKorean("qovh"), "배포");
});

test("convertEnglishTypedKorean handles compound vowels", () => {
  assert.equal(convertEnglishTypedKorean("ghks"), "환");
});

test("convertEnglishTypedKorean handles compound final consonants", () => {
  assert.equal(convertEnglishTypedKorean("tkfa"), "삶");
});

test("convertEnglishTypedKorean resyllabifies when a final consonant is followed by a vowel", () => {
  assert.equal(convertEnglishTypedKorean("rksk"), "가나");
});

test("convertKoreanTypedEnglish converts Hangul keyboard input to English", () => {
  assert.equal(convertKoreanTypedEnglish("ㅗ디ㅣㅐ"), "hello");
});

test("convertKoreanTypedEnglish handles compound vowel syllables", () => {
  assert.equal(convertKoreanTypedEnglish("환"), "ghks");
});

test("convertKoreanTypedEnglish handles compound final consonant syllables", () => {
  assert.equal(convertKoreanTypedEnglish("삶"), "tkfa");
});
