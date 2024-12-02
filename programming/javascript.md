# 자바스크립트(JavaScript)

## 목차

1. [자바스크립트란?](#자바스크립트란)
2. [자바스크립트의 주요 특징](#자바스크립트의-주요-특징)
3. [변수와 스코프](#변수와-스코프)
4. [함수와 클로저](#함수와-클로저)
5. [비동기 프로그래밍](#비동기-프로그래밍)
6. [ES6 이후의 주요 기능](#es6-이후의-주요-기능)
7. [자바스크립트의 활용 사례](#자바스크립트의-활용-사례)
8. [자바스크립트 사용 시 주의사항](#자바스크립트-사용-시-주의사항)

---

## 자바스크립트란?

**자바스크립트(JavaScript)** 는 웹 브라우저에서 동작하는 스크립팅 언어로, **클라이언트 측 동작**, **서버 측(Node.js)**, 그리고 **모바일 및 데스크톱 애플리케이션** 개발에서도 널리 사용됩니다.

- **인터프리터 언어**: 코드를 실행하기 전에 컴파일하지 않고, 실시간으로 실행.
- **멀티 패러다임**: 객체 지향, 함수형, 이벤트 기반 프로그래밍을 지원.
- **유연한 언어**: 정적 언어와 달리, 타입과 객체를 동적으로 변경 가능.

---

## 자바스크립트의 주요 특징

1. **동적 타입(Dynamic Typing)**:

   - 변수를 선언할 때 데이터 타입을 명시하지 않음.
   - 런타임에 데이터 타입이 결정됨.

2. **프로토타입 기반(Prototype-based)**:

   - 클래스가 아닌 프로토타입을 사용하여 객체를 상속.

3. **이벤트 루프(Event Loop)**:

   - 비동기 작업을 처리하기 위한 동시성 모델.

4. **광범위한 활용성**:
   - 프론트엔드(React, Vue.js), 백엔드(Node.js), 모바일(React Native) 등 다양한 분야에서 사용.

---

## 변수와 스코프

### 변수 선언

1. **`var`**:

   - 함수 스코프를 가지며, 재선언 가능.
   - 호이스팅(Hoisting)으로 인해 예측하지 못한 동작이 발생할 수 있음. ([호이스팅](https://developer.mozilla.org/ko/docs/Glossary/Hoisting): 변수 선언을 함수 상단으로 끌어올리는 동작)

2. **`let`**:

   - 블록 스코프를 가지며, 재선언 불가능.

3. **`const`**:
   - 상수를 선언할 때 사용.
   - 값이 변경되지 않지만, 객체의 속성은 변경 가능.

```javascript
let x = 10;
const y = 20;

x = 30; // 가능
y = 40; // 오류: y는 재할당할 수 없음
```

### 스코프

- **함수 스코프**: `var`로 선언된 변수는 함수 내에서만 접근 가능.
- **블록 스코프**: `let`과 `const`는 블록(`{}`) 내에서만 접근 가능.

---

## 함수와 클로저

### 함수 선언 및 표현식

1. **함수 선언식**:

- 특징: 함수 선언식은 함수가 정의되기 전에 호출할 수 있습니다. 이는 함수 호이스팅 덕분입니다.
- 예시:

```javascript
function greet(name) {
  return `Hello, ${name}`;
}
```

2. **함수 표현식**:

- 특징: 함수 표현식은 변수에 할당된 후에만 호출할 수 있습니다. 함수 호이스팅이 적용되지 않습니다.
- 예시:

```javascript
const greet = function (name) {
  return `Hello, ${name}`;
};
```

3. **화살표 함수**:

- 특징: 화살표 함수는 this 바인딩이 없으며, 간결한 문법을 제공합니다. 주로 콜백 함수나 간단한 함수 정의에 사용됩니다.
- 예시:

```javascript
const greet = (name) => `Hello, ${name}`;
```

### 클로저

- 함수와 그 함수가 선언된 렉시컬 환경을 함께 저장하는 구조.
- 내부 함수가 외부 함수의 변수를 참조할 수 있음.

```javascript
function makeCounter() {
  let count = 0;
  return function () {
    count++;
    return count;
  };
}

const counter = makeCounter();
console.log(counter()); // 1
console.log(counter()); // 2
```

---

## 비동기 프로그래밍

### 콜백 함수

- 비동기 작업을 처리하기 위해 다른 함수에 전달되는 함수.

```javascript
setTimeout(() => {
  console.log("1초 뒤 실행");
}, 1000);
```

### 프로미스(Promise)

- 비동기 작업의 성공(`resolve`) 또는 실패(`reject`)를 나타내는 객체.

```javascript
const fetchData = new Promise((resolve, reject) => {
  setTimeout(() => resolve("데이터 수신"), 1000);
});

fetchData.then((data) => console.log(data));
```

### async/await

- 비동기 코드를 동기적으로 작성할 수 있는 문법.

```javascript
async function fetchData() {
  const data = await new Promise((resolve) =>
    setTimeout(() => resolve("데이터 수신"), 1000)
  );
  console.log(data);
}

fetchData();
```

---

## ES6 이후의 주요 기능

1. **템플릿 리터럴**:
   - 문자열 내에서 표현식을 삽입 가능.

```javascript
const name = 'John';
console.log(Hello, ${name});
```

2. **디스트럭처링**:
   - 객체나 배열의 값을 간단히 분해하여 변수에 할당.

```javascript
const [a, b] = [10, 20];
const { x, y } = { x: 30, y: 40 };
```

3. **모듈 시스템**:
   - 코드의 재사용성을 높이기 위한 `import/export` 문법.

```javascript
// math.js
export const add = (a, b) => a + b;

// main.js
import { add } from "./math.js";

console.log(add(2, 3)); // 5
```

4. **클래스 문법**:
   - ES6에서 추가된 문법으로, 프로토타입 기반 객체지향을 보다 직관적으로 작성.

```javascript
class Person {
  constructor(name) {
    this.name = name;
  }

  greet() {
    console.log(`Hello, my name is ${this.name}`);
  }
}

const john = new Person("John");
john.greet();
```

---

## 자바스크립트의 활용 사례

1. **웹 프론트엔드**:
   - React, Vue.js, Angular 등 프레임워크를 사용하여 동적인 UI 개발.
2. **웹 백엔드**:
   - Node.js로 서버 애플리케이션 개발.
3. **모바일 애플리케이션**:
   - React Native를 통해 크로스플랫폼 앱 개발.
4. **데스크톱 애플리케이션**:
   - Electron을 사용하여 크로스플랫폼 데스크톱 앱 개발.

---

## 자바스크립트 사용 시 주의사항

1. **타입 혼란**:
   - 자바스크립트는 동적 타입 언어이므로, 타입 강제를 위한 TypeScript 사용을 고려.
2. **호이스팅**:
   - 변수 선언과 함수 선언이 코드 상단으로 끌어올려지는 현상에 주의.
3. **비동기 처리**:
   - 콜백 헬(Call Back Hell)을 피하기 위해 async/await 또는 Promise를 활용.
4. **전역 변수 남용**:
   - 전역 변수는 의도치 않은 충돌을 유발할 수 있으므로 최소화.

---

## 결론

자바스크립트는 웹 개발의 핵심 언어로, 클라이언트 및 서버 측 개발을 모두 지원합니다. ES6 이후의 새로운 문법과 프레임워크를 적극 활용하면, 생산성과 코드 품질을 높일 수 있습니다.
