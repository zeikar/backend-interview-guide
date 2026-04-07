(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.GuideHangulKeyboardUtils = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CHOSEONG = [
    "ㄱ",
    "ㄲ",
    "ㄴ",
    "ㄷ",
    "ㄸ",
    "ㄹ",
    "ㅁ",
    "ㅂ",
    "ㅃ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅉ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
  ];
  const JUNGSEONG = [
    "ㅏ",
    "ㅐ",
    "ㅑ",
    "ㅒ",
    "ㅓ",
    "ㅔ",
    "ㅕ",
    "ㅖ",
    "ㅗ",
    "ㅘ",
    "ㅙ",
    "ㅚ",
    "ㅛ",
    "ㅜ",
    "ㅝ",
    "ㅞ",
    "ㅟ",
    "ㅠ",
    "ㅡ",
    "ㅢ",
    "ㅣ",
  ];
  const JONGSEONG = [
    "",
    "ㄱ",
    "ㄲ",
    "ㄳ",
    "ㄴ",
    "ㄵ",
    "ㄶ",
    "ㄷ",
    "ㄹ",
    "ㄺ",
    "ㄻ",
    "ㄼ",
    "ㄽ",
    "ㄾ",
    "ㄿ",
    "ㅀ",
    "ㅁ",
    "ㅂ",
    "ㅄ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
  ];
  const CHOSEONG_SET = new Set(CHOSEONG);
  const JUNGSEONG_SET = new Set(JUNGSEONG);
  const JONGSEONG_SET = new Set(JONGSEONG.slice(1));
  const KEY_TO_JAMO = {
    r: "ㄱ",
    R: "ㄲ",
    s: "ㄴ",
    e: "ㄷ",
    E: "ㄸ",
    f: "ㄹ",
    a: "ㅁ",
    q: "ㅂ",
    Q: "ㅃ",
    t: "ㅅ",
    T: "ㅆ",
    d: "ㅇ",
    w: "ㅈ",
    W: "ㅉ",
    c: "ㅊ",
    z: "ㅋ",
    x: "ㅌ",
    v: "ㅍ",
    g: "ㅎ",
    k: "ㅏ",
    o: "ㅐ",
    i: "ㅑ",
    O: "ㅒ",
    j: "ㅓ",
    p: "ㅔ",
    u: "ㅕ",
    P: "ㅖ",
    h: "ㅗ",
    y: "ㅛ",
    n: "ㅜ",
    b: "ㅠ",
    m: "ㅡ",
    l: "ㅣ",
  };
  const JAMO_TO_KEY = {
    ㄱ: "r",
    ㄲ: "R",
    ㄳ: "rt",
    ㄴ: "s",
    ㄵ: "sw",
    ㄶ: "sg",
    ㄷ: "e",
    ㄸ: "E",
    ㄹ: "f",
    ㄺ: "fr",
    ㄻ: "fa",
    ㄼ: "fq",
    ㄽ: "ft",
    ㄾ: "fx",
    ㄿ: "fv",
    ㅀ: "fg",
    ㅁ: "a",
    ㅂ: "q",
    ㅃ: "Q",
    ㅄ: "qt",
    ㅅ: "t",
    ㅆ: "T",
    ㅇ: "d",
    ㅈ: "w",
    ㅉ: "W",
    ㅊ: "c",
    ㅋ: "z",
    ㅌ: "x",
    ㅍ: "v",
    ㅎ: "g",
    ㅏ: "k",
    ㅐ: "o",
    ㅑ: "i",
    ㅒ: "O",
    ㅓ: "j",
    ㅔ: "p",
    ㅕ: "u",
    ㅖ: "P",
    ㅗ: "h",
    ㅘ: "hk",
    ㅙ: "ho",
    ㅚ: "hl",
    ㅛ: "y",
    ㅜ: "n",
    ㅝ: "nj",
    ㅞ: "np",
    ㅟ: "nl",
    ㅠ: "b",
    ㅡ: "m",
    ㅢ: "ml",
    ㅣ: "l",
  };
  const COMPOUND_VOWELS = {
    "ㅗㅏ": "ㅘ",
    "ㅗㅐ": "ㅙ",
    "ㅗㅣ": "ㅚ",
    "ㅜㅓ": "ㅝ",
    "ㅜㅔ": "ㅞ",
    "ㅜㅣ": "ㅟ",
    "ㅡㅣ": "ㅢ",
  };
  const COMPOUND_FINALS = {
    "ㄱㅅ": "ㄳ",
    "ㄴㅈ": "ㄵ",
    "ㄴㅎ": "ㄶ",
    "ㄹㄱ": "ㄺ",
    "ㄹㅁ": "ㄻ",
    "ㄹㅂ": "ㄼ",
    "ㄹㅅ": "ㄽ",
    "ㄹㅌ": "ㄾ",
    "ㄹㅍ": "ㄿ",
    "ㄹㅎ": "ㅀ",
    "ㅂㅅ": "ㅄ",
  };

  function isHangulSyllable(char) {
    const codePoint = String(char || "").charCodeAt(0);
    return codePoint >= 0xac00 && codePoint <= 0xd7a3;
  }

  function isJamoVowel(char) {
    return JUNGSEONG_SET.has(char);
  }

  function isRecognizedJamo(char) {
    return CHOSEONG_SET.has(char) || JONGSEONG_SET.has(char) || isJamoVowel(char);
  }

  function parseMedial(chars, index) {
    const first = chars[index];
    if (!isJamoVowel(first)) {
      return null;
    }

    const combined = COMPOUND_VOWELS[first + (chars[index + 1] || "")];
    if (combined) {
      return {
        value: combined,
        length: 2,
      };
    }

    return {
      value: first,
      length: 1,
    };
  }

  function parseFinal(chars, index) {
    const first = chars[index];
    if (!JONGSEONG_SET.has(first)) {
      return null;
    }

    const combined = COMPOUND_FINALS[first + (chars[index + 1] || "")];
    if (combined && !isJamoVowel(chars[index + 2])) {
      return {
        value: combined,
        length: 2,
      };
    }

    if (isJamoVowel(chars[index + 1])) {
      return null;
    }

    return {
      value: first,
      length: 1,
    };
  }

  function composeSyllable(initial, medial, final) {
    const initialIndex = CHOSEONG.indexOf(initial);
    const medialIndex = JUNGSEONG.indexOf(medial);
    const finalIndex = JONGSEONG.indexOf(final || "");

    if (initialIndex < 0 || medialIndex < 0 || finalIndex < 0) {
      return initial + medial + (final || "");
    }

    const syllableCode =
      0xac00 + initialIndex * 21 * 28 + medialIndex * 28 + finalIndex;

    return String.fromCharCode(syllableCode);
  }

  function composeHangul(text) {
    const chars = Array.from(String(text || ""));
    let result = "";
    let index = 0;

    while (index < chars.length) {
      const current = chars[index];

      if (!isRecognizedJamo(current)) {
        result += current;
        index += 1;
        continue;
      }

      if (CHOSEONG_SET.has(current)) {
        const medial = parseMedial(chars, index + 1);
        if (medial) {
          let consumed = 1 + medial.length;
          let final = "";
          const parsedFinal = parseFinal(chars, index + consumed);

          if (parsedFinal) {
            final = parsedFinal.value;
            consumed += parsedFinal.length;
          }

          result += composeSyllable(current, medial.value, final);
          index += consumed;
          continue;
        }
      }

      const standaloneMedial = parseMedial(chars, index);
      if (standaloneMedial) {
        result += standaloneMedial.value;
        index += standaloneMedial.length;
        continue;
      }

      result += current;
      index += 1;
    }

    return result;
  }

  function convertEnglishTypedKorean(raw) {
    const jamoText = Array.from(String(raw || ""))
      .map((char) => KEY_TO_JAMO[char] || char)
      .join("");

    return composeHangul(jamoText);
  }

  function decomposeHangulSyllable(char) {
    if (!isHangulSyllable(char)) {
      return null;
    }

    const syllableIndex = char.charCodeAt(0) - 0xac00;
    const initialIndex = Math.floor(syllableIndex / 588);
    const medialIndex = Math.floor((syllableIndex % 588) / 28);
    const finalIndex = syllableIndex % 28;

    return {
      initial: CHOSEONG[initialIndex],
      medial: JUNGSEONG[medialIndex],
      final: JONGSEONG[finalIndex],
    };
  }

  function convertKoreanTypedEnglish(raw) {
    return Array.from(String(raw || ""))
      .map((char) => {
        const syllable = decomposeHangulSyllable(char);
        if (syllable) {
          return (
            (JAMO_TO_KEY[syllable.initial] || syllable.initial) +
            (JAMO_TO_KEY[syllable.medial] || syllable.medial) +
            (syllable.final ? JAMO_TO_KEY[syllable.final] || syllable.final : "")
          );
        }

        return JAMO_TO_KEY[char] || char;
      })
      .join("");
  }

  return {
    convertEnglishTypedKorean,
    convertKoreanTypedEnglish,
  };
});
