# 메시징 시스템 (Messaging System)

## 목차

- [메시징 시스템이란?](#메시징-시스템이란)
- [메시징 시스템의 종류](#메시징-시스템의-종류)
- [메시징 시스템의 구성 요소](#메시징-시스템의-구성-요소)
- [메시징 시스템의 주요 패턴](#메시징-시스템의-주요-패턴)
- [Kafka와 RabbitMQ](#kafka와-rabbitmq)

  - [Apache Kafka란?](#apache-kafka란)
  - [RabbitMQ란?](#rabbitmq란)
  - [Kafka와 RabbitMQ의 비교](#kafka와-rabbitmq의-비교)
  - [Kafka와 RabbitMQ의 주요 사용 사례](#kafka와-rabbitmq의-주요-사용-사례)
  - [Kafka와 RabbitMQ의 선택 기준](#kafka와-rabbitmq의-선택-기준)
  - [결론](#결론)

- [메시징 시스템의 장점](#메시징-시스템의-장점)
- [메시징 시스템 구현 시 고려사항](#메시징-시스템-구현-시-고려사항)

---

## 메시징 시스템이란?

**메시징 시스템**은 분산 시스템에서 데이터를 교환하기 위한 **비동기 통신 메커니즘**을 제공합니다. 이를 통해 **서비스 간의 의존성을 낮추고**, 대규모 데이터 처리와 트래픽 관리가 가능해집니다.

### 주요 특징:

1. **비동기성**:

   - 메시지 송신자(Sender)가 메시지를 보내면, 수신자(Receiver)가 즉시 응답하지 않아도 됩니다.
   - 메시지는 메시지 브로커(Message Broker)에 저장되어 필요 시 처리됩니다.

2. **분리된 컴포넌트**:

   - 메시징 시스템을 사용하면 송신자와 수신자가 서로 직접 연결되지 않아도 됩니다.
   - 서비스 간 결합도를 낮추어 시스템 확장성과 유연성을 제공합니다.

3. **확장성**:
   - 메시징 시스템은 대량의 데이터를 처리할 수 있도록 확장 가능합니다.

---

## 메시징 시스템의 종류

### 1. **메시지 브로커 기반**

- 메시지를 임시 저장하고 전달하는 역할을 수행.
- 대표 도구: **RabbitMQ**, **ActiveMQ**, **Amazon SQS**.

### 2. **메시지 스트리밍 기반**

- 데이터 스트림을 연속적으로 처리하며, 실시간 데이터 분석에 유리.
- 대표 도구: **Apache Kafka**, **Apache Pulsar**.

---

## 메시징 시스템의 구성 요소

1. **프로듀서 (Producer)**:

   - 메시지를 생성하고 메시징 시스템으로 전송하는 역할을 합니다.

2. **컨슈머 (Consumer)**:

   - 메시지를 읽고 처리하는 역할을 합니다.

3. **메시지 브로커 (Message Broker)**:

   - 메시지를 프로듀서에서 컨슈머로 전달하며, 메시지 저장, 큐잉, 라우팅을 처리합니다.

4. **메시지 큐 (Message Queue)**:

   - 메시지를 임시로 저장하는 버퍼 역할을 하며, 송신자와 수신자 간 속도 차이를 완화합니다.

5. **토픽 (Topic)**:
   - 메시지를 특정 카테고리로 분류하여 다수의 컨슈머가 이를 구독하도록 지원합니다.

---

## 메시징 시스템의 주요 패턴

### 1. **포인트 투 포인트(Point-to-Point)**

- **구조:** 1개의 송신자와 1개의 수신자가 연결됩니다.
- **사용 사례:** 작업 큐(Task Queue), 비동기 작업 처리.

### 2. **퍼블리시/서브스크라이브(Publish/Subscribe)**

- **구조:** 송신자가 메시지를 특정 **토픽(Topic)** 으로 발행하면, 이를 구독(Subscribe)한 모든 수신자가 메시지를 수신합니다.
- **사용 사례:** 알림 시스템, 실시간 데이터 방송.

---

## Kafka와 RabbitMQ

### Apache Kafka란?

**Apache Kafka**는 **분산 메시징 시스템**으로, **실시간 데이터 스트리밍**과 **대규모 데이터 처리**를 목적으로 설계되었습니다. LinkedIn에서 개발되어 Apache Software Foundation에 기부된 오픈 소스 프로젝트입니다.

#### 주요 특징

1. **로그 기반 메시징**:

   - Kafka는 메시지를 토픽(Topic)에 **순차적으로 로그로 저장**하며, 컨슈머는 원하는 오프셋(offset)에서 메시지를 읽을 수 있습니다.
   - 메시지는 디스크에 영구 저장되므로, 데이터 손실이 적고 대량의 데이터를 처리하기에 적합합니다.

2. **분산 아키텍처**:

   - Kafka는 **브로커(Broker)** 와 **파티션(Partition)** 개념을 통해 데이터와 트래픽을 분산 처리합니다.
   - 여러 브로커와 파티션을 통해 **높은 확장성**과 **내구성**을 제공합니다.

3. **퍼블리시/서브스크라이브 모델**:

   - 프로듀서가 메시지를 토픽에 게시하면, 여러 컨슈머 그룹이 해당 메시지를 비동기적으로 처리합니다.

4. **높은 처리량**:
   - Kafka는 초당 수백만 건의 메시지를 처리할 수 있도록 설계되어, 고성능 데이터 스트리밍 애플리케이션에 적합합니다.

#### Kafka의 구성 요소

- **Producer**: 메시지를 Kafka로 전송하는 클라이언트.
- **Broker**: Kafka 서버 역할을 하며, 메시지를 저장하고 분산 처리.
- **Topic**: 메시지가 게시되는 카테고리. 토픽은 여러 파티션으로 나뉨.
- **Consumer**: 토픽의 메시지를 구독하고 처리하는 클라이언트.
- **Zookeeper/Quorum**: 클러스터 설정 및 메타데이터 관리(현재 Kafka Raft Consensus로 대체 중).

---

### RabbitMQ란?

**RabbitMQ**는 메시지 큐(Message Queue) 기반의 **오픈 소스 메시징 시스템**으로, 고성능 메시지 전송과 **신뢰성 높은 작업 처리**를 목표로 합니다. AMQP(Advanced Message Queuing Protocol)를 기반으로 설계되었습니다.

#### 주요 특징

1. **메시지 큐 기반**:

   - RabbitMQ는 메시지를 **큐(queue)** 에 저장하며, 생산자와 소비자 간 비동기 메시징을 지원합니다.

2. **교환기(Exchange)와 라우팅**:

   - 메시지를 큐로 라우팅하기 위해 **Exchange**를 사용하며, 다양한 라우팅 전략(Direct, Fanout, Topic, Headers)을 제공합니다.

3. **경량 메시지 처리**:

   - RabbitMQ는 개별 메시지의 낮은 지연 시간과 높은 신뢰성을 보장하며, 작업 큐(Task Queue) 처리에 최적화되어 있습니다.

4. **확장성**:

   - RabbitMQ는 클러스터링과 페더레이션(Federation)을 통해 확장할 수 있습니다.

5. **다양한 프로토콜 지원**:
   - RabbitMQ는 AMQP 외에도 MQTT, STOMP, HTTP 등을 지원하여 다양한 애플리케이션과 통합 가능합니다.

#### RabbitMQ의 구성 요소

- **Producer**: 메시지를 생성하여 Exchange로 전송.
- **Exchange**: 메시지를 큐로 라우팅. 다양한 라우팅 타입 제공.
- **Queue**: 메시지를 임시 저장하며, 소비자가 처리할 준비를 함.
- **Consumer**: 큐에서 메시지를 읽고 처리.
- **Bindings**: Exchange와 Queue 간 라우팅 규칙.

---

### Kafka와 RabbitMQ의 비교

| **항목**                  | **Apache Kafka**                         | **RabbitMQ**                                    |
| ------------------------- | ---------------------------------------- | ----------------------------------------------- |
| **메시징 모델**           | 로그 기반 메시지 스트리밍                | 큐 기반 메시지 전달                             |
| **사용 사례**             | 대규모 데이터 스트리밍, 실시간 로그 처리 | 작업 큐(Task Queue), 이벤트 알림                |
| **전송 방식**             | Pub/Sub 모델                             | Pub/Sub + Point-to-Point                        |
| **메시지 저장**           | 디스크에 영구 저장 (고내구성)            | 주로 메모리 기반, 필요 시 디스크에 저장         |
| **확장성**                | 브로커, 파티션 기반으로 수평 확장 가능   | 클러스터 기반 확장 (페더레이션으로 복잡도 증가) |
| **성능**                  | 고처리량 (초당 수백만 건 처리 가능)      | 낮은 지연 시간, 단일 메시지 처리에 최적화       |
| **신뢰성**                | 메시지 손실 가능성 낮음                  | "At Least Once"와 "Exactly Once" 보장           |
| **운영 및 설정**          | 설정 복잡, 운영 및 모니터링 도구 필요    | 상대적으로 간단하며 관리가 용이                 |
| **데이터 처리 방식**      | 비동기 데이터 스트리밍                   | 실시간 작업 및 이벤트 중심 메시징               |
| **사용자 인터페이스(UI)** | UI 제공하지 않음 (외부 도구 필요)        | 기본적으로 관리 UI 제공                         |

---

### Kafka와 RabbitMQ의 주요 사용 사례

#### Apache Kafka

1. **실시간 로그 수집 및 처리**
   - 서버 로그, 사용자 행동 로그, 애플리케이션 이벤트를 실시간으로 수집하고 분석.
2. **데이터 스트리밍 및 ETL 파이프라인**
   - 스트리밍 데이터를 처리하여 다른 시스템에 저장하거나 전달.
3. **대규모 트래픽 처리**
   - 초당 수백만 건의 데이터를 처리하는 고성능 애플리케이션.
4. **분산 시스템 이벤트 관리**
   - 분산 환경에서 이벤트를 관리하고 동기화.

#### RabbitMQ

1. **작업 큐(Task Queue)**
   - 데이터 처리 작업을 분산하고 병렬화.
2. **이벤트 기반 메시징**
   - 주문 처리, 알림 전송, 이메일 발송 등 이벤트 중심의 시스템.
3. **실시간 메시지 전달**
   - 낮은 지연 시간으로 중요한 데이터를 빠르게 전달.
4. **IoT 메시징**
   - MQTT를 통한 IoT 장치 통신 및 메시징 처리.

---

### Kafka와 RabbitMQ의 선택 기준

#### Kafka를 선택해야 하는 경우

- **대규모 데이터 스트리밍**이 필요할 때.
- 데이터가 **로그**로 저장되어야 하며, **실시간 분석**이나 **복잡한 데이터 파이프라인**이 필요한 경우.
- 대량의 트래픽을 처리해야 하며, **수평 확장성**이 중요한 경우.

#### RabbitMQ를 선택해야 하는 경우

- **작업 큐**를 기반으로 작업을 분산 처리해야 할 때.
- 낮은 지연 시간과 **신뢰성 있는 메시지 전달**이 요구될 때.
- 단일 메시지 처리가 중요하고, 설정 및 운영이 간단한 시스템이 필요할 때.

---

### 결론

Apache Kafka와 RabbitMQ는 각각 **대규모 데이터 스트리밍**과 **신뢰성 높은 작업 큐**를 처리하기에 최적화된 메시징 시스템입니다. 애플리케이션의 요구사항에 따라 두 시스템 중 하나를 선택하거나, 필요에 따라 **Kafka와 RabbitMQ를 함께 사용하는 하이브리드 아키텍처**도 고려할 수 있습니다.

- Kafka는 **고처리량과 확장성**이 중요한 환경에서 강점을 발휘하며, 실시간 데이터 스트리밍 및 로그 처리에 적합합니다.
- RabbitMQ는 **낮은 지연 시간과 신뢰성**이 필요한 환경에서 유용하며, 작업 큐와 이벤트 중심 메시징 시스템에 적합합니다.

---

## 메시징 시스템의 장점

1. **비동기 작업 처리**:

   - 송신자와 수신자가 동시에 동작하지 않아도 데이터를 처리할 수 있습니다.
   - 트래픽이 많아도 메시지를 큐에 적재하여 순차적으로 처리.

2. **서비스 간 결합도 감소**:

   - 메시징 시스템을 통해 송신자와 수신자가 직접 연결되지 않으므로, 시스템 설계의 유연성이 증가.

3. **확장성 및 분산 처리**:

   - 메시징 시스템은 수평 확장을 지원하여 대규모 트래픽 처리에 적합.

4. **장애 복구 용이**:

   - 메시지 큐를 활용하면, 일시적인 장애 발생 시 메시지를 유실하지 않고 재처리 가능.

5. **실시간 데이터 처리**:
   - 스트리밍 메시징 시스템은 대규모 실시간 데이터를 처리하는 데 유용.

---

## 메시징 시스템 구현 시 고려사항

1. **메시지 전달 보장 수준**:

   - **At-most-once:** 메시지가 한 번만 전달되며, 손실 가능성이 있음.
   - **At-least-once:** 메시지가 최소 한 번은 전달되며, 중복 발생 가능.
   - **Exactly-once:** 메시지가 정확히 한 번만 전달됨.

2. **확장성 요구사항**:

   - 트래픽 증가 시 메시징 시스템이 확장 가능해야 합니다.
   - Kafka는 수평 확장이 뛰어난 반면, RabbitMQ는 관리형 메시지 처리에 적합.

3. **지연 시간 (Latency)**:

   - 실시간 처리가 중요한 애플리케이션에서는 낮은 지연 시간을 제공하는 RabbitMQ가 적합.

4. **데이터 내구성**:

   - 메시지 손실을 방지하려면 디스크 기반 메시지 저장을 사용하는 시스템(Kafka)을 고려.

5. **운영 및 관리**:
   - 메시징 시스템의 운영 복잡성을 최소화하려면 관리형 서비스(AWS SQS, Google Pub/Sub)를 사용할 수 있습니다.

---

## 결론

메시징 시스템은 분산 시스템에서 **데이터 통신의 핵심 역할**을 수행하며, 비동기 처리, 확장성, 결합도 감소 등의 장점을 제공합니다. Apache Kafka와 RabbitMQ는 각각 **스트리밍**과 **메시지 큐잉**의 강점을 가지고 있으며, 애플리케이션 요구사항에 맞는 메시징 시스템을 선택해야 합니다.

이해와 설계가 중요한 만큼, 메시징 시스템의 패턴, 도구 선택, 확장성 계획을 철저히 수립하는 것이 성공적인 MSA 구현의 핵심입니다.
