---
title: Kafka (Apache Kafka)
description: Kafka의 파티션, ISR, consumer group, offset commit과 운영 포인트를 백엔드 면접 관점에서 정리했습니다.
parent: 클라우드
nav_order: 18
---

# Kafka (Apache Kafka)

## 목차

- [Kafka를 왜 면접에서 묻는가](#kafka를-왜-면접에서-묻는가)
- [핵심 개념](#핵심-개념)
- [파티션과 Consumer Group의 trade-off](#파티션과-consumer-group의-trade-off)
- [복제와 쓰기 보장](#복제와-쓰기-보장)
- [Producer 관점](#producer-관점)
- [Consumer 관점](#consumer-관점)
- [Delivery Semantics](#delivery-semantics)
- [운영에서 자주 나는 실수](#운영에서-자주-나는-실수)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## Kafka를 왜 면접에서 묻는가

Kafka는 단순한 큐가 아니라, **높은 처리량을 유지하면서 이벤트를 오래 보존하고 재처리까지 고려하는 분산 로그**로 이해하는 편이 맞습니다.[^kafka-design]

면접에서 Kafka를 묻는 이유도 여기에 있습니다.

- **비동기화 감각:** 요청 경로에서 오래 걸리는 일을 분리할 수 있는가
- **확장성 감각:** 파티션과 consumer group으로 수평 확장을 설명할 수 있는가
- **장애 감각:** 중복, 순서, 재시도, 재처리 같은 실패 모델을 아는가
- **운영 감각:** lag, rebalance, ISR, under-replicated partition 같은 상태를 볼 줄 아는가

Kafka를 잘 설명하려면 "메시지를 전달한다"에서 멈추지 말고, **왜 이 시스템이 큐보다 로그에 가깝고, 왜 운영이 어려운지**까지 같이 말해야 합니다.

이 문서는 [메시징 시스템 (Messaging System)](messaging-system.md) 문서의 Kafka 심화 버전입니다. 메시징 패턴의 큰 그림은 그 문서에서 보고, 여기서는 Kafka 자체의 동작과 운영을 더 깊게 봅니다.

---

## 핵심 개념

Kafka 면접은 아래 여섯 개 용어를 정확히 설명할 수 있는지부터 봅니다.

| **개념** | **의미** | **면접에서 확인하는 포인트** |
| --- | --- | --- |
| Topic | 메시지를 논리적으로 묶는 이름 | 어떤 업무 단위를 분리하는가 |
| Partition | Topic을 나눈 물리적 단위 | 병렬 처리와 순서 보장의 경계 |
| Offset | Partition 안에서의 위치 번호 | 어디까지 처리했는가 |
| Broker | Kafka 서버 노드 | 저장과 전달의 책임 주체 |
| Replica | Partition의 복제본 | 장애 시 데이터 유지 방식 |
| Consumer Group | Partition을 나눠 읽는 소비자 집합 | 확장과 중복 처리의 경계 |

Kafka는 topic 전체가 아니라 **partition 단위로 순서와 병렬성이 결정**됩니다.[^kafka-design]

- 같은 partition 안에서는 순서가 유지됩니다.
- 다른 partition 간에는 전역 순서를 기대하면 안 됩니다.
- consumer group 안에서는 partition이 consumer 하나에 배정되므로, partition 수가 병렬성의 상한을 만듭니다.[^kafka-consumer]

즉, Kafka의 핵심은 "어떻게 많이 처리할 것인가"와 "어디까지 순서를 보장할 것인가"의 균형입니다.

---

## 파티션과 Consumer Group의 trade-off

Partition을 늘리면 처리량은 좋아질 수 있지만, 순서 보장 범위와 운영 비용이 함께 바뀝니다.

| **항목** | **Partition 수 증가** | **Consumer 수 증가** | **영향** |
| --- | --- | --- | --- |
| 처리량 | 일반적으로 증가 | partition 수 이하에서는 증가 | 병렬 처리 여지가 커짐 |
| 순서 보장 | 보장 범위가 더 잘게 쪼개짐 | partition 1개당 consumer 1개 원칙 유지 | 전역 순서는 더 멀어짐 |
| 리밸런스 비용 | 증가 가능 | 증가 가능 | group 조정 비용이 늘어남 |
| 운영 복잡도 | 증가 | 증가 | 핫 파티션, 불균형이 생기기 쉬움 |
| 유휴 자원 | 줄어들 수 있음 | partition보다 consumer가 많으면 생김 | consumer가 놀 수 있음 |

면접에서는 다음처럼 설명하면 충분합니다.

- **Partition을 늘리는 이유:** 더 많은 consumer가 병렬로 읽게 하려는 목적
- **Partition을 너무 많이 두면 안 되는 이유:** 메타데이터, 리밸런스, 리더 관리 비용이 늘어남
- **Consumer를 많이 두는 이유:** 처리량을 늘리려는 목적
- **Consumer가 partition보다 많을 때:** 더 많은 consumer가 idle 상태가 됨

실무에서는 key 분포가 중요합니다. 특정 key에 트래픽이 몰리면 partition이 충분히 많아도 한 partition만 뜨거워지는 현상이 생깁니다. 이 경우는 파티션 개수보다 **키 설계와 데이터 편향**을 먼저 봐야 합니다.

---

## 복제와 쓰기 보장

Kafka는 partition마다 leader replica와 follower replica를 둡니다. producer는 보통 leader에 쓰고, follower는 leader를 따라가며 복제본을 맞춥니다.[^kafka-design]

여기서 중요한 개념이 ISR(In-Sync Replicas)입니다.

- **ISR:** leader를 충분히 따라잡은 replica 집합
- **Replica가 ISR에서 빠지는 경우:** 장애가 났거나, 너무 늦게 따라오는 경우
- **복제의 목적:** leader 장애가 나도 커밋된 메시지를 잃지 않기 위함

Kafka의 쓰기 안정성은 `acks`와 `min.insync.replicas`를 같이 봐야 설명이 완성됩니다.[^kafka-producer][^kafka-broker]

| **설정** | **의미** | **면접에서의 해석** |
| --- | --- | --- |
| `acks=0` | 응답을 거의 기다리지 않음 | 가장 빠르지만 손실 가능성이 큼 |
| `acks=1` | leader만 확인하면 성공 | leader 장애 시 손실 가능성이 있음 |
| `acks=all` | ISR 전체 확인을 기다림 | 가장 강한 기본 보장에 가깝다 |
| `min.insync.replicas` | 성공으로 인정할 최소 ISR 수 | `acks=all`과 같이 봐야 의미가 있다 |

실무 답변에서는 "`acks=all`을 쓴다"에서 멈추면 부족합니다.

- replication factor가 너무 낮으면 실패 내성이 약합니다.
- `min.insync.replicas`가 낮으면 `acks=all`의 의미가 약해집니다.
- ISR이 줄어든 상태에서는 가용성과 내구성 사이의 선택이 드러납니다.

Kafka는 이런 균형을 통해 "커밋된 메시지는 잃지 않되, 장애 상황에서는 일부 쓰기를 거부할 수 있다"는 모델을 취합니다.[^kafka-design]

---

## Producer 관점

Producer는 단순히 `send()`를 호출하는 쪽이 아니라, **순서와 중복을 어떻게 다룰지 결정하는 쪽**입니다.

- **`acks`:** 응답을 어디까지 기다릴지 정합니다.
- **`retries`:** 일시적 실패를 재시도할지 결정합니다.
- **`enable.idempotence`:** 중복 전송을 줄이기 위한 설정입니다.
- **`max.in.flight.requests.per.connection`:** 한 연결에서 미확인 요청을 몇 개까지 보낼지 정합니다.

Kafka 공식 문서는 idempotent producer를 쓸 때 `acks=all`, `retries>0`, `max.in.flight.requests.per.connection<=5`가 필요하다고 설명합니다.[^kafka-producer]

| **상황** | **결과** |
| --- | --- |
| `retries`만 켜고 idempotence를 끈다 | 재시도 때문에 중복이나 순서 뒤틀림이 생길 수 있음 |
| `acks=1`로 빠르게 보낸다 | 지연은 줄지만 durability는 약해짐 |
| idempotence를 켠다 | 중복 위험을 줄이지만 설정 제약이 생김 |

Producer에서 자주 하는 실수는 다음입니다.

- 재시도만 켜고 멱등성을 안 맞춤
- 순서가 중요한데 in-flight 요청을 크게 둠
- `acks=1`과 `min.insync.replicas`의 의미를 섞어서 설명함

면접에서는 "빠르게 보내는 설정"과 "안전하게 보내는 설정"을 구분해서 말하면 좋습니다.

---

## Consumer 관점

Consumer는 **어디까지 읽었는지**를 관리하는 쪽입니다. Kafka에서는 이 경계가 offset입니다.[^kafka-consumer]

### Offset commit

오프셋 커밋은 처리 완료 지점을 저장하는 행위입니다. `commitSync()`를 쓸 때는 마지막으로 처리한 레코드의 다음 offset을 저장해야 합니다.[^kafka-consumer]

| **방식** | **장점** | **주의점** |
| --- | --- | --- |
| Auto commit | 구현이 단순함 | 처리 완료 전 커밋될 수 있음 |
| Manual commit | 제어가 명확함 | 코드가 조금 더 복잡함 |

Auto commit은 편하지만, 처리와 커밋이 어긋나기 쉽습니다. 그래서 부수 효과가 있는 작업, 예를 들어 DB write나 외부 API 호출이 섞이면 manual commit을 더 자주 검토합니다.

### Rebalance

Consumer group의 멤버십이 바뀌거나 구독 토픽이 바뀌면 rebalance가 일어납니다.[^kafka-rebalance][^kafka-consumer]

- consumer가 늘거나 줄 때
- partition 수가 바뀔 때
- subscription 대상이 바뀔 때

rebalance는 멈춤 시간과 중복 처리 가능성을 함께 가져오므로, consumer는 항상 idempotent하게 동작하도록 설계하는 편이 안전합니다.

### Lag

Lag은 보통 특정 partition의 end offset과 consumer group이 커밋했거나 현재 따라잡은 offset 사이의 차이로 설명합니다. 모니터링 도구마다 committed offset 기준인지, fetch position 기준인지 표현이 조금 다를 수 있지만, 실무에서는 "소비가 얼마나 뒤처졌는가"를 보는 지표로 이해하면 충분합니다.

- lag이 늘면 backlog가 쌓이고 있다는 뜻입니다.
- lag이 줄지 않으면 처리량이 부족하거나, rebalance 후 복구가 느린 것입니다.
- lag은 consumer health의 핵심 운영 지표입니다.

---

## Delivery Semantics

Kafka를 설명할 때 `at-most-once`, `at-least-once`, `exactly-once`를 구분할 수 있어야 합니다.

| **보장 방식** | **중복** | **손실** | **면접에서의 핵심 설명** |
| --- | --- | --- | --- |
| At-most-once | 적음 | 가능 | 먼저 커밋하거나 재시도 없이 흘린다 |
| At-least-once | 가능 | 적음 | 처리 후 커밋하고 중복은 애플리케이션이 막는다 |
| Exactly-once | 제한적 | 제한적 | 특정 조합에서만 성립하며, 기본 전제가 아니다 |

면접에서는 다음 식으로 말하면 무난합니다.

- **Kafka 브로커 기능만으로 모든 시스템 전체의 exactly-once를 얻는다고 말하면 안 됩니다.**
- **실무에서는 at-least-once를 기본으로 두고, 중복 처리를 애플리케이션에서 흡수하는 경우가 많습니다.**
- **정말 중요한 경로는 idempotency key, unique constraint, transactional outbox 같은 보조 장치와 같이 설계합니다.**

즉, delivery semantics는 "메시지가 한 번만 오느냐"보다, **중복과 손실 중 무엇을 더 견딜지**의 설계 문제로 보는 편이 맞습니다.

---

## 운영에서 자주 나는 실수

- **partition 수를 너무 적게 잡음:** 나중에 consumer를 늘려도 병렬성이 안 나옵니다.
- **핫 파티션을 놓침:** key 분포가 치우치면 일부 partition만 병목이 됩니다.
- **rebalance를 가볍게 봄:** 배포나 장애 때 consumer가 잠깐 멈추고 중복이 늘 수 있습니다.
- **auto commit을 과신함:** 처리 완료 전 offset이 저장되면 유실처럼 보일 수 있습니다.
- **`acks=1`을 기본처럼 씀:** 장애 상황에서 데이터 유실 위험이 커집니다.
- **lag만 보고 원인을 안 봄:** consumer 처리 지연인지, rebalance인지, broker 문제인지 구분해야 합니다.
- **ISR 축소를 무시함:** 클러스터는 살아 있어 보여도 쓰기 안정성은 떨어질 수 있습니다.

운영 관점에서는 "Kafka가 느리다"보다 **어느 지표가 먼저 망가졌는지**를 설명할 수 있어야 합니다.

---

## 면접 포인트

- **Kafka는 큐보다 분산 로그에 가깝고, 재처리와 순서 범위를 같이 설명해야 한다.**
- **partition이 병렬성과 순서의 경계를 결정하므로, partition 수와 consumer group 크기를 함께 봐야 한다.**
- **`acks`, `retries`, `enable.idempotence`, `min.insync.replicas`는 따로가 아니라 한 묶음으로 설명해야 한다.**
- **consumer는 offset commit과 rebalance를 이해하고 있어야 한다.**
- **실무형 답변은 delivery semantics, lag, hot partition, ISR shrink까지 포함한다.**
- **Kafka를 메시징 시스템 일반론으로만 답하면 약하고, 운영·복제·offset까지 들어가야 강해진다.**

---

## 참고 자료

[^kafka-design]: [Apache Kafka Docs, "Design"](https://kafka.apache.org/41/design/design/)
[^kafka-producer]: [Apache Kafka Docs, "Producer Configs"](https://kafka.apache.org/41/configuration/producer-configs/)
[^kafka-consumer]: [Apache Kafka Javadoc, `KafkaConsumer`](https://kafka.apache.org/41/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html)
[^kafka-rebalance]: [Apache Kafka Docs, "Consumer Rebalance Protocol"](https://kafka.apache.org/42/operations/consumer-rebalance-protocol/)
[^kafka-broker]: [Apache Kafka Docs, "Broker Configs"](https://kafka.apache.org/41/configuration/broker-configs/)
