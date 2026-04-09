---
title: 검색 시스템 설계 예시 (Search System Design Example)
description: 검색 문제를 기준으로 색인 파이프라인, inverted index, shard와 replica, 최신성을 어떻게 설명할지 다룹니다.
parent: 시스템 디자인
nav_order: 5
---

# 검색 시스템 설계 예시 (Search System Design Example)

## 목차

- [이 문서를 왜 보나](#이-문서를-왜-보나)
- [문제 정의와 요구사항](#문제-정의와-요구사항)
- [규모 추정](#규모-추정)
- [고수준 설계](#고수준-설계)
- [데이터 모델과 저장 전략](#데이터-모델과-저장-전략)
- [핵심 데이터 흐름](#핵심-데이터-흐름)
- [확장 전략](#확장-전략)
- [장애와 운영 포인트](#장애와-운영-포인트)
- [트레이드오프 말하는 방법](#트레이드오프-말하는-방법)
- [면접관이 자주 던지는 꼬리질문](#면접관이-자주-던지는-꼬리질문)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 이 문서를 왜 보나

**검색 시스템(Search System)** 은 시스템 디자인 면접에서 자주 나오는 대표 문제입니다.

검색 시스템은 보통 다음을 동시에 묻습니다.

- **문서 수집과 검색 서빙을 분리할 수 있는가**
- **정확도와 지연 시간 사이의 균형을 설명할 수 있는가**
- **색인 최신성과 운영 비용을 함께 볼 수 있는가**
- **분산 검색에서 shard와 replica의 의미를 알고 있는가**

이 문서는 검색 문제를 기준으로 요구사항, 색인 경로, 조회 경로, shard/replica, 최신성과 지연 시간의 균형을 어떻게 설명할지 정리합니다.

즉, 검색 문제는 "LIKE 검색을 빠르게 하자"가 아니라  
**분석, 색인, 서빙, 랭킹을 분리한 별도 시스템을 언제 왜 두는가**를 보는 질문입니다.

검색 엔진 내부 구현과 DB 인덱싱 차이는 [검색과 인덱싱 (Search and Indexing)](../database/search-and-indexing.md) 문서가 더 직접적입니다.  
시스템 디자인 관점의 캐시, 확장, 저장 전략은 [캐싱 전략 (Caching Strategy)](caching-strategy.md), [데이터베이스 설계 (Database Design)](database-design.md), [API 설계 (API Design)](api-design.md), [모니터링 및 로깅 (Monitoring & Logging)](monitoring-and-logging.md) 문서와 같이 보면 좋습니다.

---

## 문제 정의와 요구사항

먼저 어떤 검색인지 범위를 좁혀야 합니다.

이번 문서는 다음 정도를 가정합니다.

- **기능적 요구사항**
  - 사용자가 키워드로 문서를 검색할 수 있어야 함
  - 검색 결과는 relevance 기반으로 정렬되어야 함
  - title, body, tag 같은 여러 필드를 검색할 수 있어야 함
  - pagination과 필터링이 가능해야 함
- **비기능적 요구사항**
  - 검색 응답은 예를 들어 `p99 150ms` 안팎으로 유지되어야 함
  - 새 문서는 예를 들어 수 초에서 수십 초 안에 검색 가능해져야 함
  - 노드 일부가 실패해도 검색은 계속 가능해야 함
  - hot query가 생겨도 전체 클러스터가 흔들리면 안 됨

좋은 답변은 여기서 다음을 미리 확인합니다.

- **완전한 실시간 색인이 필요한가**
- **정확한 일치보다 relevance가 중요한가**
- **필터와 정렬이 많은가**
- **자동완성까지 이번 범위인가**

자동완성은 별도 문제로 떼는 편이 좋습니다.  
autocomplete는 prefix 자료구조, 매우 짧은 latency, 인기 query 갱신 같은 별도 설계 포인트가 커서, 기본 검색 시스템과 분리해 설명하는 편이 안정적입니다.

벡터 검색이나 시맨틱 검색도 비슷하게 별도 문제로 보는 편이 좋습니다. 임베딩 생성, ANN 인덱스, retrieval 파이프라인이 추가되어 기본 keyword search와 설계 축이 달라지기 때문입니다.

---

## 규모 추정

예를 들어 다음 정도로 둘 수 있습니다.

- 색인 대상 문서 10억 건
- 초당 검색 요청 5만 건
- 초당 문서 업데이트 2천 건
- 문서당 평균 본문 길이 수 KB
- freshness 목표는 수 초~수십 초 이내

여기서 바로 나오는 판단은 다음과 같습니다.

- **문서 저장소와 검색 저장소를 분리** 해야 함
- **색인 파이프라인이 비동기** 인 것이 자연스러움
- **단일 노드 검색은 불가능** 하므로 shard 분산이 필요함
- **상위 query의 tail latency 관리** 가 중요함

즉, 검색 시스템은 원본 데이터를 저장하는 문제보다  
**문서를 검색 친화적 형태로 재구성하는 문제**에 가깝습니다.

---

## 고수준 설계

기본 구조는 다음처럼 잡을 수 있습니다.

```text
Client
  -> API Gateway / Search API
    -> Query Service
      -> Result Cache
      -> Search Cluster
      -> Ranking / Blending Layer

Source DB / Object Store
  -> CDC / Event / Batch Ingestion
    -> Indexing Pipeline
      -> Search Cluster
```

각 구성 요소의 역할은 다음과 같습니다.

- **Source DB:** 원본 데이터 저장소
- **Ingestion / CDC:** 변경 이벤트를 수집
- **Indexing Pipeline:** 문서를 토큰화, 정규화, 색인용 구조로 변환
- **Search Cluster:** inverted index 기반 검색 서빙
- **Query Service:** 검색 요청 파싱, 필터 적용, shard fan-out, 결과 병합
- **Result Cache:** hot query 결과 캐시
- **Ranking Layer:** 텍스트 점수와 비즈니스 신호를 결합

여기서 핵심은 검색 시스템을 두 경로로 나눠 설명하는 것입니다.

1. **색인 경로:** 문서를 어떻게 검색 가능한 형태로 만드는가
2. **조회 경로:** 검색 요청을 어떻게 빠르게 처리하는가

이 분리가 선명해야 시스템 디자인 답변이 안정됩니다.

---

## 데이터 모델과 저장 전략

검색 시스템은 원본 문서를 그대로 읽지 않고, 보통 **inverted index** 같은 검색 전용 구조를 사용합니다.[^elastic-full-text][^elastic-doc-values]

| **저장 요소** | **역할** | **예시** |
| --- | --- | --- |
| 원본 문서 | 사실의 원본 저장 | `doc_id -> full document` |
| 색인 문서 | 검색용 필드 추출본 | `doc_id -> searchable fields` |
| Inverted Index | token -> document list 매핑 | `token -> posting list` |
| Forward / Columnar Data | 정렬, 집계, 필터 보조 | field values |

이 구분이 중요한 이유는 다음과 같습니다.

- 원본 저장소는 무결성과 트랜잭션 중심
- 검색 저장소는 조회 지연과 relevance 중심
- 색인 파이프라인이 두 저장소 사이를 연결

간단히 말해 inverted index는 다음처럼 생각할 수 있습니다.

```text
"backend" -> [doc3, doc7, doc42]
"cache"   -> [doc7, doc10]
```

즉, 문서를 처음부터 끝까지 훑는 대신 **검색어에서 후보 문서 집합으로 바로 점프하는 구조**라고 설명하면 더 직관적입니다.

### shard와 replica를 어떻게 설명할까

| **항목** | **역할** | **장점** | **주의점** |
| --- | --- | --- | --- |
| Shard | 색인을 여러 파티션으로 분산 | 저장량과 처리량 확장 | shard 수가 너무 많으면 fan-out 비용 증가 |
| Replica | shard의 복사본 | 읽기 분산과 장애 대응 | 쓰기 비용과 자원 사용 증가 |

분산 검색에서는 한 query가 여러 shard에 흩어져 실행될 수 있습니다.[^elastic-replication][^elastic-shard-routing]

그래서 답변할 때 다음을 같이 말하는 편이 좋습니다.

- shard를 늘리면 확장에는 유리하지만 query fan-out 비용이 커질 수 있음
- replica는 읽기 가용성과 분산에 유리하지만 색인 비용이 증가함
- 검색은 가장 느린 shard가 전체 응답 시간을 끌어올릴 수 있음

즉, shard와 replica는 단순한 고가용성 설정이 아니라  
**검색 지연, 색인 비용, 운영 복잡도를 함께 바꾸는 설계 변수**입니다.

---

## 핵심 데이터 흐름

### 색인 경로

1. 원본 문서가 Source DB에 생성 또는 수정됨
2. CDC, 이벤트, 배치 적재가 변경 내용을 ingestion 파이프라인으로 전달
3. Indexing Pipeline이 텍스트 정규화, 토큰화, 필드 추출 수행
4. 검색 클러스터가 shard별로 색인 반영
5. 검색 가능 상태가 되면 freshness 지표 갱신

이때 중요한 포인트는 **색인과 조회를 동기 처리하지 않는 경우가 많다**는 점입니다.

- 원본 저장은 성공했지만 검색 반영은 몇 초 늦을 수 있음
- 이 지연을 사용자가 이해할 수 있는가가 freshness 요구사항

즉, 좋은 답변은 "검색은 결국 최종적 일관성을 가진 읽기 모델"이라고 정리하는 편이 좋습니다.

### 조회 경로

1. 사용자가 query와 filter를 보냄
2. Query Service가 query parsing과 normalization 수행
3. 적절한 shard들로 fan-out
4. 각 shard가 local top-K 결과를 반환
5. coordinator가 결과를 merge하고 ranking 적용
6. 결과를 응답하고 hot query면 캐시에 저장

검색 조회 경로에서 자주 놓치는 포인트는 다음입니다.

- **모든 shard를 무조건 다 칠 것인가**
- **필터와 정렬이 relevance보다 우선하는가**
- **top-K만 먼저 모으고 상세는 나중에 가져올 것인가**

검색 시스템 설명에서 response time이 흔들리는 대표 이유는 tail latency입니다.  
병렬 fan-out 구조에서는 가장 느린 shard 하나가 전체 응답을 늦출 수 있기 때문입니다.[^tail-at-scale]

---

## 확장 전략

검색 시스템의 확장성은 단순히 문서를 더 저장하는 문제가 아닙니다.

다음 세 가지를 동시에 봐야 합니다.

- **색인 처리량**
- **검색 조회량**
- **최신성 요구**

대표 확장 포인트는 다음과 같습니다.

| **문제** | **대응** | **대가** |
| --- | --- | --- |
| 색인량 증가 | shard 수 조정, ingestion 병렬화 | shard fan-out과 운영 부담 증가 |
| 조회량 증가 | replica 확장, result cache, query cache | 자원 비용 증가, cache invalidation 필요 |
| hot query | 상위 query 캐시, precompute | 최신성 저하 가능 |
| tail latency | timeout budget, partial result 정책, adaptive routing | 결과 품질 또는 단순성 저하 가능 |

또한 shard 수를 과도하게 늘리면 다음 문제가 생깁니다.

- coordinator merge 비용 증가
- 작은 shard가 너무 많아져 검색 오버헤드 증가
- 재배치와 복구가 잦아짐

Elastic 문서도 shard 수가 너무 많으면 검색 비용이 커질 수 있다고 설명합니다.[^elastic-shard-size]

좋은 답변은 "문서가 많으니 shard를 늘린다"가 아니라,  
**색인량, query fan-out, 장애 복구, 운영 비용을 같이 보고 shard 수를 정한다**는 식으로 정리하는 답변입니다.

---

## 장애와 운영 포인트

검색 시스템은 일부 실패를 흡수하면서도 응답성을 유지해야 합니다.

대표 운영 포인트는 다음과 같습니다.

- **색인 지연:** ingestion backlog 때문에 새 문서 검색 반영이 늦어질 수 있음
- **hot shard:** 특정 token이나 특정 index 구간에 부하가 몰릴 수 있음
- **tail latency:** shard 하나의 느린 응답이 전체 응답을 끌어올림
- **relevance drift:** 색인은 살아 있어도 랭킹 품질이 떨어질 수 있음
- **cache skew:** 인기 query가 cache churn을 만들 수 있음

이때 면접 답변에 넣으면 좋은 운영 원칙은 다음과 같습니다.

- **freshness 지표를 별도로 본다**
  - 마지막 성공 색인 시각
  - ingestion lag
- **검색 성공률만 보지 않는다**
  - p95 / p99 latency
  - partial result 비율
  - cache hit ratio
- **degraded mode를 정의한다**
  - 고급 ranking 실패 시 기본 BM25 계열 결과로 fallback
  - 일부 shard timeout 시 제한적 결과라도 반환할지 결정

좋은 운영 답변은 "검색이 안 되면 재시작합니다"가 아니라,  
**freshness, latency, relevance를 서로 다른 지표로 본다**는 점을 보여주는 답변입니다.

---

## 트레이드오프 말하는 방법

검색 시스템에서 가장 자주 나오는 축은 다음 세 가지입니다.

1. **정확도 / relevance**
2. **응답 지연**
3. **최신성 / freshness**

예를 들어 이렇게 정리할 수 있습니다.

> 문서 저장과 검색 색인을 분리하고, 색인은 비동기 파이프라인으로 운영하겠습니다. 이렇게 하면 검색 서빙은 빠르게 유지할 수 있지만, 문서 반영이 수 초 늦어질 수 있다는 대가가 있습니다. shard와 replica는 조회량과 복구 요구를 기준으로 조정하되, shard fan-out이 tail latency를 키우지 않도록 과도한 분할은 피하겠습니다.

이 문장에 들어가야 하는 핵심은 다음입니다.

- 무엇을 분리했는가
- 왜 분리했는가
- 어떤 지연이나 비용을 감수하는가
- 어떤 보호 장치를 둘 것인가

좋은 답변은 "Elasticsearch를 쓰겠습니다"에서 끝나지 않고,  
**검색은 색인 최신성, 분산 fan-out, relevance 품질을 함께 관리하는 시스템**이라는 점을 설명하는 답변입니다.

---

## 면접관이 자주 던지는 꼬리질문

1. **왜 원본 DB 인덱스로는 안 되고 별도 검색 시스템이 필요한가**
   - relevance, 전문 검색, 토큰화, 분산 조회, 별도 운영 요구를 이유로 들면 좋습니다.

2. **문서가 수정되면 검색 결과는 언제 바뀌는가**
   - 비동기 색인 파이프라인이므로 freshness 지연이 생길 수 있고, 이를 SLO로 관리한다고 설명할 수 있습니다.

3. **shard 수는 어떻게 정할 것인가**
   - 데이터 크기뿐 아니라 query fan-out, 장애 복구 시간, 운영 비용을 같이 본다고 답하는 편이 좋습니다.

4. **hot query가 생기면 어떻게 대응할 것인가**
   - result cache, query cache, replica 확장, precompute를 함께 설명하면 좋습니다.

5. **autocomplete도 같은 시스템으로 처리할 것인가**
   - 완전히 같게 두지 않고, 별도 latency 목표와 자료구조가 필요할 수 있어 분리 검토한다고 답하면 자연스럽습니다.

6. **랭킹은 어디까지 다뤄야 하는가**
   - 기본 검색은 lexical relevance 중심으로 설명하고, 개인화/ML ranking은 후속 확장으로 두는 편이 좋습니다.

---

## 면접 포인트

- **검색 시스템은 원본 저장소와 검색 저장소를 분리해서 설명하는 편이 자연스럽습니다.**
- **색인 경로와 조회 경로를 분리해 설명해야 시스템 구조가 선명해집니다.**
- **inverted index, shard, replica, freshness를 한 흐름으로 연결할 수 있어야 합니다.**
- **검색은 평균 latency보다 tail latency가 더 중요해질 수 있다는 점을 같이 말하면 좋습니다.**
- **autocomplete, 추천, 벡터 검색은 인접 문제이지 기본 검색 시스템 답변의 필수 범위는 아닙니다.**

---

## 참고 자료

[^elastic-full-text]: Elastic Docs, "How full-text search works" - https://www.elastic.co/docs/solutions/search/full-text/how-full-text-works
[^elastic-doc-values]: Elastic Docs, "doc_values" - https://www.elastic.co/guide/en/elasticsearch/reference/current/doc-values.html
[^elastic-replication]: Elastic Docs, "Reading and writing documents" - https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-replication.html
[^elastic-shard-routing]: Elastic Docs, "Search shard routing" - https://www.elastic.co/guide/en/elasticsearch/reference/current/search-shard-routing.html
[^elastic-shard-size]: Elastic Docs, "Size your shards" - https://www.elastic.co/guide/en/elasticsearch/reference/8.19/size-your-shards.html
[^tail-at-scale]: Google Research, "The Tail at Scale" - https://research.google/pubs/the-tail-at-scale/
