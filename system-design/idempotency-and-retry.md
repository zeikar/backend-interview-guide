---
title: 멱등성과 재시도 (Idempotency and Retry)
description: 멱등성, 재시도, idempotency key, backoff 전략을 시스템 디자인 면접 관점에서 정리합니다.
parent: 시스템 디자인
nav_order: 16
---

# 멱등성과 재시도 (Idempotency and Retry)

## 목차

- [왜 이 주제를 묻는가](#왜-이-주제를-묻는가)
- [멱등성과 재시도는 다르다](#멱등성과-재시도는-다르다)
- [어떤 작업이 멱등해야 하는가](#어떤-작업이-멱등해야-하는가)
- [HTTP 메서드와 idempotency key](#http-메서드와-idempotency-key)
- [idempotency key 저장 전략](#idempotency-key-저장-전략)
- [재시도는 어디서 할까](#재시도는-어디서-할까)
- [재시도해도 되는 실패와 아닌 실패](#재시도해도-되는-실패와-아닌-실패)
- [Backoff, Jitter, Timeout](#backoff-jitter-timeout)
- [중복 처리와 보상](#중복-처리와-보상)
- [자주 하는 실수](#자주-하는-실수)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 왜 이 주제를 묻는가

멱등성과 재시도는 단순한 API 테크닉이 아니라, 분산 시스템에서 **중복 요청과 부분 실패를 어떻게 흡수할지**를 묻는 질문입니다.

이 문서는 [API 설계 (API Design)](api-design.md), [메시징 및 이벤트 기반 아키텍처 (Event-Driven Architecture)](event-driven-architecture.md), [메시징 시스템](../cloud/messaging-system.md)에서 흩어져 있는 내용을 하나의 면접 흐름으로 묶습니다.

면접관은 보통 다음을 확인하려고 이 질문을 던집니다.

- 네트워크 타임아웃이 나도 같은 작업을 다시 시도할 수 있는가
- 같은 요청이 두 번 도착해도 데이터가 깨지지 않는가
- 재시도를 여러 계층에서 중복으로 걸어두지 않는가
- 중복 요청, 재시도, 보상 처리를 구분해서 설명할 수 있는가

즉, 이 주제는 "에러가 나면 다시 보내면 된다"가 아니라 **다시 보내도 안전하게 만들고, 어디서 다시 보낼지 정하는 문제**입니다.

---

## 멱등성과 재시도는 다르다

두 개념은 자주 같이 나오지만 역할이 다릅니다.

| **항목** | **멱등성(Idempotency)** | **재시도(Retry)** |
| --- | --- | --- |
| 성격 | 요청 또는 작업의 성질 | 실패한 요청을 다시 보내는 정책 |
| 질문 | 같은 요청이 여러 번 와도 결과가 같은가 | 실패했을 때 다시 시도해야 하는가 |
| 책임 | 서버와 데이터 모델 | 클라이언트, 워커, 게이트웨이, 소비자 |
| 위험 | 중복 처리, 중복 부작용 | retry storm, 지연 증가, 부하 증폭 |

멱등성은 **"같은 입력을 여러 번 적용해도 최종 상태가 같은가"**를 보는 성질입니다.  
재시도는 **"실패한 호출을 다시 보내서 성공 확률을 높일 것인가"**를 정하는 운영 정책입니다.

이 둘을 분리해서 생각해야 합니다. 재시도는 멱등성을 대신하지 못하고, 멱등성은 재시도를 자동으로 보장하지 않습니다.

---

## 어떤 작업이 멱등해야 하는가

멱등성은 모든 곳에 똑같이 필요한 것이 아니라, **실패 후 같은 요청이 다시 들어올 가능성이 높은 경계**에 먼저 필요합니다.

| **대상** | **왜 멱등해야 하는가** | **실무 장치** |
| --- | --- | --- |
| HTTP API | 클라이언트 재시도, 로드 밸런서 재전송, 네트워크 타임아웃으로 같은 요청이 다시 도착할 수 있음 | `Idempotency-Key`, unique constraint, upsert |
| 메시지 소비자 | at-least-once 전달에서는 같은 이벤트를 다시 받을 수 있음 | processed-message table, dedupe key, 상태 전이 검사 |
| 배치 / 워크플로 | 작업 재시작, 실패 후 재실행, 운영자 수동 재처리로 같은 단계가 다시 돌 수 있음 | 체크포인트, 단계별 상태 저장, 보상 작업 |

이 중에서도 면접에서 가장 자주 나오는 경계는 다음입니다.

- 결제, 주문 생성, 환불 같은 `POST` API
- Kafka / RabbitMQ 소비자
- 야간 배치와 재처리 작업

관련 구현 상세는 [메시징 시스템](../cloud/messaging-system.md)에서, 이벤트 흐름 관점은 [메시징 및 이벤트 기반 아키텍처 (Event-Driven Architecture)](event-driven-architecture.md)에서 더 깊게 볼 수 있습니다.

---

## HTTP 메서드와 idempotency key

HTTP에는 메서드 자체의 멱등성이 있습니다. RFC 9110은 `PUT`, `DELETE`, 그리고 safe method를 멱등하다고 정의합니다.[^rfc9110]

하지만 면접에서 중요한 점은 **HTTP 메서드의 멱등성**과 **비즈니스 작업의 멱등성**이 같지 않다는 것입니다.

- `PUT /orders/123` 처럼 리소스를 덮어쓰는 요청은 메서드 의미상 멱등하게 설계할 수 있습니다.
- `POST /orders` 처럼 새 리소스를 생성하는 요청은 기본적으로 멱등하지 않습니다.
- 다만 `POST` 이더라도 `Idempotency-Key`를 붙여 서버가 같은 작업으로 인식하게 만들면 실무에서는 재시도 가능하게 만들 수 있습니다.[^stripe-idempotency]

| **구분** | **의미** | **예시** |
| --- | --- | --- |
| HTTP 메서드 멱등성 | 프로토콜 차원의 의미 | `PUT`, `DELETE`, safe method |
| 비즈니스 멱등성 | 같은 작업이 두 번 와도 한 번만 반영되는 성질 | 결제 승인, 주문 생성, 환불 |
| idempotency key | 같은 작업임을 서버가 식별하는 토큰 | `Idempotency-Key: abc-123` |

실무에서는 보통 다음처럼 설명하면 좋습니다.

- HTTP 메서드가 멱등하다고 해서 항상 안전한 것은 아니다.
- `POST`라도 idempotency key를 두면 재시도 가능한 API로 만들 수 있다.
- 같은 key에 다른 payload가 오면 같은 작업으로 취급하면 안 된다.

Stripe는 같은 key를 24시간 기준으로 재사용하는 시나리오를 안내하고, 같은 키에 다른 파라미터가 들어오면 오류로 처리하는 방향을 설명합니다.[^stripe-idempotency]

---

## idempotency key 저장 전략

idempotency key는 보통 "키만 저장"하는 것이 아니라, **같은 요청인지 검증하고 같은 결과를 돌려줄 수 있도록 필요한 메타데이터**까지 함께 저장합니다.

대표적으로 다음 항목이 들어갑니다.

- `idempotency key`
- 요청 payload의 해시
- 처리 상태
- 최종 응답 또는 응답 참조
- 만료 시각 (`expires_at`)

같은 key가 동시에 들어오는 상황도 따로 생각해야 합니다. 실무에서는 보통 상태를 `in_progress -> completed / failed`처럼 관리하고, 첫 요청만 key를 선점하도록 만듭니다. 뒤에 들어온 요청은 진행 중 상태를 보고 대기, 재시도, 또는 충돌 응답 중 하나로 처리합니다.

여기서 중요한 것은 **idempotency record 생성과 실제 비즈니스 쓰기의 원자성 경계**입니다. 가능한 한 같은 트랜잭션이나 원자적 갱신 경계 안에 두는 편이 좋습니다. 그렇지 않으면 key는 저장됐는데 실제 작업은 실패했거나, 반대로 작업은 성공했는데 key 저장이 실패한 틈이 생길 수 있습니다.

| **전략** | **적합한 경우** | **장점** | **한계** |
| --- | --- | --- | --- |
| 같은 업무 테이블에 unique constraint | 단일 행 생성이나 자연키가 분명한 경우 | 구현이 단순하고 일관성이 좋음 | 여러 단계 작업에는 맞추기 어렵다 |
| 별도 idempotency 테이블 | `POST` 기반 생성 API, 외부 API 연동 | 요청 이력과 응답 재사용이 쉽다 | 저장소와 정리 로직이 필요하다 |
| 캐시/Redis + TTL | 짧은 재시도 창을 빠르게 흡수하고 싶을 때 | 조회가 빠르고 운영이 가볍다 | 캐시 만료 뒤 중복이 새어 나갈 수 있다 |

TTL은 너무 짧으면 중복 재전송을 흡수하지 못하고, 너무 길면 저장 비용과 관리 비용이 늘어납니다.  
실무에서는 **클라이언트와 네트워크가 실제로 다시 보낼 수 있는 시간 창**을 기준으로 TTL을 잡는 편이 좋습니다. Stripe는 24시간을 기준으로 설명합니다.[^stripe-idempotency]

핵심은 **"얼마 동안 같은 작업으로 볼 것인가"** 입니다.  
이 기준이 없으면 같은 key가 재사용되었을 때 오래된 결과를 돌려줄지, 충돌로 볼지, 새 요청으로 볼지 판단할 수 없습니다.

---

## 재시도는 어디서 할까

AWS Builders Library는 재시도를 모든 계층에서 중복으로 넣기보다, **스택의 한 지점에 집중하는 편이 낫다**고 설명합니다.[^aws-retry]  
이 문서는 그 조언을 설계 원칙으로 삼습니다.

| **위치** | **언제 적합한가** | **장점** | **주의점** |
| --- | --- | --- | --- |
| Client | 사용자가 결과를 기다리는 직접 호출 | 호출 경로를 가장 잘 아는 쪽에서 제어 가능 | 여러 계층이 같이 retry하면 중복 증폭이 생김 |
| Gateway | 공통 네트워크 실패를 얕게 흡수할 때 | 정책을 중앙화하기 좋음 | 비즈니스 의미를 모르므로 과도한 retry는 위험함 |
| Worker / Batch | 내부 잡, 백그라운드 처리, 재처리 파이프라인 | 체크포인트와 함께 관리하기 좋음 | 작업 단계별 부작용을 분리해야 함 |
| Message Consumer | at-least-once 소비와 재처리가 있는 경우 | offset과 처리 상태를 같이 다루기 좋음 | offset commit 시점이 늦으면 중복이 늘어난다 |

실무에서는 보통 다음 순서가 안전합니다.

1. timeout으로 기다릴 상한을 먼저 정한다
2. retry는 가능한 한 한 계층에만 둔다
3. duplicate handling으로 최종 중복을 막는다

Gateway는 공통 정책을 담당하기 좋지만, **결제 완료 여부나 주문 상태 같은 도메인 의미는 서비스가 더 잘 안다**는 점을 잊지 않는 편이 좋습니다.

---

## 재시도해도 되는 실패와 아닌 실패

재시도는 모든 오류에 적용하는 기능이 아닙니다.  
핵심은 **같은 요청이 나중에 다시 성공할 가능성이 있는가**입니다.

| **구분** | **예시** | **기본 대응** |
| --- | --- | --- |
| Retryable | 네트워크 timeout, connection reset, 502/503/504, 일시적 broker 장애, `Retry-After`가 있는 429 | backoff를 두고 제한된 횟수만 재시도 |
| Non-retryable | validation error, 인증 실패, 권한 부족, 잘못된 상태 전이 | 즉시 실패로 반환 |
| 상황 의존 | optimistic lock 충돌, eventual consistency로 인한 일시적 미조회, 일부 409 conflict | 새 상태를 읽은 뒤 재시도 여부를 판단 |

Azure는 retry pattern을 transient fault에 쓰고, 비즈니스 로직 오류에는 쓰지 않는다고 설명합니다.[^azure-retry]  
AWS 역시 HTTP 관점에서 client error는 같은 요청을 재시도해도 성공 가능성이 낮고, server error는 일시적일 수 있다고 설명합니다.[^aws-retry]

면접에서는 "`4xx`는 무조건 재시도하지 않는다"처럼 단정하기보다,  
**오류의 성격이 일시적이냐 구조적이냐**를 구분해서 말하는 편이 안전합니다.

---

## Backoff, Jitter, Timeout

재시도 설계에서 timeout, backoff, jitter는 함께 봐야 합니다.

- **Timeout:** 요청을 얼마나 오래 기다릴지 정하는 상한
- **Backoff:** 실패 후 다음 재시도까지 기다리는 간격을 늘리는 방식
- **Jitter:** 재시도 시간을 조금씩 흩어 같은 시점에 몰리지 않게 하는 장치

AWS는 timeout과 retry를 함께 다루면서, 무작정 빠르게 반복하는 retry는 부하가 원인인 장애를 더 악화시킬 수 있다고 설명합니다.[^aws-retry]

실무 감각으로 보면 다음이 중요합니다.

- timeout이 너무 짧으면 정상 요청도 자주 실패한다
- timeout이 너무 길면 상위 요청이 불필요하게 막힌다
- backoff가 없으면 장애 시 요청이 한꺼번에 몰린다
- jitter가 없으면 같은 순간에 재시도가 겹친다

즉, 좋은 답변은 `"retry를 넣습니다"`가 아니라 **"timeout으로 경계를 자르고, backoff와 jitter로 재시도 충돌을 흩뜨리고, 상위 계층 하나에서만 retry합니다"** 입니다.

---

## 중복 처리와 보상

재시도는 결국 중복을 만들 수 있습니다. 그래서 멱등성과 duplicate handling은 같이 가야 합니다.

대표적인 흡수 방식은 다음과 같습니다.

- **unique constraint:** 같은 비즈니스 키가 두 번 들어오면 두 번째를 막음
- **upsert:** 존재하면 갱신하고 없으면 생성
- **processed-message table:** 이미 처리한 메시지는 무시
- **상태 전이 검사:** 이미 완료된 작업은 다시 진행하지 않음

메시지 소비자에서는 특히 `offset commit` 시점이 중요합니다.  
처리 완료 전에 offset을 커밋하면 메시지를 잃을 수 있고, 처리 후 커밋 전에 장애가 나면 같은 메시지를 다시 받을 수 있습니다. 그래서 소비자 측 멱등성은 사실상 기본 요구사항에 가깝습니다.

보상 작업은 멱등성을 대체하지 않습니다.  
보상은 "되돌릴 수 없으니 반대 동작을 하나 더 하자"에 가깝고, 멱등성은 "애초에 같은 작업이 여러 번 반영되지 않게 하자"에 가깝습니다.

---

## 자주 하는 실수

- 멱등성을 "재시도 가능"과 같은 뜻으로 써버림
- HTTP `POST`에 idempotency key 없이 결제/주문 생성 API를 만듦
- idempotency key는 저장하지만 payload hash를 저장하지 않음
- retry를 클라이언트, 게이트웨이, 워커, 소비자에 전부 넣음
- timeout 없이 retry만 넣어서 장애 시 더 오래 붙잡음
- `4xx`와 `5xx`를 같은 방식으로 재시도함
- offset commit 전에 side effect를 완료했다고 가정함
- TTL을 너무 짧게 잡아 재전송 창을 놓침

면접에서는 이 실수를 하나씩 짚는 것만으로도 실무 감각을 보여줄 수 있습니다.

---

## 면접 포인트

- **멱등성은 요청의 성질이고, 재시도는 실패 대응 정책입니다.**
- **HTTP 메서드 멱등성과 비즈니스 멱등성은 다르므로 idempotency key를 별도로 설계해야 합니다.**
- **재시도는 여러 계층에 흩뿌리기보다 한 지점에서 통제하는 편이 안전합니다.**
- **retryable / non-retryable error를 구분하려면 일시적 장애와 구조적 실패를 나눠서 봐야 합니다.**
- **timeout, backoff, jitter, duplicate handling은 한 세트로 설명해야 답변이 강해집니다.**
- **메시지 소비자와 배치 작업은 멱등성을 거의 기본값으로 두고 설명하는 편이 좋습니다.**

---

## 참고 자료

[^rfc9110]: RFC 9110, "HTTP Semantics" - https://datatracker.ietf.org/doc/html/rfc9110
[^stripe-idempotency]: Stripe Docs, "Idempotent requests" - https://docs.stripe.com/api/idempotent_requests
[^aws-retry]: AWS Builders Library, "Timeouts, retries, and backoff with jitter" - https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
[^azure-retry]: Microsoft Learn, "Retry pattern" - https://learn.microsoft.com/en-us/azure/architecture/patterns/retry
