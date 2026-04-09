---
title: 복원력 패턴 (Timeout, Retry, Circuit Breaker)
description: 부분 실패를 전제로 timeout, retry, backoff, circuit breaker를 어떻게 설계할지 다룹니다.
parent: 시스템 디자인
nav_order: 17
---

# 복원력 패턴 (Timeout, Retry, Circuit Breaker)

## 목차

- [왜 이 주제를 묻는가](#왜-이-주제를-묻는가)
- [부분 실패를 전제로 본다](#부분-실패를-전제로-본다)
- [Timeout Budget을 먼저 정한다](#timeout-budget을-먼저-정한다)
- [재시도해도 되는 실패와 아닌 실패](#재시도해도-되는-실패와-아닌-실패)
- [Retry는 어디서 할까](#retry는-어디서-할까)
- [Backoff와 Jitter](#backoff와-jitter)
- [Circuit Breaker란](#circuit-breaker란)
- [Fallback과 Fast Fail](#fallback과-fast-fail)
- [Retry Storm와 Cascading Failure](#retry-storm와-cascading-failure)
- [자주 하는 실수](#자주-하는-실수)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 왜 이 주제를 묻는가

백엔드 면접에서 timeout, retry, circuit breaker는  
"라이브러리 옵션을 써봤는가"보다 **부분 실패를 어디서 끊고 어떻게 전파할지**를 보는 질문입니다.

보통 다음 질문으로 이어집니다.

- 상대 서비스가 느린지 죽었는지 어떻게 판단할 것인가
- 같은 요청을 다시 보내도 되는가
- 여러 계층이 동시에 재시도하면 어떻게 되는가
- 장애 난 하위 시스템 때문에 전체 서비스가 같이 무너지는 것을 어떻게 막을 것인가

이 문서는 **시스템 설계 관점에서 복원력 정책의 위치와 트레이드오프**를 설명합니다.  
애플리케이션 코드에서 예외를 어떻게 감싸고 전파할지는 [에러 처리와 디버깅 (Error Handling and Debugging)](../programming/error-handling-and-debugging.md),  
중복 요청을 어떻게 안전하게 흡수할지는 [멱등성과 재시도 (Idempotency and Retry)](idempotency-and-retry.md) 문서를 함께 보면 더 직접적입니다.

---

## 부분 실패를 전제로 본다

분산 시스템에서는 일부만 실패하는 일이 흔합니다.

- 요청은 보냈지만 응답이 늦을 수 있음
- 서버는 살아 있지만 DB만 느릴 수 있음
- 네트워크가 끊긴 것이 아니라 일시적으로 혼잡할 수 있음
- 하위 서비스는 살아 있지만 rate limit에 걸릴 수 있음

즉, "성공"과 "완전 실패" 사이에  
**느림, 일시 장애, 중복 가능성, 부분 성공**이 존재합니다.

좋은 답변은 "에러면 다시 시도합니다"보다  
**느림을 실패로 볼 기준, 재시도 가능성, 전파 차단 장치**를 같이 설명하는 답변입니다.

---

## Timeout Budget을 먼저 정한다

복원력 패턴에서 가장 먼저 정해야 하는 것은 retry 횟수가 아니라  
**얼마나 오래 기다릴 것인가**입니다.

timeout을 정하지 않으면 다음 문제가 생깁니다.

- 느린 하위 시스템이 워커와 연결을 계속 붙잡음
- 상위 요청의 전체 응답 시간이 끝없이 늘어남
- 재시도 시작 시점도 늦어짐

실무에서는 보통 다음 timeout을 구분합니다.

- **Connect Timeout:** 연결 자체를 얼마나 기다릴지
- **Read Timeout:** 응답 바이트를 얼마나 기다릴지
- **Write Timeout:** 요청을 얼마나 오래 밀어 넣을지
- **Request Deadline:** 전체 작업이 끝나야 하는 상한

좋은 답변은 하위 timeout을 독립적으로 늘어놓기보다  
**상위 요청 deadline 안에서 하위 호출 budget을 나눈다**는 식이 좋습니다.

예를 들어 500ms 안에 응답해야 하는 API라면:

- 외부 결제 호출에 300ms
- 내부 캐시 fallback에 50ms
- 남은 시간은 응답 조립과 로깅에 사용

즉, timeout은 숫자 하나가 아니라 **전체 요청 예산을 나누는 방식**입니다.

---

## 재시도해도 되는 실패와 아닌 실패

재시도는 모든 실패에 쓰는 기능이 아닙니다.

| **구분** | **예시** | **기본 대응** |
| --- | --- | --- |
| Retryable | 네트워크 timeout, connection reset, `502/503/504`, 일시적 broker 장애 | 제한된 횟수로 재시도 |
| Conditional | `429`, optimistic lock 충돌, 일부 `409` | 정책이나 최신 상태를 보고 재시도 여부 결정 |
| Non-retryable | validation error, 인증 실패, 권한 부족, 잘못된 상태 전이 | 즉시 실패 |

중요한 점은 **같은 요청이 나중에는 성공할 수 있는가**입니다.

예를 들어:

- `503`은 일시적일 수 있으므로 retry 후보
- `429`는 `Retry-After`나 정책에 따라 재시도 가능
- 입력 검증 오류는 같은 요청을 다시 보내도 거의 달라지지 않음

특히 **부작용이 있는 쓰기 호출**은 더 보수적으로 봐야 합니다.

- 결제 승인, 주문 생성, 포인트 차감처럼 side effect가 있는 호출은
- **멱등성이나 dedupe 장치가 없다면 retry를 기본값처럼 켜지 않는 편이 안전합니다**

정리하면 retry 가능성 판단은 오류 코드만이 아니라 **같은 요청을 다시 보내도 안전한가**까지 함께 봐야 합니다. 이 부분은 [멱등성과 재시도 (Idempotency and Retry)](idempotency-and-retry.md) 문서와 같이 설명하면 연결이 좋습니다.

즉, 오류 코드를 외우는 것보다 **일시적 장애와 구조적 실패를 구분한다**는 감각이 더 중요합니다.

---

## Retry는 어디서 할까

재시도는 가능한 한 **한 지점에서 통제**하는 편이 안전합니다.[^aws-retry]

| **위치** | **장점** | **주의점** |
| --- | --- | --- |
| Client | 사용자 경험과 요청 deadline을 가장 잘 앎 | 게이트웨이, SDK, 서비스와 중복되면 폭주 가능 |
| Gateway | 공통 네트워크 실패를 얕게 흡수 | 비즈니스 의미를 잘 모르면 과한 retry가 될 수 있음 |
| 서비스 내부 | 도메인 의미와 부작용을 가장 잘 앎 | 서비스마다 정책이 흩어질 수 있음 |
| Worker / Consumer | 비동기 재처리와 상태 추적이 쉬움 | 중복 처리와 지연 누적을 함께 다뤄야 함 |

실무에서는 보통 다음 기준이 자연스럽습니다.

- **사용자-facing 동기 요청:** 가능한 한 가까운 한 계층에서 제한된 retry
- **비동기 작업:** 워커나 소비자에서 재처리 정책 집중
- **게이트웨이:** 매우 얕은 네트워크 오류만 흡수

반대로 주문 생성, 결제 승인, 재고 차감처럼 **부작용이 큰 쓰기 경로**는 멱등성 보장이나 duplicate handling 없이 retry를 넣으면 위험합니다. 이런 경로는 retry 위치를 정하기 전에 먼저 [멱등성과 재시도 (Idempotency and Retry)](idempotency-and-retry.md) 기준으로 안전장치를 확인하는 편이 좋습니다.

중복 재시도는 문제를 키웁니다.

- 클라이언트 3회
- 게이트웨이 3회
- 서비스 SDK 3회

처럼 겹치면 실제 하위 시스템에는 27회가 갈 수 있습니다.

---

## Backoff와 Jitter

retry가 필요하더라도 즉시 연속 재시도하면 장애를 더 키울 수 있습니다.

- **Backoff:** 실패 후 다음 시도까지의 간격을 늘림
- **Jitter:** 여러 클라이언트의 재시도 시점을 흩뜨림

AWS는 backoff와 jitter가 없으면 동일한 순간에 재시도가 몰려 장애가 증폭될 수 있다고 설명합니다.[^aws-retry]

좋은 답변은 다음 정도를 포함하면 충분합니다.

- 고정 간격보다 **지수 백오프(exponential backoff)** 가 더 일반적
- jitter가 없으면 같은 시각에 요청이 다시 몰릴 수 있음
- 최대 retry 횟수와 최대 대기 시간도 같이 둬야 함

간단한 의사코드는 다음처럼 설명할 수 있습니다.

```python
# pseudocode
for attempt in range(1, max_retries + 1):
    if deadline_exceeded():
        raise TimeoutError()

    response = call()
    if response.success:
        return response
    if response.non_retryable:
        raise PermanentError()

    sleep(randomized_exponential_backoff(attempt))
```

즉, retry는 "몇 번 더 해본다"가 아니라  
**얼마나 천천히, 언제 포기할지까지 포함한 정책**입니다.

---

## Circuit Breaker란

**Circuit Breaker** 는 하위 시스템이 계속 실패할 때,  
요청을 계속 보내며 상황을 악화시키는 대신 **일시적으로 빠르게 실패시키는 패턴**입니다.[^azure-circuit-breaker]

보통 다음 상태로 설명합니다.

- **Closed:** 정상 상태. 요청을 통과시킴
- **Open:** 일정 실패 임계치를 넘으면 요청을 차단
- **Half-Open:** 일부 요청만 흘려 보내 회복 여부를 시험

예를 들어 최근 20초 동안 실패율이 50%를 넘으면 `open`으로 전환하고, 30초 뒤 제한된 probe 요청 몇 개만 보내 성공률이 회복되면 `half-open -> closed`로 되돌리는 식으로 운영할 수 있습니다.

이 패턴의 핵심 가치는 다음과 같습니다.

- 느린 하위 시스템을 무작정 때리지 않음
- 호출자 자원을 오래 붙잡지 않음
- fallback이나 degrade 경로로 빠지기 쉬움

좋은 답변은 "`circuit breaker를 넣습니다`"보다  
**언제 열고, 얼마 동안 열어 두고, 어떻게 회복을 확인할지**를 말하는 편이 좋습니다.

---

## Fallback과 Fast Fail

복원력은 항상 성공시키는 것이 아니라,  
**덜 나쁜 방식으로 실패하거나 축소 동작하는 것**까지 포함합니다.

대표 선택지는 다음과 같습니다.

- **Fallback:** 캐시, 오래된 데이터, 기본값, 읽기 전용 모드로 우회
- **Fast Fail:** 이미 망가진 하위 시스템을 기다리지 않고 빠르게 실패
- **Graceful Degradation:** 추천, 알림, 통계 같은 부가 기능만 끄고 핵심 경로는 유지

예를 들면:

- 추천 서비스 장애 시 기본 추천 목록 사용
- 분석 적재 장애 시 핵심 주문 처리는 유지
- 결제 승인 같은 핵심 쓰기는 fallback보다 강한 실패 처리가 더 자연스러움

즉, fallback은 무조건 좋은 것이 아니라  
**무엇을 포기해도 되는지**가 정의돼 있을 때 유용합니다.

---

## Retry Storm와 Cascading Failure

복원력 패턴을 잘못 쓰면 오히려 장애를 키울 수 있습니다.

- **Retry Storm:** 모두가 동시에 재시도해서 부하가 더 커짐
- **Cascading Failure:** 한 하위 시스템 장애가 호출 체인을 따라 상위 전체로 번짐

대표 원인은 다음과 같습니다.

- timeout이 너무 길어 스레드와 연결이 묶임
- 여러 계층이 동시에 retry
- circuit breaker 없이 죽은 시스템을 계속 호출
- fallback이 또 다른 병목을 만듦

좋은 답변은 개별 패턴만 설명하는 것이 아니라  
**timeout, retry, circuit breaker, fallback을 한 세트로 본다**는 식이 좋습니다.

---

## 자주 하는 실수

- timeout 없이 retry만 추가함
- retryable과 non-retryable failure를 구분하지 않음
- 여러 계층에 retry를 중복 배치함
- `429`와 `503`을 같은 방식으로 다룸
- circuit breaker를 열 기준과 회복 기준 없이 도입함
- fallback 경로의 데이터 정확도와 비용을 설명하지 않음
- 복원력 패턴을 서비스 코드, 메시, 게이트웨이에 전부 중첩함

---

## 면접 포인트

- **복원력은 실패를 없애는 기술이 아니라, 부분 실패를 어떻게 제한하고 흡수할지 정하는 설계입니다.**
- **retry보다 timeout budget을 먼저 설명하면 답변이 더 구조적으로 들립니다.**
- **retry는 한 지점에서 통제하고, backoff와 jitter를 같이 말하는 편이 좋습니다.**
- **circuit breaker는 실패를 감추는 장치가 아니라 장애 전파를 줄이는 장치입니다.**
- **좋은 답변은 retry storm와 cascading failure까지 같이 설명합니다.**

---

## 참고 자료

[^aws-retry]: AWS Builders Library, "Timeouts, retries, and backoff with jitter" - https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
[^azure-circuit-breaker]: Microsoft Learn, "Circuit Breaker pattern" - https://learn.microsoft.com/azure/architecture/patterns/circuit-breaker
