---
title: Redis
description: Redis 자료구조, 활용 패턴, persistence와 운영 시 주의점을 살펴봅니다.
parent: 데이터베이스
nav_order: 13
---

# Redis

## 목차

- [Redis란](#redis란)
- [Redis의 핵심 특징](#redis의-핵심-특징)
- [대표 데이터 구조와 사용처](#대표-데이터-구조와-사용처)
- [고가용성과 확장](#고가용성과-확장)
- [트랜잭션과 원자성](#트랜잭션과-원자성)
- [Redis를 사용할 때 주의할 점](#redis를-사용할-때-주의할-점)
- [대표 사용 사례](#대표-사용-사례)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## Redis란

**Redis** 는 인메모리 데이터 구조 저장소입니다. 단순 키-값 저장소라기보다, 문자열, 해시, 리스트, 셋, 정렬된 셋, 스트림 같은 다양한 자료구조를 제공하는 것이 큰 특징입니다.[^redis-data-types]

Redis를 설명할 때 핵심은 다음 세 가지입니다.

- **메모리 기반이라 빠르다**
- **자료구조가 다양하다**
- **캐시 외에도 큐, 세션, 집계, 실시간 기능에 널리 쓰인다**

---

## Redis의 핵심 특징

- **인메모리 저장:** 디스크 기반 DB보다 지연 시간이 낮은 편입니다.
- **다양한 자료구조:** 단순 캐시를 넘어 리더보드, 집계, 큐 같은 패턴을 직접 구현하기 좋습니다.[^redis-data-types]
- **영속성 옵션:** RDB 스냅샷과 AOF를 통해 재시작 후 복구 전략을 가져갈 수 있습니다.
- **간단한 운영 모델:** 단일 인스턴스부터 replica, Sentinel, Cluster까지 확장할 수 있습니다.[^redis-replication][^redis-sentinel]
- **원자적 명령:** 개별 명령은 원자적으로 실행됩니다.

Redis는 "빠른 캐시"로만 소개하기보다, 자료구조 중심으로 다양한 문제를 풀 수 있는 저장소라는 점까지 같이 설명하는 편이 좋습니다.

---

## 대표 데이터 구조와 사용처

| **자료구조** | **용도 예시** |
| --- | --- |
| String | 캐시, 카운터, 간단한 상태값 |
| Hash | 사용자 프로필, 속성 묶음 |
| List | 간단한 큐, 작업 대기열 |
| Set | 중복 제거, 태그, 집합 연산 |
| Sorted Set | 리더보드, 순위, score 기반 정렬 |
| Stream | 이벤트 스트림, 소비 그룹 기반 처리 |
| Bitmap / HyperLogLog | 비트 연산, 근사 집계 |

특히 면접에서 자주 나오는 예시는 다음입니다.

- **String:** 조회 결과 캐시
- **Sorted Set:** 게임 랭킹
- **Set:** 중복 사용자 추적
- **Stream:** 이벤트 파이프라인이나 소비자 그룹 처리[^redis-streams]

---

## 고가용성과 확장

Redis는 기본적으로 primary-replica 복제를 지원합니다.[^redis-replication]

- **Primary:** 쓰기 처리
- **Replica:** 복제본 읽기나 장애 대비

고가용성을 위해서는 Sentinel을 사용할 수 있습니다.[^redis-sentinel]

- master/replica 모니터링
- 장애 감지
- 자동 failover
- 클라이언트에 현재 primary 정보 제공

더 큰 규모에서는 Redis Cluster로 샤딩 기반 확장을 할 수 있습니다.

다만 중요한 제약도 있습니다.

- Redis 복제는 비동기이므로 장애 순간의 acknowledged write가 모두 보존된다고 보장할 수는 없습니다.[^redis-sentinel]
- 즉, 고가용성과 데이터 보존 보장은 분리해서 생각해야 합니다.

---

## 트랜잭션과 원자성

Redis는 `MULTI` / `EXEC`를 통해 여러 명령을 하나의 실행 단위처럼 다룰 수 있습니다.[^redis-transactions]

하지만 관계형 DB 트랜잭션과는 차이가 있습니다.

- **개별 명령은 원자적**
- **여러 명령을 큐잉 후 순서대로 실행 가능**
- **실패 시 자동 rollback은 없음**

그래서 Redis 트랜잭션은 다음처럼 설명하는 편이 자연스럽습니다.

- "일괄 실행은 가능하지만, RDBMS처럼 rollback이 있는 ACID 트랜잭션은 아니다"

복잡한 원자 작업은 Lua 스크립트로 해결하는 경우도 많습니다.

---

## Redis를 사용할 때 주의할 점

- **메모리 한계:** 데이터가 전부 메모리에 올라가므로 메모리 비용이 크고 eviction 정책이 중요합니다.
- **캐시 정합성:** 원본 DB와 캐시 간 무효화 전략을 잘못 잡으면 stale data가 생깁니다.
- **큰 키 문제:** 큰 hash, list, set 하나가 성능 병목이 될 수 있습니다.
- **긴 명령 주의:** 무거운 연산은 단일 스레드 처리 지연을 키울 수 있습니다.
- **영속성 트레이드오프:** AOF, RDB 설정에 따라 성능과 데이터 보존 수준이 달라집니다.
- **메시지 시스템 대체 한계:** Pub/Sub나 Stream은 유용하지만, Kafka나 RabbitMQ와 완전히 같은 역할로 일반화하면 위험합니다.

---

## 대표 사용 사례

- 캐시 계층
- 세션 저장소
- 분산 락
- 리더보드
- 실시간 집계
- 간단한 큐와 이벤트 처리

실무에서는 Redis를 메인 DB로 쓰기보다, **느린 저장소 앞단의 가속 계층** 또는 **고속 상태 저장소**로 두는 경우가 많습니다.

---

## 면접 포인트

- **Redis는 인메모리 캐시이면서도 다양한 자료구조를 제공하는 저장소로 함께 설명하는 편이 좋습니다.**
- **개별 명령의 원자성과 RDBMS 트랜잭션은 구분해서 말해야 합니다.**
- **Sentinel은 고가용성, Cluster는 샤딩 확장이라는 역할 차이를 설명할 수 있어야 합니다.**
- **비동기 복제라서 failover 순간 write 유실 가능성이 있다는 점도 알고 있어야 합니다.**
- **String, Hash, Sorted Set, Stream 같은 자료구조별 사용 사례를 바로 연결해서 말하면 답변이 강해집니다.**

---

## 참고 자료

[^redis-data-types]: Redis Docs, "Redis data types" - https://redis.io/docs/latest/develop/data-types/
[^redis-streams]: Redis Docs, "Redis Streams" - https://redis.io/docs/latest/develop/data-types/streams/
[^redis-transactions]: Redis Docs, "Transactions" - https://redis.io/docs/latest/develop/using-commands/transactions/
[^redis-replication]: Redis Docs, "Redis replication" - https://redis.io/docs/latest/operate/oss_and_stack/management/replication/
[^redis-sentinel]: Redis Docs, "High availability with Redis Sentinel" - https://redis.io/docs/latest/operate/oss_and_stack/management/sentinel/
