---
title: 멀티 테넌시 (Multi-Tenancy)
description: 멀티 테넌시에서 격리 수준, 비용, 운영 복잡도 사이의 설계 트레이드오프를 정리했습니다.
parent: 시스템 디자인
nav_order: 10
---

# 멀티 테넌시 (Multi-Tenancy)

## 목차

- [멀티 테넌시를 왜 묻는가](#멀티-테넌시를-왜-묻는가)
- [멀티 테넌시란](#멀티-테넌시란)
- [격리 전략 비교](#격리-전략-비교)
- [Shared Database Shared Schema](#shared-database-shared-schema)
- [Shared Database Separate Schema](#shared-database-separate-schema)
- [Separate Database](#separate-database)
- [Tenant Isolation과 보안](#tenant-isolation과-보안)
- [Noisy Neighbor와 성능 격리](#noisy-neighbor와-성능-격리)
- [커스터마이징과 운영 복잡도](#커스터마이징과-운영-복잡도)
- [트레이드오프](#트레이드오프)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 멀티 테넌시를 왜 묻는가

백엔드 면접에서 멀티 테넌시는  
"tenant_id 컬럼을 넣는가"보다 **격리, 비용, 운영 단순화 사이에서 어떤 구조를 고를 것인가**를 보는 질문에 가깝습니다.

보통 다음 질문으로 이어집니다.

- 고객사 데이터를 어디까지 분리할 것인가
- 큰 고객 한 곳이 전체 성능에 영향을 줄 수 있는가
- 고객별 커스터마이징은 어디까지 허용할 것인가
- 보안 사고가 나면 한 tenant에만 국한되는가

즉, 이 문서의 핵심은  
**멀티 테넌시를 저장 구조가 아니라 격리 전략으로 설명할 수 있는가**입니다.

데이터 구조 관점은 [데이터베이스 설계 (Database Design)](database-design.md),  
DB 모델링 관점은 [데이터 모델링 (Data Modeling)](../database/data-modeling.md),  
보안 경계는 [보안 설계 (Security Design)](security-design.md) 와 같이 보면 좋습니다.

---

## 멀티 테넌시란

멀티 테넌시는 하나의 서비스 플랫폼이  
여러 고객사나 조직 단위를 동시에 수용하는 구조입니다.

핵심 질문은 다음 세 가지입니다.

- 데이터는 어디까지 분리할 것인가
- 리소스 사용량은 어떻게 격리할 것인가
- 기능 차이는 어디까지 허용할 것인가

좋은 답변은 "`tenant_id`를 둡니다"보다  
**데이터, 성능, 운영의 격리 수준을 어떤 비용으로 가져갈지**를 설명하는 편이 좋습니다.

---

## 격리 전략 비교

| **전략** | **장점** | **주의점** |
| --- | --- | --- |
| Shared DB / Shared Schema | 운영 단순, 비용 효율 | 격리와 실수 방지 장치가 더 중요 |
| Shared DB / Separate Schema | 논리적 분리 강화 | 스키마 관리와 운영 복잡도 증가 |
| Separate DB | 강한 격리 | 비용, 운영 자동화, 관측성 부담 증가 |

좋은 답변은 "분리할수록 좋다"가 아니라  
**고객 규모와 보안 요구에 따라 단계적으로 올린다**는 식이 자연스럽습니다.

---

## Shared Database Shared Schema

가장 단순한 형태입니다.

- 같은 테이블
- 같은 스키마
- `tenant_id` 같은 구분 컬럼으로 분리

장점:

- 비용 효율이 좋음
- 신규 tenant 온보딩이 빠름
- 운영과 마이그레이션이 단순함

주의점:

- 쿼리 누락 시 데이터 혼선 위험
- noisy neighbor 영향이 큼
- tenant별 커스터마이징이 어려움

좋은 답변은 이 구조를 "나쁜 구조"처럼 말하기보다  
**초기 SaaS나 표준화된 상품에서는 가장 현실적인 출발점일 수 있다**고 설명하는 편이 좋습니다.

---

## Shared Database Separate Schema

같은 DB 인스턴스 안에서 schema를 tenant별로 나누는 방식입니다.

장점:

- 논리적 분리가 더 명확함
- tenant별 백업/복원이나 접근 통제에 유리할 수 있음

주의점:

- schema 수가 많아지면 운영 복잡도 증가
- migration이 tenant 수만큼 반복될 수 있음
- 애플리케이션과 ORM 관리가 복잡해질 수 있음

좋은 답변은 "중간 단계"라는 표현이 자연스럽습니다.  
격리는 강화되지만, 운영 자동화가 받쳐주지 않으면 빠르게 부담이 커질 수 있습니다.

---

## Separate Database

tenant별로 데이터베이스를 분리하는 방식입니다.

장점:

- 강한 격리
- tenant별 성능 / 백업 / 보안 정책 차등 적용 가능
- 특정 tenant 이슈가 전체에 번질 가능성이 낮음

주의점:

- 비용 증가
- provisioning, monitoring, migration 자동화 필수
- 운영 대상 수가 크게 늘어남

좋은 답변은 이 구조를 "엔터프라이즈 고객"이나  
"강한 보안 / 규제 분리 요구"에 잘 맞는 선택으로 설명하면 좋습니다.

---

## Tenant Isolation과 보안

멀티 테넌시에서 가장 중요한 축 중 하나는 데이터 격리입니다.

대표 보호 장치는 다음과 같습니다.

- 모든 쿼리에 tenant scope 강제
- 서비스 계층에서 tenant context 전파
- 캐시 키와 메시지 키에도 tenant 경계 반영
- 관리자 기능의 tenant 전환 감사 로그 남김

즉, 좋은 답변은 DB 구조만 말하지 않고  
**애플리케이션, 캐시, 로그, 운영 도구까지 tenant 경계를 일관되게 유지한다**고 설명하는 편이 안전합니다.

---

## Noisy Neighbor와 성능 격리

같은 인프라를 공유하면 큰 tenant 한 곳이 전체에 영향을 줄 수 있습니다.

대표 문제는 다음과 같습니다.

- 특정 tenant의 과도한 배치 작업
- hot key / hot partition
- 검색 / 리포트 쿼리 폭주
- 캐시 오염

대응 방식은 다음과 같습니다.

- tenant별 rate limit / quota
- 읽기 전용 리포트 경로 분리
- 큰 tenant 분리 수용
- 워크로드별 큐 분리

좋은 답변은 "공유하되, 항상 동일하게 대우하지는 않는다"는 감각을 가지면 좋습니다.

---

## 커스터마이징과 운영 복잡도

멀티 테넌시가 어려운 이유는 데이터만이 아닙니다.

다음도 같이 늘어납니다.

- tenant별 기능 차이
- 요금제별 제한
- 브랜딩 / 설정 차이
- 배포 순서와 마이그레이션 차이

커스터마이징을 많이 허용할수록  
코드 경로와 운영 경로가 tenant별로 갈라질 수 있습니다.

그래서 좋은 답변은  
**데이터 격리와 기능 격리를 어디까지 허용할지 별도로 정한다**는 식이 좋습니다.

---

## 트레이드오프

| **선택** | **장점** | **주의점** |
| --- | --- | --- |
| 공유 구조 유지 | 비용 효율, 운영 단순화 | 격리와 성능 충돌 가능 |
| tenant별 분리 강화 | 보안과 성능 격리 강화 | 운영 자동화 부담 증가 |
| 큰 tenant만 별도 분리 | 현실적 절충안 | 구조가 혼합되어 복잡해질 수 있음 |

좋은 답변은 "정답 구조"를 말하기보다  
**고객 규모, 규제 요구, 운영 자동화 수준에 따라 분리 강도를 조절한다**는 식이 자연스럽습니다.

---

## 면접 포인트

- 멀티 테넌시는 `tenant_id` 컬럼 하나의 문제가 아니라 격리 전략의 문제다.
- shared schema, separate schema, separate database는 비용과 격리 수준이 다르다.
- 보안 격리는 DB뿐 아니라 캐시, 로그, 메시지, 운영 도구까지 같이 봐야 한다.
- noisy neighbor 대응과 tenant별 quota 전략을 말하면 답변이 실무적으로 들린다.
- 큰 고객만 별도 분리하는 혼합 전략도 현실적인 선택지다.

---

## 참고 자료

- Microsoft Azure Architecture Center, Multitenant solution architecture - https://learn.microsoft.com/azure/architecture/guide/multitenant/overview
- AWS SaaS Lens - https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/welcome.html
