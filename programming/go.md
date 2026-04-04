# Go

## 목차

- [Go란](#go란)
- [Go의 핵심 특징](#go의-핵심-특징)
- [동시성과 병렬성](#동시성과-병렬성)
- [Goroutine과 Channel](#goroutine과-channel)
- [Go가 백엔드에서 많이 쓰이는 이유](#go가-백엔드에서-많이-쓰이는-이유)
- [Go 사용 시 주의할 점](#go-사용-시-주의할-점)
- [코드 예시](#코드-예시)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## Go란

**Go** 는 Google이 만든 정적 타입 컴파일 언어로, 단순한 문법과 빠른 빌드, 내장된 동시성 모델 덕분에 서버와 인프라 소프트웨어에서 널리 사용됩니다.[^go-home]

Go를 설명할 때 중요한 점은 다음입니다.

- **간결한 문법**
- **빠른 컴파일**
- **동시성 친화적인 모델**
- **배포가 쉬운 단일 바이너리**

---

## Go의 핵심 특징

- **정적 타입 언어:** 컴파일 시점에 많은 오류를 잡을 수 있습니다.
- **단순한 문법:** 문법 요소가 상대적으로 적어서 팀 단위 일관성이 좋습니다.
- **빠른 빌드와 배포:** 빌드 속도가 빠르고 단일 바이너리 배포가 쉬운 편입니다.
- **강한 표준 라이브러리:** HTTP 서버, JSON 처리, 동시성 도구 등이 기본 제공됩니다.[^go-doc]
- **가비지 컬렉션:** 메모리 관리를 수동으로 하지 않아도 됩니다.

Go의 매력은 "아주 많은 기능"보다 **제약을 둠으로써 일관성과 생산성을 얻는 언어**라는 점에 있습니다.

---

## 동시성과 병렬성

- **동시성(Concurrency):** 여러 작업을 함께 진행되도록 구성하는 모델
- **병렬성(Parallelism):** 여러 작업이 실제로 동시에 실행되는 것

Go는 concurrency를 언어 차원에서 다루기 쉽게 만든 것이 강점입니다.  
병렬 실행은 CPU 코어와 런타임 스케줄러가 뒷받침할 때 함께 따라옵니다.

면접에서는 "Go는 병렬 언어"보다,  
**goroutine과 channel을 통해 동시성을 다루기 쉽게 만든 언어**라고 말하는 편이 정확합니다.

---

## Goroutine과 Channel

### Goroutine

`go` 문은 함수를 독립적인 goroutine으로 실행합니다.[^go-spec]

goroutine은 운영체제 스레드를 직접 다루는 것보다 가볍게 시작할 수 있으며, Go 런타임이 스케줄링을 담당합니다.

### Channel

channel은 goroutine 사이에서 값을 주고받는 통신 수단입니다. Go 스펙은 `select`와 channel 송수신 규칙을 언어 수준으로 정의합니다.[^go-spec]

이 조합의 장점은 다음과 같습니다.

- 공유 메모리 대신 메시지 전달 모델을 만들기 쉽다
- 작업 파이프라인과 fan-out/fan-in 패턴을 표현하기 좋다
- `select`를 통해 여러 channel 이벤트를 조정할 수 있다

다만 만능은 아닙니다.

- 모든 동시성 문제를 channel만으로 해결하려고 하면 코드가 더 복잡해질 수 있습니다.
- mutex와 channel은 경쟁 관계가 아니라, 문제 유형에 따라 선택하는 도구입니다.

---

## Go가 백엔드에서 많이 쓰이는 이유

- **네트워크 서버 작성이 편하다**
- **동시 요청 처리 모델이 자연스럽다**
- **컴파일과 배포가 빠르다**
- **클라우드/인프라 생태계와 궁합이 좋다**

Docker, Kubernetes 같은 도구가 Go로 작성된 것도 이런 배경과 맞닿아 있습니다.

---

## Go 사용 시 주의할 점

- **에러 처리가 장황해질 수 있음:** 예외 대신 명시적 에러 반환을 사용합니다.
- **goroutine 누수:** 종료 조건이 없으면 goroutine이 계속 남을 수 있습니다.
- **deadlock 가능성:** channel 설계가 잘못되면 쉽게 막힐 수 있습니다.
- **race condition:** 공유 데이터 접근 시 `sync.Mutex`나 다른 동기화 수단이 필요합니다.
- **추상화 과용의 어려움:** 언어가 단순한 대신 복잡한 추상화 패턴은 덜 화려하게 풀어야 합니다.

---

## 코드 예시

아래 예시는 goroutine과 channel을 이용해 작업 결과를 비동기적으로 받는 기본 패턴입니다.

```go
package main

import "fmt"

func worker(ch chan<- string) {
	ch <- "done"
}

func main() {
	ch := make(chan string)

	go worker(ch)

	result := <-ch
	fmt.Println(result)
}
```

이 예시에서 중요한 포인트는 다음입니다.

- `go worker(ch)`가 새 goroutine을 시작합니다.
- `chan<- string`은 send-only channel 타입입니다.
- `<-ch`는 값을 받을 때까지 대기합니다.

---

## 면접 포인트

- **Go의 핵심은 단순한 문법, 빠른 빌드, 동시성 친화적인 모델입니다.**
- **goroutine은 스레드와 완전히 같은 개념이 아니라 런타임이 관리하는 동시성 단위로 설명하는 편이 좋습니다.**
- **channel은 통신 도구이지 모든 공유 상태 문제의 만능 해법은 아닙니다.**
- **Go가 백엔드에서 많이 쓰이는 이유로 네트워크 서버, 인프라 도구, 배포 편의성을 같이 말하면 좋습니다.**
- **답변에서는 deadlock, race condition, goroutine leak 같은 실무 리스크도 함께 언급하는 편이 좋습니다.**

---

## 참고 자료

[^go-home]: The Go Programming Language - https://go.dev/
[^go-doc]: Go Documentation - https://go.dev/doc
[^go-spec]: The Go Programming Language Specification - https://go.dev/ref/spec
