---
title: PostgreSQL / MySQL
description: PostgreSQL과 MySQL의 차이, 강점, 운영 관점의 선택 포인트를 비교해 정리했습니다.
parent: 데이터베이스
nav_order: 7
---

# PostgreSQL / MySQL

## 목차

- [PostgreSQL과 MySQL을 왜 같이 묻는가](#postgresql과-mysql을-왜-같이-묻는가)
- [공통점과 큰 차이](#공통점과-큰-차이)
- [MVCC와 트랜잭션 특성](#mvcc와-트랜잭션-특성)
- [인덱스와 실행 계획 관점의 차이](#인덱스와-실행-계획-관점의-차이)
- [JSON, 확장성, 기능 활용](#json-확장성-기능-활용)
- [복제와 장애 전환](#복제와-장애-전환)
- [운영 시 자주 보는 지표](#운영-시-자주-보는-지표)
- [실무에서 자주 나오는 설계 포인트](#실무에서-자주-나오는-설계-포인트)
- [언제 무엇이 더 잘 맞는가](#언제-무엇이-더-잘-맞는가)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## PostgreSQL과 MySQL을 왜 같이 묻는가

백엔드 면접에서 PostgreSQL과 MySQL은  
둘 중 무엇이 더 좋으냐를 고르는 문제라기보다, **같은 관계형 데이터베이스라도 운영 특성과 강점이 다르다는 점을 설명할 수 있는가**를 보는 질문에 가깝습니다.

보통 다음 흐름으로 이어집니다.

- 트랜잭션과 MVCC 구현 차이는 무엇인가
- 실행 계획과 인덱스 활용에서 어떤 특성이 있는가
- JSON, 확장 기능, 복제 운영은 어떻게 다른가
- 우리 서비스에는 어느 쪽이 더 자연스러운가

이 문서는 **엔진 선택론보다 구현·운영 관점**에 집중합니다.  
관계형 모델과 SQL의 기본은 [RDBMS와 SQL](sql-and-rdbms.md), 스키마 설계는 [데이터 모델링](data-modeling.md), 성능 튜닝은 [데이터베이스 최적화](optimization.md) 문서와 연결해서 보면 좋습니다.

---

## 공통점과 큰 차이

둘 다 대표적인 관계형 데이터베이스이고, 트랜잭션, 인덱스, 복제, 실행 계획, 제약 조건 같은 핵심 기능을 제공합니다.

하지만 실무에서 느껴지는 차이는 꽤 분명합니다.

| **항목** | **PostgreSQL** | **MySQL** |
| --- | --- | --- |
| 기본 인상 | 표준 SQL과 확장성, 기능 폭이 강한 편 | 운영 생태계와 보급성이 매우 넓고 단순한 워크로드에 익숙한 편 |
| 엔진 구조 | 하나의 엔진 위에 기능이 일관되게 붙는 느낌 | 스토리지 엔진과 운영 방식의 역사적 맥락이 큼 |
| 강점 | 고급 SQL, 확장 기능, JSONB, partial index, 풍부한 타입 | 넓은 사용층, 단순 운영 경험, InnoDB 중심의 안정적 일반 워크로드 |
| 주의점 | 기능이 많은 만큼 운영 옵션 이해가 필요 | 엔진/버전별 차이와 설정 영향을 같이 봐야 함 |

좋은 답변은 "PostgreSQL이 더 강력하다" 또는 "MySQL이 더 쉽다" 같은 단정으로 끝나지 않습니다.  
**업무 요구와 운영 팀의 익숙함, 사용 기능, 확장 전략**까지 같이 설명해야 답변이 단단해집니다.

---

## MVCC와 트랜잭션 특성

둘 다 MVCC를 사용하지만, 구현 디테일과 운영 포인트는 다릅니다.[^postgres-transaction-iso][^mysql-transaction-iso]

### PostgreSQL

PostgreSQL은 MVCC를 매우 강하게 활용하는 편입니다.

- 읽기와 쓰기 충돌을 줄이는 데 유리합니다.
- `VACUUM`과 autovacuum 운영이 중요합니다.
- 장기 트랜잭션이 쌓이면 dead tuple 정리와 저장 공간 관리에 영향을 줄 수 있습니다.

### MySQL (InnoDB)

MySQL은 실무에서 보통 InnoDB를 기준으로 설명합니다.

- InnoDB도 MVCC와 락을 함께 사용합니다.
- 기본 격리 수준이 `Repeatable Read`라서, PostgreSQL의 기본 `Read Committed`와 감각이 다를 수 있습니다.
- gap lock, next-key lock 같은 락 동작을 함께 이해하는 편이 좋습니다.[^mysql-innodb-locking]

| **항목** | **PostgreSQL** | **MySQL InnoDB** |
| --- | --- | --- |
| 기본 격리 수준 | Read Committed | Repeatable Read |
| 운영 포인트 | autovacuum, long-running transaction | undo/redo, lock behavior, transaction isolation 차이 |
| 면접 포인트 | MVCC와 vacuum 영향 설명 | MVCC + 락 조합과 gap lock 설명 |

즉, 둘 다 "트랜잭션이 된다"로 끝나지 않고,  
**운영 중에는 MVCC 유지 비용과 락 특성이 성능과 장애 양상에 영향을 준다**는 점까지 같이 말하는 편이 좋습니다.

트랜잭션 일반론은 [트랜잭션 처리 및 일관성](transaction.md) 문서와 직접 연결됩니다.

---

## 인덱스와 실행 계획 관점의 차이

둘 다 `EXPLAIN`을 통해 실행 계획을 볼 수 있지만, 자주 다루는 포인트는 약간 다릅니다.

### PostgreSQL

- partial index, expression index 같은 유연한 인덱스 설계가 강점입니다.[^postgres-partial-index]
- 실행 계획과 통계 정보, 비용 추정 모델을 함께 읽는 습관이 중요합니다.
- 범용 기능이 많아서, SQL과 인덱스 설계를 더 세밀하게 다룰 수 있습니다.

### MySQL

- B-Tree 인덱스와 leftmost prefix 같은 기본 원칙이 매우 중요합니다.
- 단순 조회 패턴에서는 예측 가능한 동작을 기대하기 쉬운 편입니다.
- 버전과 설정에 따라 실행 계획 특성 차이를 같이 봐야 합니다.

면접에서 자주 나오는 운영 포인트는 다음과 같습니다.

- soft delete가 많은 테이블에서 unique를 어떻게 유지할 것인가
- UUID를 PK로 쓸 때 인덱스 locality가 어떻게 달라지는가
- `status`, `deleted_at`, `created_at`가 같이 들어가는 인덱스는 어떻게 잡을 것인가

예를 들어 PostgreSQL에서는 다음처럼 partial unique index를 검토할 수 있습니다.

```sql
CREATE UNIQUE INDEX uniq_users_email_active
ON users (email)
WHERE deleted_at IS NULL;
```

이런 패턴은 PostgreSQL에서 특히 자연스럽지만, MySQL에서는 같은 요구를 다른 스키마/컬럼 전략으로 풀어야 할 수 있습니다.

즉, 엔진별 차이를 말할 때는 "무슨 기능이 있다"보다  
**같은 문제를 어떤 인덱스 전략으로 푸는가**로 연결하는 편이 좋습니다.

실행 계획과 인덱스 일반론은 [데이터베이스 최적화](optimization.md), [RDBMS와 SQL](sql-and-rdbms.md) 문서와 같이 보면 좋습니다.

---

## JSON, 확장성, 기능 활용

이 축도 둘의 차이를 설명할 때 자주 쓰입니다.

### PostgreSQL

- `JSONB`와 관련 함수/인덱싱이 강력합니다.[^postgres-json]
- 배열, range type, CTE, window function, extension 생태계 등 "기능의 폭"이 넓다는 인상이 강합니다.
- 관계형 모델을 유지하면서 일부 반정형 데이터를 같이 다루기 좋습니다.

### MySQL

- JSON 타입과 함수도 지원하지만, 보통은 더 전통적인 관계형 운영 감각으로 많이 접근합니다.[^mysql-json]
- 널리 쓰이는 운영 패턴이 많고, 비교적 익숙한 워크로드에서 안정적으로 운영하는 사례가 많습니다.

좋은 답변은 JSON 지원 여부만 말하지 않습니다.

- 문서형 요구가 일부 섞였을 때 PostgreSQL의 JSONB를 활용할 수 있음
- 하지만 조인과 제약이 많은 핵심 모델은 여전히 관계형으로 두는 편이 자연스러움
- JSON을 쓴다고 해서 모델링 문제 자체가 사라지는 것은 아님

즉, JSON은 "NoSQL 대체"가 아니라  
**관계형 모델 안에서 반정형 데이터를 어디까지 흡수할지**에 대한 선택으로 설명하는 편이 좋습니다.

---

## 복제와 장애 전환

둘 다 읽기 복제본과 장애 전환 구성이 가능합니다.[^postgres-replication][^mysql-replication]

핵심은 다음입니다.

- 읽기 확장과 쓰기 확장은 분리해서 봐야 합니다.
- 비동기 복제는 replication lag를 동반할 수 있습니다.
- 장애 전환 시 애플리케이션 라우팅, 재동기화, read/write split 전략을 같이 준비해야 합니다.

### PostgreSQL

- streaming replication, physical/logical replication 개념을 같이 이해하면 좋습니다.
- replica lag, replication slot, failover orchestration을 운영 포인트로 볼 수 있습니다.

### MySQL

- binlog 기반 복제와 GTID 기반 운영을 자주 같이 설명합니다.
- primary 장애 전환 시 복제 상태와 promotion 전략을 같이 봐야 합니다.

면접에서는 "복제본을 둡니다"보다  
**lag가 생기면 어떤 요청은 primary로 보내고, failover 때 무엇이 바뀌는지**까지 말하는 편이 좋습니다.

읽기 확장과 replica lag는 [데이터베이스 스케일링](scaling.md) 문서와도 직접 연결됩니다.

---

## 운영 시 자주 보는 지표

운영 관점 답변은 보통 여기서 차이가 드러납니다.

공통적으로 자주 보는 지표는 다음과 같습니다.

- QPS / TPS
- p95, p99 latency
- replication lag
- lock wait
- deadlock
- slow query
- buffer/cache hit ratio
- active connection 수
- disk I/O, WAL/binlog 증가율

### PostgreSQL에서 자주 보는 포인트

- autovacuum이 따라가고 있는가
- dead tuple이 과도하게 쌓이지 않는가
- long-running transaction이 vacuum을 막고 있지 않은가
- WAL 증가량과 replica lag가 이상하지 않은가

### MySQL에서 자주 보는 포인트

- InnoDB buffer pool hit ratio
- row lock wait
- redo/binlog 증가와 flush 패턴
- replica lag와 복제 thread 상태

면접에서는 "모니터링합니다"보다  
**어떤 병목을 보기 위해 어떤 지표를 먼저 볼지**를 연결해서 설명하는 편이 좋습니다.

---

## 실무에서 자주 나오는 설계 포인트

### UUID vs BIGINT

- **BIGINT:** 비교적 작고 locality가 좋아 인덱스 친화적인 경우가 많음
- **UUID:** 분산 생성이 쉽고 외부 노출에 유리할 수 있지만, 인덱스 locality와 저장 비용을 같이 봐야 함

정답은 없지만, 핵심 hot table의 PK는 BIGINT를 유지하고 외부 노출용 식별자를 별도로 두는 전략도 많이 씁니다.

### soft delete + unique

- PostgreSQL은 partial unique index로 풀기 좋은 경우가 많습니다.
- MySQL은 generated column, 별도 상태 컬럼 조합, 애플리케이션 제약 등 우회 전략을 더 자주 고민하게 됩니다.

### partial index

- PostgreSQL에서는 매우 유용한 실무 도구입니다.
- MySQL에서는 같은 요구를 다른 방식으로 모델링하거나 인덱스 설계를 조정해야 할 수 있습니다.

즉, 이 문서의 핵심은 기능 소개가 아니라  
**엔진 차이가 실제 스키마 설계와 운영 비용에 어떻게 번역되는가**입니다.

---

## 언제 무엇이 더 잘 맞는가

### PostgreSQL이 더 자연스러운 경우

- 고급 SQL과 분석 쿼리를 많이 활용함
- partial index, JSONB, expression index 같은 기능이 실무적으로 중요함
- 관계형 모델을 유지하면서도 유연한 기능 확장이 필요함

### MySQL이 더 자연스러운 경우

- 팀이 MySQL/InnoDB 운영 경험이 풍부함
- 전형적인 OLTP 패턴과 단순한 조회/쓰기 워크로드가 중심임
- 생태계와 운영 경험치를 더 중시함

좋은 답변은 특정 엔진을 절대화하지 않습니다.

- 엔진 기능
- 운영 팀의 숙련도
- ORM/프레임워크 생태계
- 현재와 미래의 데이터 접근 패턴

이 네 가지를 같이 설명하면 설득력이 높아집니다.

---

## 면접 포인트

- **PostgreSQL과 MySQL은 둘 다 관계형 DB지만, MVCC 구현 감각과 운영 포인트가 다릅니다.**
- **PostgreSQL은 확장 기능과 유연한 인덱스 전략이 강하고, MySQL은 넓은 보급성과 익숙한 OLTP 운영 경험이 강점인 경우가 많습니다.**
- **엔진 비교는 취향이 아니라 실행 계획, 인덱스, 복제, 장애 전환, 운영 지표 차이로 설명하는 편이 좋습니다.**
- **UUID / BIGINT, soft delete + unique, partial index 같은 실제 설계 문제로 연결하면 답변이 훨씬 실무적으로 들립니다.**
- **좋은 답변은 어느 쪽이 우월하다고 단정하지 않고, 팀과 워크로드에 따라 선택 기준을 설명합니다.**

---

## 참고 자료

[^postgres-transaction-iso]: [PostgreSQL Docs, "Transaction Isolation"](https://www.postgresql.org/docs/current/transaction-iso.html)
[^mysql-transaction-iso]: [MySQL Docs, "Transaction Isolation Levels"](https://dev.mysql.com/doc/refman/en/innodb-transaction-isolation-levels.html)
[^mysql-innodb-locking]: [MySQL Docs, "InnoDB Locking"](https://dev.mysql.com/doc/refman/en/innodb-locking.html)
[^postgres-partial-index]: [PostgreSQL Docs, "Partial Indexes"](https://www.postgresql.org/docs/current/indexes-partial.html)
[^postgres-json]: [PostgreSQL Docs, "JSON Types"](https://www.postgresql.org/docs/current/datatype-json.html)
[^mysql-json]: [MySQL Docs, "The JSON Data Type"](https://dev.mysql.com/doc/refman/en/json.html)
[^postgres-replication]: [PostgreSQL Docs, "Log-Shipping Standby Servers"](https://www.postgresql.org/docs/current/warm-standby.html)
[^mysql-replication]: [MySQL Docs, "Replication"](https://dev.mysql.com/doc/refman/en/replication.html)
