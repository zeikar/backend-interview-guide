---
title: MongoDB
description: MongoDB의 문서 모델, 인덱스, 운영 특성을 백엔드 면접 관점에서 살펴봅니다.
parent: 데이터베이스
nav_order: 16
---

# MongoDB

## 목차

- [MongoDB란](#mongodb란)
- [MongoDB의 핵심 특징](#mongodb의-핵심-특징)
- [리플리카 셋](#리플리카-셋)
- [샤딩](#샤딩)
- [MongoDB와 MySQL 비교](#mongodb와-mysql-비교)
- [운영 시 주의점](#운영-시-주의점)
- [적합한 사용 사례](#적합한-사용-사례)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## MongoDB란

**MongoDB** 는 문서 지향(document-oriented) 데이터베이스로, 데이터를 BSON 문서 형태로 저장합니다. 관계형 테이블 구조보다 애플리케이션 객체 구조에 더 가깝게 데이터를 다루기 쉽다는 점이 큰 특징입니다.

MongoDB를 설명할 때 핵심은 다음 두 가지입니다.

- **문서 중심 모델:** 한 문서 안에 관련 데이터를 함께 담는 방식이 자연스럽습니다.
- **분산 운영 친화성:** replica set과 sharding을 통해 고가용성과 수평 확장을 지원합니다.[^mongodb-replication][^mongodb-sharding]

---

## MongoDB의 핵심 특징

- **유연한 스키마:** 컬렉션 내 문서 구조가 완전히 동일할 필요는 없습니다. 스키마가 전혀 없는 구조라기보다, 애플리케이션 차원에서 스키마를 관리하는 방식에 가깝습니다.
- **문서 단위 모델링:** 자주 함께 조회되는 데이터를 embedding 형태로 한 문서에 묶는 설계가 잘 맞습니다.
- **단일 문서 원자성:** 한 문서 내부 변경은 원자적으로 처리됩니다.[^mongodb-read-isolation]
- **다양한 읽기/쓰기 보장 조절:** read concern, write concern, read preference 조합에 따라 읽기 일관성과 가용성 특성이 달라집니다.[^mongodb-causal][^mongodb-read-isolation]
- **조인 지원:** MongoDB는 `$lookup`으로 컬렉션 간 조인을 지원합니다. 다만 조인 중심 모델에 최적화된 시스템으로 보기는 어렵습니다.[^mongodb-lookup]

MongoDB의 강점은 관계를 완전히 버리는 것이 아니라, **관계를 자주 조인하기보다 문서 구조로 풀어낼 수 있는 문제에서 강하다**는 점입니다.

---

## 리플리카 셋

**리플리카 셋(Replica Set)** 은 같은 데이터를 유지하는 `mongod` 인스턴스 집합입니다.[^mongodb-replication]

- **Primary:** 기본 쓰기 노드
- **Secondary:** primary의 oplog를 복제하는 노드
- **Arbiter:** 데이터는 저장하지 않고 선거에만 참여하는 노드

리플리카 셋의 목적은 다음과 같습니다.

- **고가용성:** primary 장애 시 새로운 primary를 선출
- **읽기 분산:** secondary 읽기 전략 활용 가능
- **내구성 향상:** 다수 노드 복제를 통한 장애 대응

다만 secondary 읽기를 쓰면 다음을 알아야 합니다.

- replication lag가 있을 수 있습니다.
- read preference와 read concern 조합에 따라 최신성이 달라집니다.[^mongodb-read-isolation]

---

## 샤딩

**샤딩(Sharding)** 은 데이터를 여러 샤드에 분산 저장해 저장 용량과 처리량을 확장하는 구조입니다.[^mongodb-sharding]

MongoDB 샤딩 구성에서 자주 나오는 요소는 다음과 같습니다.

- **Shard:** 실제 데이터가 저장되는 노드 그룹
- **Config Server:** 샤딩 메타데이터 저장
- **Mongos:** 클라이언트 요청 라우팅

샤딩의 핵심은 **샤드 키 선택**입니다.

- **고르게 분산되는가**
- **핵심 조회가 샤드 키를 활용하는가**
- **시간이 지나도 특정 샤드에만 쓰기가 몰리지 않는가**

잘못된 샤드 키는 hot shard를 만들고, 결국 "샤딩했는데도 병목"이라는 상황을 만듭니다.

---

## MongoDB와 MySQL 비교

| **항목** | **MongoDB** | **MySQL** |
| --- | --- | --- |
| 데이터 모델 | 문서 지향 | 관계형 테이블 |
| 강점 | 유연한 모델, 문서 중심 설계, 수평 확장 | 강한 트랜잭션, 조인, 정형 데이터 |
| 확장 방향 | 샤딩 중심 수평 확장 | 읽기 복제본과 파티셔닝, 샤딩은 별도 설계 |
| 일관성 모델 | 설정에 따라 조절 | InnoDB 기반 강한 트랜잭션 보장 |
| 적합한 경우 | 비정형 데이터, 빠른 스키마 변화, 문서 중심 조회 | 관계형 무결성, 복잡한 조인, 금융/주문 |

두 시스템은 모두 배포 구성과 읽기/쓰기 보장 설정에 따라 일관성과 가용성의 균형을 다르게 가져갈 수 있습니다.[^mongodb-causal]

MongoDB를 설명할 때는 다음 흐름이 자연스럽습니다.

- 문서 모델과 수평 확장성이 강점
- 강한 일관성도 일부 설정으로 가져갈 수 있지만 비용이 따른다
- 조인과 다중 문서 트랜잭션이 많아질수록 문서 지향 모델의 장점은 줄어든다

---

## 운영 시 주의점

- **스키마 관리:** 유연하다고 해서 무질서하게 두면 안 됩니다. 애플리케이션 레벨 검증이 중요합니다.
- **문서 크기와 중복:** embedding을 과하게 쓰면 문서가 비대해질 수 있습니다.
- **조인 남용:** `$lookup`은 가능하지만 과도하면 성능이 흔들릴 수 있습니다.[^mongodb-lookup]
- **read/write concern 이해:** 장애 상황에서 어떤 보장을 원하는지 명확해야 합니다.[^mongodb-causal]
- **샤드 키 설계:** 재샤딩 비용이 크기 때문에 초기에 잘 잡아야 합니다.

---

## 적합한 사용 사례

- 콘텐츠, 프로필, 카탈로그처럼 문서 단위 조회가 자연스러운 도메인
- 로그, 이벤트, 반정형 데이터 저장
- 스키마 변화가 잦고 빠른 개발이 중요한 서비스
- 읽기/쓰기 확장을 유연하게 가져가야 하는 시스템

반대로 다음은 MySQL 같은 관계형 모델이 더 자연스러울 수 있습니다.

- 조인이 많고 데이터 무결성이 핵심인 시스템
- 다중 테이블 트랜잭션이 핵심 업무인 도메인

---

## 면접 포인트

- **MongoDB의 핵심은 문서 모델과 분산 운영 친화성입니다.**
- **스키마리스는 스키마가 없다는 뜻이 아니라, DB가 강제하지 않는다는 뜻에 가깝습니다.**
- **`$lookup`으로 조인은 가능하지만, 조인 중심 워크로드에 최적화된 것은 아닙니다.**
- **일관성과 가용성은 replica set 구성과 read/write concern 설정까지 함께 설명하는 편이 좋습니다.**
- **답변에서는 문서 모델, replica set, sharding, read/write concern을 하나의 흐름으로 묶어 설명하면 좋습니다.**

---

## 참고 자료

[^mongodb-replication]: [MongoDB Docs, "Replication"](https://www.mongodb.com/docs/manual/core/replication/)
[^mongodb-sharding]: [MongoDB Docs, "Sharding"](https://www.mongodb.com/docs/manual/sharding/)
[^mongodb-causal]: [MongoDB Docs, "Causal Consistency and Read and Write Concerns"](https://www.mongodb.com/docs/manual/core/causal-consistency-read-write-concerns/)
[^mongodb-read-isolation]: [MongoDB Docs, "Read Isolation, Consistency, and Recency"](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/)
[^mongodb-lookup]: [MongoDB Docs, "$lookup (aggregation stage)"](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/)
