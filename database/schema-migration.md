---
title: 스키마 마이그레이션 (Schema Migration)
description: 스키마 마이그레이션 절차, 무중단 변경, 롤백 전략에서 핵심이 되는 포인트를 정리했습니다.
parent: 데이터베이스
nav_order: 2
---

# 스키마 마이그레이션 (Schema Migration)

## 목차

- [스키마 마이그레이션을 왜 묻는가](#스키마-마이그레이션을-왜-묻는가)
- [스키마 마이그레이션이란](#스키마-마이그레이션이란)
- [DDL 한 번으로 끝나지 않는 이유](#ddl-한-번으로-끝나지-않는-이유)
- [Zero-Downtime Migration 기본 원칙](#zero-downtime-migration-기본-원칙)
- [Expand and Contract 패턴](#expand-and-contract-패턴)
- [Backfill과 대량 데이터 변경](#backfill과-대량-데이터-변경)
- [Dual Write와 동기화 주의점](#dual-write와-동기화-주의점)
- [Long-Running Migration이 위험한 이유](#long-running-migration이-위험한-이유)
- [Rollback 전략](#rollback-전략)
- [실무에서 자주 나는 실수](#실무에서-자주-나는-실수)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 스키마 마이그레이션을 왜 묻는가

백엔드 면접에서 스키마 마이그레이션은  
"ALTER TABLE을 실행해봤는가"를 묻는 문제가 아닙니다.

보통 다음 질문으로 이어집니다.

- 운영 중인 테이블 구조를 어떻게 바꿀 것인가
- 애플리케이션 배포와 스키마 변경 순서를 어떻게 맞출 것인가
- 큰 테이블에서 락과 장애를 어떻게 피할 것인가
- 문제가 나면 어디까지 되돌릴 수 있는가

즉, 핵심은  
**스키마 변경을 개발 작업이 아니라 운영 변경으로 다룰 수 있는가**입니다.

시스템 설계 관점의 데이터 저장 전략은 [데이터베이스 설계 (Database Design)](../system-design/database-design.md),  
테이블 구조 자체의 설계는 [데이터 모델링 (Data Modeling)](data-modeling.md),  
엔진별 제약은 [PostgreSQL / MySQL](postgresql-mysql.md) 문서와 같이 보면 연결이 좋습니다.

---

## 스키마 마이그레이션이란

**스키마 마이그레이션(Schema Migration)** 은  
운영 중인 데이터베이스 구조를 안전하게 바꾸는 절차입니다.

예를 들어 다음이 모두 마이그레이션입니다.

- 컬럼 추가
- 컬럼 타입 변경
- 인덱스 추가/제거
- 제약 조건 추가
- 테이블 분리
- 데이터 이전과 백필

좋은 답변은 "migration tool을 씁니다"보다  
**애플리케이션 호환성, 데이터 정합성, 운영 중 영향 범위를 같이 관리한다**는 흐름이 중요합니다.

---

## DDL 한 번으로 끝나지 않는 이유

작은 개발 DB에서는 `ALTER TABLE` 한 번으로 끝나는 것처럼 보일 수 있습니다.[^pg-alter]

하지만 운영 환경에서는 다음 문제가 생깁니다.

- 테이블이 커서 변경 시간이 오래 걸릴 수 있음
- DDL이 메타데이터 락이나 테이블 재작성으로 이어질 수 있음
- 구버전 애플리케이션과 신버전 애플리케이션이 잠시 공존할 수 있음
- 백필이 길어지면 쓰기 부하와 복제 지연을 만들 수 있음

즉, 스키마 변경은 SQL 한 줄보다  
**배포 순서와 데이터 이전 절차를 어떻게 쪼개는가**가 더 중요합니다.

---

## Zero-Downtime Migration 기본 원칙

운영 중 서비스 중단 없이 바꾸고 싶다면 보통 다음 원칙을 먼저 잡습니다.[^gh-strong-migrations]

- **파괴적 변경을 한 번에 하지 않음**
- **구버전과 신버전이 잠시 같이 살아도 되게 설계**
- **큰 데이터 변경은 여러 단계로 쪼갬**
- **DDL과 데이터 이전을 분리**
- **되돌릴 수 있는 지점을 남김**

좋은 답변은 "다운타임 없이 합니다"보다  
**호환 가능한 중간 상태를 일부러 만든다**고 설명하는 편이 좋습니다.

---

## Expand and Contract 패턴

가장 많이 나오는 기본 패턴입니다.

| **단계** | **의미** | **예시** |
| --- | --- | --- |
| Expand | 새 구조를 먼저 추가 | 새 컬럼 추가, 새 테이블 생성 |
| Dual Compatibility | 구/신 구조를 둘 다 읽거나 쓸 수 있게 함 | 구컬럼과 신컬럼 공존 |
| Backfill | 기존 데이터를 새 구조로 채움 | 배치로 신규 컬럼 채우기 |
| Cutover | 애플리케이션을 새 구조로 전환 | 새 컬럼만 읽기 |
| Contract | 더 이상 안 쓰는 구조 제거 | 구컬럼 삭제 |

예를 들어 `full_name` 을 `first_name`, `last_name` 으로 쪼개는 경우:

1. `first_name`, `last_name` 컬럼 추가
2. 애플리케이션이 새 컬럼도 함께 쓰도록 변경
3. 기존 `full_name` 데이터를 백필
4. 읽기 경로를 새 컬럼 기준으로 전환
5. 충분히 안정화된 뒤 `full_name` 제거

이 패턴의 핵심은  
**컬럼 삭제나 타입 변경 같은 파괴적 단계를 맨 마지막으로 미루는 것**입니다.

---

## Backfill과 대량 데이터 변경

새 컬럼을 추가한 뒤 기존 데이터를 채우는 작업이 바로 **backfill** 입니다.

여기서 자주 놓치는 포인트는 다음입니다.

- 한 번에 전량 업데이트하지 않기
- 작은 배치로 나눠 처리하기
- PK 범위나 시간 기준으로 나누기
- replica lag, lock wait, CPU 사용률을 같이 보기
- 재시작 가능하게 만들기

좋은 backfill 작업은 다음과 같이 설명할 수 있습니다.

- `id` 범위 기준으로 1,000건씩 처리
- 배치 간 sleep 또는 rate limit 적용
- 이미 처리된 구간은 다시 건너뛰기
- 진행률과 실패 건수 기록

즉, backfill은 단순 SQL보다  
**운영 배치 작업처럼 설계하는 편이 안전합니다**.

---

## Dual Write와 동기화 주의점

마이그레이션 중에는 구구조와 신구조를 잠시 같이 써야 할 때가 있습니다.

이때 나오는 것이 **dual write** 입니다.

- 구컬럼과 신컬럼에 동시에 기록
- 구테이블과 신테이블에 동시에 기록
- 이벤트나 CDC로 비동기 동기화

장점:

- 점진 전환이 쉬움
- 구버전/신버전 호환 구간을 만들기 좋음

주의점:

- 한쪽만 쓰고 다른 쪽 기록이 빠질 수 있음
- 재시도 중복 처리와 정합성 기준이 필요함
- 비동기 동기화라면 지연과 역전 문제를 같이 봐야 함

면접에서는 dual write를 가볍게 말하기보다  
**가능하면 짧게 가져가고, 최종 기준(source of truth)을 분명히 둔다**고 설명하는 편이 좋습니다.

관련된 중복 처리와 멱등성은 [분산 데이터 처리 (Distributed Data Processing)](distributed-data-processing.md) 문서와도 연결됩니다.

---

## Long-Running Migration이 위험한 이유

큰 테이블 변경은 오래 걸릴수록 위험합니다.

- 락 점유 시간이 길어질 수 있음
- 애플리케이션 타임아웃과 장애로 이어질 수 있음
- replication lag가 커질 수 있음
- 장애 발생 시 중간 상태가 길게 남음

대표 위험 작업은 다음과 같습니다.

- 큰 테이블의 타입 변경
- 테이블 재작성 유발 DDL
- 인덱스 생성 시 과도한 I/O 사용
- 수억 건 단일 트랜잭션 업데이트

좋은 답변은 "야간에 합니다"보다  
**영향을 나누고, 온라인 생성 옵션이나 배치 전환 전략을 먼저 검토한다**고 말하는 편이 더 실무적입니다.[^mysql-online-ddl]

엔진별 세부 특성은 [PostgreSQL / MySQL](postgresql-mysql.md) 문서와 같이 보면 좋습니다.

---

## Rollback 전략

스키마 마이그레이션에서 rollback은 항상 "원래대로 되돌린다"로 끝나지 않습니다.

보통 다음 층으로 나눠 봐야 합니다.

- **애플리케이션 롤백:** 구버전 코드로 되돌리기
- **읽기 경로 롤백:** 새 컬럼 대신 구컬럼을 다시 읽기
- **쓰기 경로 롤백:** dual write 중 일부를 끄기
- **스키마 롤백:** 새 구조를 즉시 지우지 않고 남겨두기

중요한 점:

- 파괴적 DDL은 되돌리기 어렵거나 오래 걸릴 수 있음
- 이미 백필한 데이터는 단순 rollback 대상이 아닐 수 있음
- 삭제는 가장 마지막에 해야 rollback 여지가 남음

그래서 실무에서는 보통  
**애플리케이션 전환은 빠르게 되돌릴 수 있게 하고, 스키마 제거는 늦게 한다**는 원칙이 자연스럽습니다.

---

## 실무에서 자주 나는 실수

- nullable 추가와 not null 강제를 한 번에 진행
- 큰 테이블 백필을 단일 트랜잭션으로 실행
- 구버전 애플리케이션 호환성을 고려하지 않고 컬럼을 바로 삭제
- dual write 기간이 길어져 어느 쪽이 진짜 기준인지 흐려짐
- migration 성공만 보고 replica lag나 lock wait는 확인하지 않음
- rollback 계획 없이 파괴적 DDL부터 적용

---

## 면접 포인트

- 스키마 마이그레이션은 SQL 한 줄보다 배포 순서와 호환성 설계가 더 중요하다.
- zero-downtime migration은 중간 호환 상태를 의도적으로 만드는 작업이다.
- expand and contract 패턴으로 설명하면 답변이 가장 안정적이다.
- backfill은 운영 배치처럼 쪼개고, 진행률과 재시작 가능성을 같이 봐야 한다.
- rollback은 코드, 읽기 경로, 쓰기 경로, 스키마 제거 시점을 나눠서 설명하는 편이 좋다.

---

## 참고 자료

[^gh-strong-migrations]: [GitHub, strong_migrations](https://github.com/ankane/strong_migrations)
[^pg-alter]: [PostgreSQL Documentation, ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
[^mysql-online-ddl]: [MySQL Documentation, Online DDL Operations](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html)
