---
title: 작업 스케줄링과 워크플로우 (Job Scheduling and Workflows)
description: 배치 작업 스케줄링, 재시도 전략, 워크플로우 오케스트레이션을 살펴봅니다.
parent: 클라우드
nav_order: 17
---

# 작업 스케줄링과 워크플로우 (Job Scheduling and Workflows)

## 목차

- [작업 스케줄링과 워크플로우를 왜 묻는가](#작업-스케줄링과-워크플로우를-왜-묻는가)
- [작업 스케줄링이란](#작업-스케줄링이란)
- [Cron, Batch, Queue Worker의 차이](#cron-batch-queue-worker의-차이)
- [Scheduler와 Workflow Orchestrator의 차이](#scheduler와-workflow-orchestrator의-차이)
- [Retry와 Backoff](#retry와-backoff)
- [멱등성과 중복 실행 대비](#멱등성과-중복-실행-대비)
- [Long-Running Job을 다루는 방법](#long-running-job을-다루는-방법)
- [운영 시 모니터링과 알림](#운영-시-모니터링과-알림)
- [트레이드오프](#트레이드오프)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 작업 스케줄링과 워크플로우를 왜 묻는가

백엔드 면접에서 이 주제는  
"cron을 써봤는가"를 묻는 문제로 끝나지 않습니다.

보통 다음 질문으로 이어집니다.

- 정해진 시간에 반복 작업을 어떻게 실행할 것인가
- 실패한 잡은 어디까지 재시도할 것인가
- 여러 단계를 가진 배치 흐름을 어떻게 관리할 것인가
- 오래 걸리는 작업 상태를 어떻게 추적할 것인가

즉, 핵심은  
**백그라운드 작업을 단순 스크립트가 아니라 운영 가능한 워크플로우로 설명할 수 있는가**입니다.

분산 비동기 처리 관점은 [메시징 시스템 (Messaging System)](messaging-system.md),  
배포 자동화 관점은 [배포 전략과 CI/CD (Deployment Strategies and CI/CD)](ci-cd-and-deployment.md),  
멱등성 일반론은 [분산 데이터 처리 (Distributed Data Processing)](../database/distributed-data-processing.md) 문서와 같이 보면 좋습니다.
HTTP API, 워커, 메시지 소비자에서 재시도를 어디에 둘지와 `Idempotency-Key` 일반론은 [멱등성과 재시도 (Idempotency and Retry)](../system-design/idempotency-and-retry.md) 문서와 같이 보면 연결이 좋습니다.
timeout, retry, circuit breaker를 한 세트의 복원력 패턴으로 설명하려면 [복원력 패턴 (Timeout, Retry, Circuit Breaker)](../system-design/resilience-patterns.md) 문서와 함께 보면 좋습니다.

---

## 작업 스케줄링이란

작업 스케줄링은  
정해진 시점이나 조건에 맞춰 백그라운드 잡을 실행하는 운영 방식입니다.

대표 예시는 다음과 같습니다.

- 매일 새벽 정산 배치
- 5분마다 실패 결제 재확인
- 업로드 후 썸네일 생성
- 보고서 생성과 메일 발송

좋은 답변은 "배치 돌립니다"보다  
**언제 실행되는지, 실패 시 어떻게 다시 시도하는지, 어디서 상태를 보는지**를 같이 설명하는 편이 좋습니다.

---

## Cron, Batch, Queue Worker의 차이

| **방식** | **잘 맞는 경우** | **주의점** |
| --- | --- | --- |
| Cron | 고정 시각 반복 작업 | 실패 추적과 중복 실행 방지가 약할 수 있음 |
| Batch Job | 대량 데이터 처리, 정기 집계 | 오래 걸리면 운영 부담이 커짐 |
| Queue Worker | 비동기 이벤트 처리, 유연한 확장 | 재시도와 중복 처리 설계가 필요 |

### Cron

cron은 가장 단순한 스케줄링 방식입니다.

- 매일 02시 실행
- 매시간 정각 실행
- 10분마다 상태 점검

장점은 단순함이지만, 다음을 놓치기 쉽습니다.

- 이전 실행이 안 끝났는데 다음 실행이 시작되는 문제
- 서버 시간, 타임존, 중복 실행
- 실패 시 누가 다시 실행하는지 불명확

### Batch Job

batch job은 보통 큰 데이터 집합을 한 번에 처리하는 작업입니다.

- 정산
- 집계
- 백필
- 아카이빙

이 경우에는 실행 시간, 처리량, 재시작 가능성까지 같이 봐야 합니다.

### Queue Worker

queue worker는 작업을 메시지나 큐로 받아 처리합니다.

- 이미지 처리
- 메일 발송
- webhook 재시도
- 대량 요청 완충

좋은 답변은  
**정해진 시간 기반 작업은 scheduler, 이벤트 기반 작업은 queue worker가 자연스럽다**고 구분하는 편이 좋습니다.

---

## Scheduler와 Workflow Orchestrator의 차이

이 둘은 비슷해 보이지만 역할이 다릅니다.

| **항목** | **Scheduler** | **Workflow Orchestrator** |
| --- | --- | --- |
| 주 역할 | 작업 시작 시점 결정 | 여러 단계 실행과 상태 전이 관리 |
| 적합한 경우 | 단일 잡, 주기 실행 | 다단계 배치, 분기/재시도/보상 필요 |
| 예시 감각 | cron, scheduled job | Airflow[^airflow], Temporal[^temporal], Step Functions[^aws-step-functions] |

예를 들어:

- "매일 새벽 2시에 정산 시작"은 scheduler 문제
- "정산 파일 생성 → 외부 전송 → 결과 검증 → 실패 시 재시도"는 workflow 문제

여기서도 결이 조금 다릅니다.

- Airflow 같은 도구는 배치/데이터 파이프라인 오케스트레이션에 더 자주 쓰입니다.[^airflow]
- Step Functions, Temporal 같은 도구는 애플리케이션 워크플로우, 보상 트랜잭션, 장시간 실행 상태 관리 쪽에 더 자주 연결됩니다.[^aws-step-functions][^temporal]

즉, scheduler는 **언제 시작할지**, orchestrator는 **어떤 단계로 진행할지**를 다루는 편이 자연스럽습니다.

---

## Retry와 Backoff

백그라운드 잡은 실패를 전제로 설계하는 편이 좋습니다.

대표 패턴은 다음과 같습니다.

- 즉시 재시도
- 지수 백오프(exponential backoff)
- 최대 재시도 횟수 제한
- DLQ 또는 실패 저장소 이동

좋은 운영은 무한 재시도를 하지 않습니다.

- 외부 API 장애 때 시스템 전체가 몰려들 수 있음
- 영구 실패인데도 계속 재시도하면 비용만 증가
- 중복 처리와 순서 문제를 같이 만들 수 있음

면접에서는 "실패하면 다시 시도합니다"보다  
**어떤 오류만 재시도하고, 얼마나 기다리고, 언제 포기할지**를 말하는 편이 더 좋습니다.

이 문서에서는 워크플로우 운영 위치에 집중하고, backoff, jitter, circuit breaker의 일반론은 [복원력 패턴 (Timeout, Retry, Circuit Breaker)](../system-design/resilience-patterns.md) 문서로 연결하면 좋습니다.

---

## 멱등성과 중복 실행 대비

스케줄러와 워커는 중복 실행을 피하기 어렵습니다.

예를 들어:

- 스케줄러가 같은 잡을 두 번 트리거
- 워커가 timeout 후 재시도
- ack 전에 죽어서 메시지가 다시 전달

그래서 다음 장치가 자주 필요합니다.

- idempotency key
- processed_jobs 테이블
- unique constraint
- 상태 전이 체크
- 분산 락 또는 leader election

좋은 답변은 "한 번만 실행되게 합니다"보다  
**중복 실행이 일어나도 결과가 망가지지 않게 설계한다**는 흐름이 더 실무적입니다.

관련 구현 디테일은 [분산 데이터 처리 (Distributed Data Processing)](../database/distributed-data-processing.md) 문서와 연결됩니다.

---

## Long-Running Job을 다루는 방법

오래 걸리는 작업은 요청-응답 모델로 다루기 어렵습니다.

보통 다음 감각이 중요합니다.

- 작업 ID 발급
- 상태 저장: queued / running / succeeded / failed
- checkpoint 또는 chunk 처리
- resume 가능성
- timeout과 cancellation

예를 들어 보고서 생성이나 대량 export는:

- 요청 시 job 생성
- 비동기로 처리
- 진행률 조회 API 제공
- 완료 후 다운로드 링크 제공

즉, long-running job은  
**한 번에 끝나는 함수 호출이 아니라 상태를 가진 작업 객체처럼 다루는 편이 자연스럽습니다**.

---

## 운영 시 모니터링과 알림

잡 시스템은 실행만큼 관측성이 중요합니다.

대표적으로 보는 항목은 다음과 같습니다.

- 스케줄 누락
- queue backlog
- 평균 처리 시간
- 실패율과 재시도 횟수
- stuck job 수
- DLQ 건수

좋은 운영은 로그만 보는 것이 아니라  
**실패율, 지연, 적체, 누락 실행을 메트릭으로 잡고 경보를 둔다**는 쪽입니다.

관측성 일반론은 [로깅 및 모니터링 (Logging & Monitoring)](logging-monitoring.md) 문서와 같이 보면 좋습니다.

---

## 트레이드오프

| **선택** | **장점** | **주의점** |
| --- | --- | --- |
| 단순 cron 기반 | 구현이 쉽고 빠름 | 중복 실행, 상태 추적, 재시도 관리가 약함 |
| 큐 기반 워커 | 확장과 비동기 처리에 유리 | 멱등성과 재시도 설계가 필수 |
| 워크플로우 엔진 도입 | 복잡한 단계 관리와 가시성 향상 | 운영 복잡도와 러닝커브 증가 |
| 긴 배치를 잘게 분할 | 재시작과 확장에 유리 | 설계와 상태 관리가 복잡해짐 |

좋은 답변은 "도구를 씁니다"보다  
**작업 복잡도와 실패 양상에 맞게 cron, queue, workflow를 어디까지 쓸지 정한다**고 설명하는 편이 좋습니다.

---

## 면접 포인트

- cron, batch, queue worker는 실행 조건과 운영 방식이 다르다.
- scheduler는 시작 시점, workflow orchestrator는 단계와 상태 전이를 다루는 문제다.
- retry는 무조건 많이 하는 것이 아니라 backoff와 중단 기준을 같이 둬야 한다.
- 백그라운드 작업은 중복 실행이 생길 수 있으므로 멱등성이 거의 기본값에 가깝다.
- long-running job은 상태 추적, 재시작, timeout까지 같이 설명해야 답변이 강해진다.

---

## 참고 자료

[^temporal]: Temporal Docs, What is Temporal? - https://docs.temporal.io/temporal
[^airflow]: Apache Airflow Documentation - https://airflow.apache.org/docs/
[^aws-step-functions]: AWS Documentation, What is AWS Step Functions? - https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html
