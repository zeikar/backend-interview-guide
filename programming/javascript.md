---
title: JavaScript
parent: 프로그래밍
nav_order: 1
---

# JavaScript

## 목차

- [JavaScript란](#javascript란)
- [JavaScript의 핵심 특징](#javascript의-핵심-특징)
- [스코프와 클로저](#스코프와-클로저)
- [비동기 모델과 이벤트 루프](#비동기-모델과-이벤트-루프)
- [Promise와 async/await](#promise와-asyncawait)
- [백엔드 개발 관점에서 중요한 포인트](#백엔드-개발-관점에서-중요한-포인트)
- [코드 예시](#코드-예시)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## JavaScript란

**JavaScript** 는 웹 브라우저와 서버 환경(Node.js)에서 널리 사용되는 범용 프로그래밍 언어입니다. 문법은 비교적 가볍지만, 프로토타입 기반 객체 모델, 클로저, 이벤트 루프, 비동기 프로그래밍 모델까지 함께 이해해야 실제로 제대로 다룰 수 있습니다.[^mdn-guide][^ecma262]

백엔드 면접에서는 "프론트엔드 언어"라고만 설명하기보다, **이벤트 루프 기반의 비동기 처리 모델을 가진 언어**로 설명하는 편이 좋습니다.

---

## JavaScript의 핵심 특징

- **동적 타입:** 변수 선언 시 타입을 고정하지 않으며, 런타임에 값의 형태가 결정됩니다.
- **함수 일급 객체:** 함수를 값처럼 전달하고 반환할 수 있습니다.
- **프로토타입 기반 객체 모델:** 클래스 문법이 있어도 내부적으로는 프로토타입 체계를 사용합니다.[^ecma262]
- **단일 스레드 실행 모델:** 하나의 실행 흐름 위에서 이벤트 루프와 비동기 API를 조합해 동시성을 다룹니다.[^mdn-event-loop]
- **광범위한 실행 환경:** 브라우저, Node.js, 서버리스 런타임 등 다양한 환경에서 사용됩니다.

JavaScript의 장점은 생산성과 생태계이지만, 그만큼 **암묵적 형변환, 실행 순서, 비동기 흐름**을 정확히 이해하는 것이 중요합니다.

---

## 스코프와 클로저

JavaScript는 **렉시컬 스코프(Lexical Scope)** 를 사용합니다. 즉, 함수가 어디서 호출되었는지가 아니라 **어디서 선언되었는지**에 따라 접근 가능한 변수가 결정됩니다.

- **`var`:** 함수 스코프
- **`let`, `const`:** 블록 스코프
- **클로저:** 함수가 선언될 당시의 렉시컬 환경을 함께 유지하는 특성[^mdn-closures]

클로저는 단순 면접 정의보다, "상태를 캡슐화하는 데 쓰이는 함수"로 연결해서 설명하면 좋습니다.

```javascript
function createCounter() {
  let count = 0;

  return function () {
    count += 1;
    return count;
  };
}

const next = createCounter();
console.log(next()); // 1
console.log(next()); // 2
```

위 예시에서 내부 함수는 외부 함수의 `count`를 계속 참조합니다. 이것이 클로저의 대표 예시입니다.

---

## 비동기 모델과 이벤트 루프

JavaScript는 보통 단일 스레드로 코드를 실행하지만, I/O나 타이머 같은 비동기 작업은 런타임이 처리한 뒤 콜백이나 태스크를 다시 실행 큐로 넘깁니다.[^mdn-event-loop]

이때 중요한 개념은 다음과 같습니다.

- **Call Stack:** 현재 실행 중인 함수 스택
- **Task Queue / Callback Queue:** 타이머, I/O 완료 후 실행될 작업 대기열
- **Microtask Queue:** Promise 후속 처리처럼 더 우선순위가 높은 작업 대기열
- **Event Loop:** 스택이 비면 큐의 작업을 실행 흐름으로 넣는 메커니즘

면접에서는 "JavaScript는 싱글 스레드인데 어떻게 비동기를 처리하나요?" 같은 질문이 자주 나옵니다. 이때 **런타임 + 큐 + 이벤트 루프** 구조로 답하면 됩니다.

---

## Promise와 async/await

콜백만으로 비동기 흐름을 관리하면 중첩이 깊어지고 에러 처리도 불편해지기 쉽습니다. Promise는 비동기 작업의 완료 상태를 표현하고, `async/await`는 이를 동기 코드처럼 읽기 쉽게 만들어 줍니다.[^mdn-promise][^mdn-async]

- **Promise:** 성공(`fulfilled`), 실패(`rejected`), 대기(`pending`) 상태를 가집니다.
- **`then` / `catch`:** 후속 처리와 에러 처리를 연결합니다.
- **`async/await`:** Promise 기반 비동기 코드를 더 읽기 쉽게 표현합니다.

중요한 점은 `await`가 "블로킹"이 아니라, **현재 async 함수의 실행을 일시 중단하고 Promise가 끝난 뒤 이어서 실행하는 문법**이라는 것입니다.

---

## 백엔드 개발 관점에서 중요한 포인트

- **I/O 중심 작업에 유리:** 파일, 네트워크, API 호출처럼 I/O 비중이 큰 서버 작업에 잘 맞습니다.
- **CPU 바운드 작업은 주의:** 무거운 계산은 이벤트 루프를 오래 점유해 전체 응답성을 떨어뜨릴 수 있습니다.
- **에러 흐름 관리:** 비동기 호출 체인이 길어질수록 에러 전파 전략이 중요합니다.
- **타입 안정성 보완:** 규모가 커질수록 TypeScript 같은 보완 수단을 함께 쓰는 경우가 많습니다.
- **실행 순서 이해:** Promise, `setTimeout`, `process.nextTick` 같은 동작 차이를 이해해야 운영 중 디버깅이 수월합니다.

즉, 백엔드에서 JavaScript를 설명할 때는 문법보다 **이벤트 루프, 비동기 I/O, CPU 작업 한계**를 같이 묶어 말하는 편이 좋습니다.

---

## 코드 예시

```javascript
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function processJob(name) {
  console.log(`start: ${name}`);
  await delay(100);
  console.log(`done: ${name}`);
}

async function main() {
  await Promise.all([processJob("email"), processJob("billing")]);
  console.log("all jobs completed");
}

main().catch((error) => {
  console.error("job failed", error);
});
```

이 코드는 Promise와 `async/await`를 사용해 비동기 작업을 병렬로 처리하는 기본 예시입니다.

---

## 면접 포인트

- **JavaScript는 동적 타입, 함수 일급 객체, 프로토타입 기반 객체 모델을 가진 언어입니다.**
- **백엔드 관점에서는 이벤트 루프와 비동기 I/O 모델을 이해하고 설명하는 것이 중요합니다.**
- **클로저는 함수가 선언될 당시의 렉시컬 환경을 유지하는 특성으로 설명하면 됩니다.**
- **Promise와 `async/await`는 비동기 흐름을 구조화하는 도구이며, CPU 작업을 빠르게 만들어 주는 기능은 아닙니다.**
- **Node.js 서버에서는 긴 CPU 작업이 이벤트 루프를 막을 수 있다는 점까지 같이 말하면 답변이 좋아집니다.**

---

## 참고 자료

[^mdn-guide]: MDN Web Docs, "JavaScript Guide" - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide
[^mdn-closures]: MDN Web Docs, "Closures" - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures
[^mdn-event-loop]: MDN Web Docs, "JavaScript execution model" - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop
[^mdn-promise]: MDN Web Docs, "Promise" - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
[^mdn-async]: MDN Web Docs, "async function" - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
[^ecma262]: TC39, "ECMAScript Language Specification" - https://tc39.es/ecma262/
