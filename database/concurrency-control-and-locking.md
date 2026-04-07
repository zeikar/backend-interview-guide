---
title: 데이터베이스 동시성 제어와 락 (Concurrency Control and Locking)
description: 동시성 제어, 잠금 전략, 데드락, 중복 방지 패턴을 데이터베이스 면접 관점에서 정리했습니다.
parent: 데이터베이스
nav_order: 16
---

# 데이터베이스 동시성 제어와 락 (Concurrency Control and Locking)

## 목차

- [왜 이 주제를 묻는가](#왜-이-주제를-묻는가)
- [동시성 제어의 기준](#동시성-제어의-기준)
- [낙관적 잠금과 비관적 잠금](#낙관적-잠금과-비관적-잠금)
  - [낙관적 잠금](#낙관적-잠금)
  - [비관적 잠금](#비관적-잠금)
- [Row Lock, Table Lock, Advisory Lock](#row-lock-table-lock-advisory-lock)
- [Locking Read](#locking-read)
- [데드락](#데드락)
- [Unique Constraint로 중복 막기](#unique-constraint로-중복-막기)
- [실무 시나리오](#실무-시나리오)
  - [재고 차감](#재고-차감)
  - [예약과 좌석 배정](#예약과-좌석-배정)
- [락만으로 해결하기 어려운 경우](#락만으로-해결하기-어려운-경우)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 왜 이 주제를 묻는가

동시 요청이 같은 데이터를 동시에 바꾸는 상황은 백엔드 면접에서 자주 나옵니다. 재고 차감, 예약, 포인트 차감, 중복 결제 방지 같은 문제는 단순히 SQL을 잘 쓰는지보다 **무결성을 어떻게 지킬지**를 보려는 질문입니다.

이 문서는 단일 데이터베이스 안에서의 동시성 제어에 초점을 둡니다. 트랜잭션 경계와 격리 수준은 [데이터베이스 트랜잭션과 일관성](transaction.md), 서비스 경계를 넘는 전파는 [분산 데이터 처리](distributed-data-processing.md), 여러 노드의 실패 모델은 [분산 시스템](../system-design/distributed-systems.md) 문서와 같이 보면 좋습니다.

면접관은 보통 다음을 같이 확인합니다.

- 같은 행을 여러 요청이 건드릴 때 어떤 방식으로 충돌을 막는지
- 락을 걸어야 하는지, 버전 비교로 충분한지
- 데드락이 생기면 어떻게 줄이고 어떻게 복구하는지
- 유일성 제약만으로 끝낼 수 있는지, 아니면 별도 락이 필요한지

즉, 핵심은 "락을 많이 거는가"가 아니라 **보호해야 할 불변식(invariant)을 가장 단순한 방법으로 지키는가**입니다.

---

## 동시성 제어의 기준

동시성 제어는 결국 네 가지 질문으로 정리할 수 있습니다.

1. **무엇을 보호해야 하는가**
2. **충돌이 얼마나 자주 나는가**
3. **실패했을 때 다시 시도해도 되는가**
4. **같은 DB 밖의 시스템까지 함께 묶어야 하는가**

좋은 설계는 모든 문제를 락으로 풀지 않습니다. 유일성은 `UNIQUE` 제약으로, 읽기 후 갱신은 행 락으로, 여러 워커의 작업 분산은 큐나 파티션으로 푸는 편이 더 단순할 수 있습니다.

---

## 낙관적 잠금과 비관적 잠금

동시성 제어에서 가장 먼저 비교하는 방식입니다.

| **방식** | **동작 방식** | **장점** | **단점** | **잘 맞는 경우** |
| --- | --- | --- | --- | --- |
| 낙관적 잠금 (Optimistic Locking) | 읽을 때는 잠그지 않고, 쓸 때 버전 비교로 충돌을 감지 | 락 대기가 적고 처리량이 좋다 | 충돌 시 재시도가 필요하다 | 충돌이 드문 조회/수정 |
| 비관적 잠금 (Pessimistic Locking) | 읽거나 수정하기 전에 자원을 잠근다 | 충돌을 미리 막을 수 있다 | 대기와 데드락 비용이 생긴다 | 충돌이 잦고 정합성이 중요한 경우 |

### 낙관적 잠금

낙관적 잠금은 "대부분은 충돌하지 않을 것"이라고 보고 먼저 읽고, 실제 갱신 시점에 충돌 여부를 확인하는 방식입니다. 보통 `version` 컬럼이나 `updated_at` 같은 값을 함께 비교합니다.

```sql
UPDATE stock
SET quantity = quantity - 1,
    version = version + 1
WHERE id = 1001
  AND quantity > 0
  AND version = 7;
```

이 쿼리의 영향을 받은 row 수가 0이면 다른 트랜잭션이 먼저 바꾼 것입니다. 그때는 다시 읽고 재시도하거나, 재고 부족으로 처리합니다.

- **장점:** 락을 오래 잡지 않아도 됩니다.
- **장점:** 충돌이 적으면 처리량이 좋습니다.
- **단점:** 충돌이 많으면 재시도 비용이 커집니다.
- **단점:** 재시도 로직이 없으면 조용히 실패할 수 있습니다.

### 비관적 잠금

비관적 잠금은 읽기 단계부터 자원을 잠가 두고 다른 트랜잭션이 동시에 손대지 못하게 하는 방식입니다. "읽고 나서 생각한 다음 쓰기"를 할 거면, 그 사이에 다른 요청이 값을 바꾸지 못하도록 막아야 합니다.

대표적으로 `SELECT ... FOR UPDATE` 같은 locking read가 여기에 들어갑니다.

- **장점:** 충돌을 미리 차단할 수 있습니다.
- **장점:** 구현 흐름이 단순한 편입니다.
- **단점:** 락 대기와 데드락이 생길 수 있습니다.
- **단점:** 긴 트랜잭션이 되면 병목이 됩니다.

면접에서는 "낙관적은 락이 없고 비관적은 락이 있다"처럼 단순화하기보다, **충돌을 언제 확인하느냐의 차이**로 설명하는 편이 좋습니다.

여기서 MVCC는 별도 축으로 같이 이해하면 좋습니다. MVCC는 읽기와 쓰기 충돌을 줄이기 위한 DB 내부 동시성 제어 메커니즘이고, 낙관적/비관적 잠금은 애플리케이션이 충돌을 어떤 시점에 확인하고 막을지에 더 가깝습니다. 즉, MVCC가 있다고 해서 명시적 락이 완전히 사라지는 것은 아닙니다.

---

## Row Lock, Table Lock, Advisory Lock

락은 범위와 목적이 다릅니다. 같은 "잠금"이라도 어디를 얼마나 오래 잠그는지가 중요합니다.

| **종류** | **범위** | **장점** | **주의점** |
| --- | --- | --- | --- |
| Row Lock | 특정 row | 충돌 범위가 좁다 | 해당 row가 hot spot이 되면 대기가 늘어난다 |
| Table Lock | 전체 테이블 | 단순하고 강력하다 | 병렬성이 크게 떨어진다 |
| Advisory Lock | 애플리케이션이 정한 키 | 비즈니스 단위로 조정하기 좋다 | 같은 키 규칙을 모든 경로가 지켜야 한다 |

### Row Lock

행 단위 잠금은 가장 흔한 방식입니다. `UPDATE`, `DELETE`, `SELECT ... FOR UPDATE` 같은 동작에서 row lock이 걸립니다. 보통 "이 한 건만 안전하게 바꾸고 싶다"는 요구에 맞습니다.

### Table Lock

테이블 전체를 잠그는 방식은 범위가 너무 넓어서 일반적인 요청 경로에는 잘 맞지 않습니다. 대량 정리, 스키마 변경, 배치성 작업처럼 "잠깐 전체를 막아도 되는 상황"에서만 검토하는 편이 좋습니다.

### Advisory Lock

Advisory lock은 DB가 행 자체가 아니라 **애플리케이션이 정한 키**를 기준으로 잠그는 방식입니다. 예를 들어 `user_id + 날짜`, `event_id + seat_no`, `inventory_key`처럼 비즈니스 단위로 자원을 묶고 싶을 때 유용합니다.

PostgreSQL은 트랜잭션 종료 시 자동 해제되는 advisory lock을 제공합니다.[^postgres-explicit-locking]

- **장점:** 행 하나로 표현되지 않는 자원도 잠글 수 있습니다.
- **장점:** 비즈니스 키 기준으로 직관적인 조정이 가능합니다.
- **단점:** 데이터 무결성을 자동으로 보장하지는 않습니다.
- **단점:** 같은 키 생성 규칙을 어기면 서로 다른 락처럼 동작합니다.

Advisory lock은 편하지만 만능은 아닙니다. "이 키를 모두가 동일하게 쓴다"는 전제가 깨지면 바로 허점이 생깁니다.

---

## Locking Read

일반 `SELECT` 는 읽기만 하고, 그 결과를 바탕으로 나중에 `UPDATE` 하더라도 중간에 다른 트랜잭션이 값을 바꿀 수 있습니다. 반면 `SELECT ... FOR UPDATE` 는 읽은 row를 잠가서, 같은 row를 다른 트랜잭션이 수정하거나 삭제하지 못하게 만듭니다.[^postgres-select-for-update][^mysql-locking-reads]

이 패턴은 특히 "읽고 나서 같은 트랜잭션 안에서 다시 쓸 것"이 분명할 때 씁니다.

```sql
BEGIN;

SELECT quantity
FROM stock
WHERE sku = 'A123'
FOR UPDATE;

UPDATE stock
SET quantity = quantity - 1
WHERE sku = 'A123';

COMMIT;
```

- **장점:** 읽기와 쓰기 사이의 경쟁 조건을 줄입니다.
- **장점:** 재고 차감처럼 순서가 중요한 작업에 잘 맞습니다.
- **단점:** 락을 오래 잡으면 throughput이 떨어집니다.
- **단점:** 필요 이상으로 넓은 조건을 잠그면 불필요한 대기가 생깁니다.

MySQL 문서도 "읽고 나서 관련 데이터를 수정할 거면 일반 `SELECT` 만으로는 충분하지 않다"고 설명합니다.[^mysql-locking-reads] PostgreSQL도 `SELECT FOR UPDATE` 가 row-level lock을 획득하며, 다른 트랜잭션의 수정과 충돌할 수 있다고 설명합니다.[^postgres-explicit-locking]

`NOWAIT` 나 `SKIP LOCKED` 는 대기 대신 실패하거나 다른 row로 넘어가게 만들 때 유용하지만, 무조건 붙이면 되는 옵션은 아닙니다. 워커 큐나 배치 처리처럼 "대기보다 넘김이 더 나은" 경우에만 검토하는 편이 좋습니다.

특히 MySQL InnoDB는 격리 수준과 조건에 따라 gap lock이나 next-key lock이 함께 걸릴 수 있습니다. 이 경우 특정 row만 잠근다고 생각했는데, 실제로는 **범위 안의 새 insert까지 막히는 상황**이 생길 수 있습니다. MySQL 면접에서는 이 차이를 한 줄이라도 알고 있다고 말하면 깊이가 더 좋아집니다.

---

## 데드락

데드락은 두 트랜잭션이 서로의 락을 기다리면서 아무도 진행하지 못하는 상태입니다. 보통 여러 row나 여러 테이블을 서로 다른 순서로 잠글 때 생깁니다.

예를 들어:

1. 트랜잭션 A가 `stock` row를 잠금
2. 트랜잭션 B가 `order` row를 잠금
3. A가 `order` row를 기다림
4. B가 `stock` row를 기다림

이렇게 되면 서로 끝나지 않습니다. PostgreSQL과 InnoDB 모두 데드락을 감지하고, 한 트랜잭션을 롤백해서 상황을 풀어 줍니다.[^postgres-deadlock][^mysql-deadlocks]

데드락을 줄이는 방법은 다음이 기본입니다.

- **락 순서를 통일한다:** 항상 같은 순서로 row와 테이블을 잠근다
- **트랜잭션을 짧게 유지한다:** 외부 API 호출, 사용자 입력 대기, 긴 계산을 트랜잭션 안에 두지 않는다
- **한 번에 필요한 자원만 잠근다:** 조건을 넓게 잡아서 불필요한 row까지 잠그지 않는다
- **실패 시 재시도한다:** 데드락은 비정상 종료가 아니라 복구 가능한 실패로 다룬다

실무에서는 "데드락을 완전히 없앤다"보다 **발생 가능성을 줄이고, 생기면 안전하게 재시도한다**가 더 현실적입니다.

---

## Unique Constraint로 중복 막기

모든 중복을 락으로 막을 필요는 없습니다. 어떤 경우에는 `UNIQUE` 제약이 더 단순하고 더 안전합니다.

예를 들어 같은 예약이 두 번 들어오면 안 되는 경우는 `UNIQUE(user_id, event_id)` 또는 `UNIQUE(request_id)` 만으로도 충분할 수 있습니다.

```sql
CREATE TABLE reservations (
  id BIGINT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL UNIQUE,
  event_id BIGINT NOT NULL,
  seat_no VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  UNIQUE (event_id, seat_no)
);
```

- **장점:** DB가 중복을 원자적으로 막아 줍니다.
- **장점:** "읽고 확인한 뒤 넣기"보다 경합이 적습니다.
- **단점:** 유일성으로 표현되지 않는 비즈니스 규칙은 막지 못합니다.
- **단점:** 충돌 시 애플리케이션이 예외를 해석해야 합니다.

중요한 포인트는, **먼저 조회해서 없으면 insert** 하는 패턴보다 `UNIQUE` 제약을 믿는 편이 더 안전한 경우가 많다는 점입니다. 조회와 삽입 사이에 다른 요청이 들어오면 경쟁 조건이 생기기 때문입니다.

---

## 실무 시나리오

면접에서는 추상 개념보다 실제 사례로 설명하면 답변이 강해집니다.

### 재고 차감

재고는 대표적인 경합 대상입니다. 같은 상품을 여러 요청이 동시에 차감하면 음수가 되거나 초과 판매가 생길 수 있습니다.

재고가 자주 충돌하지 않으면 낙관적 잠금으로 시작할 수 있습니다. 충돌이 많으면 `SELECT ... FOR UPDATE` 로 row를 잠그고 차감하는 편이 안전합니다.

```sql
BEGIN;

SELECT quantity
FROM stock
WHERE sku = 'A123'
FOR UPDATE;

UPDATE stock
SET quantity = quantity - 1
WHERE sku = 'A123'
  AND quantity > 0;

COMMIT;
```

실무에서는 다음을 같이 봅니다.

- **hot SKU** 는 충돌이 많아서 낙관적 재시도가 비효율적일 수 있음
- **배치 차감** 은 한 번에 여러 row를 잠그므로 락 순서가 중요함
- **외부 결제와 분리** 해야 하면 DB 락만으로 끝나지 않음

### 예약과 좌석 배정

예약은 "같은 자원을 두 번 차지하면 안 된다"는 문제입니다. 좌석 번호처럼 명확한 식별자가 있으면 `UNIQUE(event_id, seat_no)` 가 가장 단순합니다.

한편 "남은 좌석 수"처럼 카운터 기반이면 row lock으로 남은 수량을 하나의 행에서 관리하는 편이 이해하기 쉽습니다.

| **상황** | **우선 검토할 방식** | **이유** |
| --- | --- | --- |
| 동일 좌석 중복 방지 | `UNIQUE(event_id, seat_no)` | DB가 중복 삽입을 직접 막는다 |
| 남은 수량 차감 | Row Lock + 조건부 UPDATE | 카운터 갱신을 한 행에 모을 수 있다 |
| 자원 단위 동시성 제어 | Advisory Lock | 행으로 표현되지 않는 비즈니스 키를 잠글 수 있다 |

예약과 결제처럼 외부 시스템이 끼는 경우에는 락을 길게 잡지 않는 쪽이 보통 낫습니다. 이 경계는 [분산 데이터 처리](distributed-data-processing.md)에서 다루는 전파와 멱등성, 그리고 [분산 시스템](../system-design/distributed-systems.md)에서 다루는 실패 모델과 이어집니다.

---

## 락만으로 해결하기 어려운 경우

DB 락은 강력하지만 범위가 한정돼 있습니다.

- **외부 API 호출은 보호하지 못함:** 결제, 메일, 검색 인덱스, 캐시 갱신은 DB 밖에서 다시 중복될 수 있습니다.
- **락이 길어지면 병목이 됨:** 긴 트랜잭션은 대기열을 키우고 throughput을 떨어뜨립니다.
- **분산 환경 전체를 묶지 못함:** DB 락은 한 데이터베이스 안에서만 유효합니다.
- **모든 규칙이 row로 표현되지는 않음:** 어떤 불변식은 `UNIQUE` 나 별도 워커 큐가 더 적합합니다.

그래서 락은 "문제의 일부"를 푸는 도구로 보는 편이 맞습니다. 트랜잭션으로 묶을 수 없는 외부 효과가 있으면, 멱등성이나 Outbox 같은 패턴을 함께 봐야 합니다. 이 부분은 [트랜잭션 처리 및 일관성](transaction.md)과 [분산 데이터 처리](distributed-data-processing.md) 문서에서 이어서 설명합니다.

---

## 면접 포인트

- **동시성 제어는 최대한 많이 잠그는 문제가 아니라, 어떤 불변식을 지킬지 정하는 문제입니다.**
- **낙관적 잠금은 충돌이 적을 때, 비관적 잠금은 충돌이 잦고 정합성이 중요할 때 잘 맞습니다.**
- **`SELECT ... FOR UPDATE` 는 읽은 뒤 바로 쓸 row를 보호할 때 자주 쓰입니다.**
- **데드락은 이상한 버그가 아니라, 여러 락을 다루는 시스템에서 자연스럽게 생길 수 있는 현상입니다.**
- **`UNIQUE` 제약은 중복 방지에서 생각보다 강력하고, 종종 락보다 단순합니다.**
- **DB 락은 외부 시스템까지 보호하지 못하므로, 분산 경계를 넘는 순간 다른 패턴이 필요합니다.**

---

## 참고 자료

[^postgres-explicit-locking]: PostgreSQL Docs, "Explicit Locking" - https://www.postgresql.org/docs/current/explicit-locking.html
[^postgres-select-for-update]: PostgreSQL Docs, "SELECT" - https://www.postgresql.org/docs/current/sql-select.html
[^postgres-deadlock]: PostgreSQL Docs, "Explicit Locking - Deadlocks" - https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS
[^mysql-locking-reads]: MySQL 8.4 Reference Manual, "Locking Reads" - https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html
[^mysql-deadlocks]: MySQL 8.4 Reference Manual, "Deadlocks in InnoDB" - https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks.html
