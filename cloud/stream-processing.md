---
title: 스트림 처리 (Stream Processing)
description: 배치와 스트림의 차이, event time, watermark, stateful processing, Spark와 Flink 비교를 면접 관점에서 정리했습니다.
parent: 클라우드
nav_order: 20
---

# 스트림 처리 (Stream Processing)

## 목차

- [왜 스트림 처리를 묻는가](#왜-스트림-처리를-묻는가)
- [스트림 처리란](#스트림-처리란)
- [배치 처리와 스트림 처리의 차이](#배치-처리와-스트림-처리의-차이)
- [Event Time과 Processing Time](#event-time과-processing-time)
- [Window와 Watermark](#window와-watermark)
- [Stateful Processing이 중요한 이유](#stateful-processing이-중요한-이유)
- [Spark와 Flink를 어떻게 비교할까](#spark와-flink를-어떻게-비교할까)
- [Kafka Consumer로 충분한 경우와 아닌 경우](#kafka-consumer로-충분한-경우와-아닌-경우)
- [운영에서 자주 나오는 포인트](#운영에서-자주-나오는-포인트)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 왜 스트림 처리를 묻는가

면접에서 스트림 처리를 묻는 이유는 단순히 "Kafka를 써봤는가"를 보려는 것이 아닙니다.

보통 다음을 확인하려는 경우가 많습니다.

- **시간 개념 이해:** 이벤트가 늦게 도착하면 집계를 어떻게 다룰 것인가
- **상태 관리 이해:** 실시간 집계, deduplication, 세션 계산을 어떻게 유지할 것인가
- **처리 모델 이해:** 배치와 스트림이 무엇이 다른지 설명할 수 있는가
- **도구 선택 감각:** Kafka consumer면 충분한지, Spark나 Flink 같은 엔진이 필요한지 판단할 수 있는가

이 문서는 **분산 처리 엔진과 운영 모델**에 초점을 둡니다.  
메시징 일반론은 [메시징 시스템 (Messaging System)](messaging-system.md), Kafka 심화는 [Kafka (Apache Kafka)](kafka.md) 문서와 같이 보면 좋습니다.

---

## 스트림 처리란

**스트림 처리(Stream Processing)** 는 끝이 정해지지 않은 이벤트 흐름을 지속적으로 읽고 가공하는 처리 모델입니다.

대표 예시는 다음과 같습니다.

- 클릭 로그 실시간 집계
- 결제 이상 탐지
- 실시간 추천 피처 계산
- IoT 센서 데이터 모니터링

중요한 점은 스트림 처리가 "메시지를 읽는다"에서 끝나지 않는다는 점입니다.

- 상태를 유지해야 할 수 있음
- 늦게 온 데이터를 반영해야 할 수 있음
- 집계 결과를 지속적으로 갱신해야 할 수 있음
- 장애 후 재처리와 복구를 고려해야 함

즉, 스트림 처리는  
**이벤트를 연속적으로 읽으면서 시간과 상태를 함께 다루는 계산 모델**이라고 설명하는 편이 좋습니다.

---

## 배치 처리와 스트림 처리의 차이

| **항목** | **배치 처리** | **스트림 처리** |
| --- | --- | --- |
| 입력 | 유한한 데이터셋 | 끝이 정해지지 않은 이벤트 흐름 |
| 실행 감각 | 정해진 시점에 한 번 실행 | 지속적으로 실행 |
| 지연 시간 | 분~시간 단위도 허용 가능 | 초~밀리초 단위가 중요할 수 있음 |
| 주 관심사 | 처리량, 비용, 전체 재계산 | 지연, 상태, late event, 복구 |
| 대표 예시 | 일별 정산, 백필, 리포트 생성 | 실시간 알림, 이상 탐지, 실시간 집계 |

면접에서는 둘을 완전히 반대 개념처럼 설명하기보다,  
**같은 문제를 다른 freshness 요구사항으로 푸는 방식**이라고 설명하면 더 좋습니다.

예를 들어:

- 하루 뒤에 봐도 되는 매출 집계는 배치 처리로 충분할 수 있음
- 초 단위로 변하는 대시보드는 스트림 처리가 더 자연스러울 수 있음

즉, 스트림 처리는 "더 고급"이라기보다  
**낮은 지연과 지속적 계산이 필요한 경우의 선택지**입니다.

---

## Event Time과 Processing Time

스트림 처리에서 가장 자주 나오는 개념이 시간입니다.

- **Event Time:** 이벤트가 실제로 발생한 시각
- **Processing Time:** 시스템이 이벤트를 처리한 시각

이 둘을 구분해야 하는 이유는 이벤트가 늦게 도착할 수 있기 때문입니다.

예를 들어 사용자가 10:00:05에 클릭했지만, 네트워크 지연 때문에 10:00:20에 도착할 수 있습니다.

- event time 기준 집계: 10:00:05 구간에 반영
- processing time 기준 집계: 10:00:20에 도착한 것으로 처리

좋은 답변은 다음처럼 정리됩니다.

- **event time:** 비즈니스적으로 더 자연스러운 시간 기준
- **processing time:** 구현이 단순하지만 지연과 순서 뒤틀림에 취약할 수 있음

실시간 분석이나 과금처럼 시간 정합성이 중요하면  
보통 event time 개념을 함께 설명하는 편이 좋습니다.[^spark-streaming][^flink-home]

---

## Window와 Watermark

스트림은 끝이 없기 때문에 "언제 집계를 끊을지"를 정해야 합니다.

그래서 window 개념이 필요합니다.

- **Tumbling Window:** 겹치지 않는 고정 길이 구간
- **Sliding Window:** 일정 간격으로 겹치며 이동하는 구간
- **Session Window:** 사용자 활동 간격이 끊길 때 세션 경계를 두는 구간

문제는 늦게 도착한 이벤트입니다. 여기서 **watermark** 가 등장합니다.

watermark는 대략적으로  
"이 시점 이전 이벤트는 웬만하면 다 왔다고 보고 창(window)을 닫겠다"는 기준입니다.[^spark-watermark][^flink-home]

이 개념을 설명할 때 중요한 포인트는 다음입니다.

- **장점:** late event를 어느 정도 반영하면서도 결과를 마무리할 수 있습니다.
- **장점:** 무한히 기다리지 않고 상태 크기를 제한할 수 있습니다.
- **단점:** watermark를 너무 짧게 잡으면 늦은 이벤트를 놓칠 수 있습니다.
- **단점:** 너무 길게 잡으면 결과 확정이 늦고 상태가 커집니다.

즉, watermark는 정답 공식이 아니라  
**정확도와 지연 사이의 운영 기준**입니다.

---

## Stateful Processing이 중요한 이유

스트림 처리가 어려운 이유는 단순 필터링보다 **상태(state)** 가 필요한 연산이 많기 때문입니다.

대표 예시는 다음과 같습니다.

- 최근 10분 클릭 수 집계
- 사용자 세션 계산
- 중복 이벤트 제거
- 이상 탐지를 위한 최근 패턴 유지

이런 연산은 이벤트 하나만 보고는 계산이 끝나지 않습니다.  
이전 이벤트들의 맥락을 상태로 유지해야 합니다.

그래서 스트림 엔진은 보통 다음 능력이 중요합니다.

- **상태 저장:** 연산 중간 상태를 유지
- **체크포인트/복구:** 장애 후 상태를 복원
- **재처리 감각:** 다시 읽어도 결과가 크게 틀어지지 않게 설계

여기서 exactly-once라는 말을 너무 쉽게 쓰면 안 됩니다.

- 엔진 내부의 상태 일관성
- sink까지 포함한 end-to-end 결과 일관성
- 애플리케이션 중복 흡수 설계

이 셋은 같은 말이 아닙니다.

좋은 답변은 "엔진이 알아서 해준다"가 아니라  
**상태, 체크포인트, sink semantics, idempotency를 함께 봐야 한다**고 설명하는 편이 더 실무적입니다.

---

## Spark와 Flink를 어떻게 비교할까

두 엔진 모두 배치와 스트림을 함께 다룰 수 있지만, 면접에서는 출발점이 다르다는 점을 말하면 충분합니다.

| **항목** | **Spark** | **Flink** |
| --- | --- | --- |
| 기본 인상 | 분석/배치 경험에서 확장된 엔진 | stateful stream processing 중심 엔진 |
| 강한 지점 | Spark SQL, 배치, ETL, 데이터 생태계 연계 | event time, state, 낮은 지연, 장기 실행 작업 |
| 설명 포인트 | Structured Streaming으로 일관된 분석 모델 제공 | stateful computations와 event-time 처리에 강점 |
| 잘 맞는 경우 | 배치와 스트림을 하나의 분석 스택에서 묶고 싶을 때 | 실시간 상태 처리와 정교한 시간 제어가 중요할 때 |

면접에서 너무 단정적으로 "Spark는 배치, Flink는 스트림"이라고 말하면 약간 거칠 수 있습니다.

더 좋은 설명은 다음입니다.

- **Spark:** 배치/SQL 분석 기반 조직이 스트림까지 확장하기 좋음[^spark-streaming]
- **Flink:** 상태와 시간 개념이 핵심인 실시간 처리에 강한 모델을 제공함[^flink-home][^flink-architecture]

즉, 둘의 차이는 기능 유무보다  
**어떤 처리 모델과 운영 감각을 더 중심에 두는가**에 가깝습니다.

---

## Kafka Consumer로 충분한 경우와 아닌 경우

모든 실시간 처리가 별도 스트림 엔진을 필요로 하지는 않습니다.

Kafka consumer와 애플리케이션 코드만으로 충분한 경우도 많습니다.

### Kafka Consumer로 충분한 경우

- 단순 이벤트 변환
- 외부 API 호출 후 저장
- 비교적 짧은 상태만 필요한 업무 로직
- 파티션 단위 순서와 at-least-once 정도로 충분한 경우

### 별도 스트림 엔진이 더 자연스러운 경우

- 복잡한 window 집계가 필요함
- event time과 late event 처리가 중요함
- 장시간 상태 유지가 필요함
- 여러 스트림 join이나 enrichment가 필요함
- 대규모 재처리와 운영 복구가 잦음

좋은 답변은  
"데이터가 Kafka에 있으니 무조건 Flink를 쓴다"가 아니라,  
**상태, 시간, 재처리, 운영 난이도가 consumer 코드 수준을 넘는지**로 판단하는 편이 좋습니다.

---

## 운영에서 자주 나오는 포인트

- **Backpressure:** 입력 속도를 처리량이 못 따라가면 지연이 계속 누적됩니다.
- **State 크기:** window와 key 수가 커지면 상태 저장 비용이 빠르게 증가합니다.
- **Late Event:** watermark 기준이 짧으면 정확도가 떨어지고, 길면 결과 확정이 늦어집니다.
- **Checkpoint 비용:** 너무 잦으면 성능이 떨어지고, 너무 드물면 복구 비용이 커집니다.
- **Sink 일관성:** DB, object storage, 외부 API로 내보낼 때 중복과 부분 실패를 흡수해야 합니다.

실무형 답변은 엔진 이름보다  
**운영에서 어떤 지표와 실패 모델을 볼 것인가**까지 들어가는 편이 더 강합니다.

배치와 워크플로우 오케스트레이션은 [작업 스케줄링과 워크플로우 (Job Scheduling and Workflows)](job-scheduling-and-workflows.md) 문서와 연결해 설명하면 좋습니다.

---

## 면접 포인트

- **스트림 처리는 이벤트를 계속 읽으면서 시간과 상태를 함께 다루는 계산 모델입니다.**
- **배치와 스트림의 차이는 기술 유행보다 freshness 요구사항과 운영 모델의 차이로 설명하는 편이 좋습니다.**
- **event time, processing time, watermark를 구분할 수 있어야 합니다.**
- **window 집계와 stateful processing이 스트림 엔진 도입 이유인 경우가 많습니다.**
- **Spark와 Flink는 둘 다 배치/스트림을 다루지만, 출발하는 처리 모델과 운영 감각이 다릅니다.**
- **단순 consumer로 충분한지, 별도 스트림 엔진이 필요한지는 상태·시간·재처리 복잡도로 판단하는 편이 안전합니다.**

---

## 참고 자료

[^spark-streaming]: [Apache Spark Docs, "Structured Streaming Programming Guide"](https://spark.apache.org/docs/latest/structured-streaming-programming-guide.html)
[^spark-watermark]: [Apache Spark Docs, "APIs on DataFrames and Datasets"](https://spark.apache.org/docs/latest/streaming/apis-on-dataframes-and-datasets.html)
[^flink-home]: [Apache Flink](https://flink.apache.org/)
[^flink-architecture]: [Apache Flink Docs, "Architecture"](https://flink.apache.org/what-is-flink/flink-architecture/)
