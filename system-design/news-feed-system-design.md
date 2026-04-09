---
title: 뉴스 피드 시스템 설계 (News Feed System Design)
description: 뉴스 피드 설계에서 fan-out, 타임라인 저장, 캐시, celebrity 문제를 면접에서 어떻게 설명할지 다룹니다.
parent: 시스템 디자인
nav_order: 19
---

# 뉴스 피드 시스템 설계 (News Feed System Design)

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

**뉴스 피드 시스템(News Feed System)** 은 시스템 디자인 면접에서 자주 쓰이는 대표 문제입니다.

이 문제는 단순히 게시글을 저장하는 문제가 아니라 다음을 한 번에 보게 만듭니다.

- **읽기 중심 서비스:** 대부분의 요청이 피드 조회입니다.
- **개인화:** 사용자마다 다른 결과를 보여줘야 합니다.
- **비동기 처리:** 쓰기 시점과 읽기 시점의 경계를 나눠야 합니다.
- **확장성:** follower 수가 큰 사용자 때문에 hot key가 쉽게 생깁니다.
- **운영성:** 캐시, 재계산, 지연 허용 범위를 같이 설명해야 합니다.

즉, 이 문제는 "타임라인을 어떻게 저장할까"보다  
**읽기 지연, 쓰기 비용, 정합성, 운영 복잡도 사이의 균형을 어떻게 잡을까**를 보는 문제에 가깝습니다.

피드 외의 일반 확장 전략은 [확장성 (Scalability)](scalability.md), 저장 전략은 [데이터베이스 설계 (Database Design)](database-design.md), 캐시 배치와 무효화는 [캐싱 전략 (Caching Strategy)](caching-strategy.md), 운영 지표는 [모니터링 및 로깅 (Monitoring & Logging)](monitoring-and-logging.md) 문서와 같이 보면 연결이 좋습니다.

---

## 문제 정의와 요구사항

면접에서는 먼저 범위를 고정하는 편이 좋습니다.

예를 들어 다음 정도로 정의할 수 있습니다.

- **기능적 요구사항**
  - 사용자가 게시글을 작성할 수 있어야 함
  - 사용자는 자신이 팔로우한 계정의 최신 게시글을 볼 수 있어야 함
  - 피드는 최신순 또는 랭킹 기반으로 정렬될 수 있어야 함
  - 스크롤을 위해 pagination이 가능해야 함
- **비기능적 요구사항**
  - 홈 피드 응답은 예를 들어 `p99 200ms` 안팎으로 유지되어야 함
  - 일부 지연은 허용되지만 전체 피드가 비어 보이면 안 됨
  - celebrity 사용자가 있어도 전체 시스템이 흔들리면 안 됨
  - 쓰기와 읽기 부하가 시간대별로 크게 흔들릴 수 있음

좋은 답변은 여기서 바로 한 가지를 분명히 합니다.

- **단순 최신순 피드인가**
- **랭킹 기반 피드인가**
- **모든 사용자가 같은 구조를 쓰는가**

초기 답변에서는 보통 **최신순 중심의 홈 피드**로 범위를 잡고,  
랭킹은 "후속 확장"으로 넘기는 편이 설명이 안정적입니다.

---

## 규모 추정

숫자는 정답이 아니라 구조를 고르는 근거입니다.

예를 들어 다음 정도로 빠르게 둘 수 있습니다.

- 일간 활성 사용자 1천만 명
- 초당 피드 조회 20만 건
- 초당 게시글 작성 5천 건
- 평균 follower 수는 작지만 일부 celebrity는 수천만 follower 보유
- 피드 1페이지는 20~50개 게시글 반환

이 숫자에서 바로 설계 판단이 나옵니다.

- **조회가 압도적으로 많으므로** 읽기 경로를 매우 가볍게 만들어야 함
- **celebrity가 있으므로** 모든 글을 모든 follower 타임라인에 즉시 밀어 넣는 전략은 위험할 수 있음
- **pagination이 필요하므로** offset보다 cursor 기반이 더 자연스러울 수 있음
- **정렬 기준이 자주 바뀔 수 있으므로** 원본 게시글 저장소와 피드 조회 모델을 분리하는 편이 유리할 수 있음

즉, 뉴스 피드 설계는 "게시글 저장"보다 **타임라인 재료를 어떤 시점에 어떤 비용으로 준비할 것인가**의 문제입니다.

---

## 고수준 설계

가장 기본 구조는 다음처럼 잡을 수 있습니다.

```text
Client
  -> API Gateway / Load Balancer
    -> Feed Service
      -> Timeline Cache
      -> Timeline Store
      -> Post Store
      -> Social Graph Store
      -> Fan-out Worker / Ranking Worker
```

각 구성 요소의 역할은 다음과 같습니다.

- **Feed Service:** 홈 피드 조회와 게시글 작성 요청의 진입점
- **Post Store:** 게시글 원본 저장
- **Social Graph Store:** follower / following 관계 저장
- **Timeline Store:** 사용자별 피드 후보 목록 저장
- **Timeline Cache:** 최근 요청 결과나 상위 피드 항목 캐시
- **Fan-out Worker:** 게시글 발행 후 follower 타임라인 갱신
- **Ranking Worker:** 최신순이 아닌 경우 정렬 점수 계산

좋은 답변은 이 구조를 두 경로로 나눠 설명합니다.

1. **쓰기 경로:** 게시글을 저장하고 타임라인 재료를 만든다
2. **읽기 경로:** 사용자별 타임라인을 빠르게 가져온다

여기서 핵심은 피드를 **원본 데이터 그대로 조합할지**,  
아니면 **미리 준비된 읽기 모델로 서빙할지**를 선택하는 것입니다.

---

## 데이터 모델과 저장 전략

뉴스 피드에서는 보통 다음 데이터를 나눠서 생각합니다.

| **데이터** | **역할** | **예시 키** |
| --- | --- | --- |
| 게시글 원본 | 본문, 작성자, 생성 시각, 메타데이터 | `post_id -> post` |
| 소셜 그래프 | follower / following 관계 | `user_id -> following_ids` |
| 사용자 타임라인 | 피드에 보여줄 post 후보 목록 | `user_id -> [post_ref...]` |
| 랭킹 상태 | 점수, feature, 노출 상태 | `user_id + post_id -> score/state` |

원본 게시글과 피드 조회 모델을 분리해서 설명하는 편이 좋습니다.

- **Post Store:** 원본 사실(source of truth)을 저장
- **Timeline Store:** 조회 최적화된 읽기 모델을 저장

이 구분이 중요한 이유는 다음과 같습니다.

- 게시글 저장 구조와 피드 읽기 구조의 최적화 방향이 다름
- 정합성 기준이 다를 수 있음
- 피드는 재생성 가능한 derived data로 둘 수 있음

### fan-out 전략 비교

| **전략** | **동작 방식** | **장점** | **단점** | **적합한 경우** |
| --- | --- | --- | --- | --- |
| Fan-out on Write | 게시글 작성 시 follower 타임라인에 미리 push | 읽기 경로가 매우 빠름 | follower가 많으면 쓰기 증폭이 큼 | 일반 사용자 비중이 높고 읽기 지연이 중요한 경우 |
| Fan-out on Read | 읽기 시점에 follow 관계를 따라 post를 모아 조합 | 쓰기 비용이 낮고 celebrity 대응이 쉬움 | 읽기 지연과 조합 비용이 커짐 | celebrity 비중이 크고 쓰기 fan-out이 비싼 경우 |
| Hybrid | 일반 사용자는 write fan-out, celebrity는 read fan-out | 읽기 성능과 쓰기 비용 균형 | 구현과 운영이 복잡함 | 대규모 서비스, follower 분포 편차가 큰 경우 |

대규모 서비스에서는 보통 **hybrid** 로 설명하는 편이 가장 현실적입니다.[^meta-taobench][^meta-dragon]

- follower 수가 작은 사용자는 미리 타임라인에 push
- celebrity는 참조만 두거나 읽기 시점에 merge

이렇게 하면 일반 사용자의 피드는 빠르게 유지하면서,  
hot key와 write amplification을 완화할 수 있습니다.

---

## 핵심 데이터 흐름

### 게시글 작성 흐름

1. 사용자가 게시글 작성 요청을 보냄
2. Feed Service가 Post Store에 게시글 원본 저장
3. Fan-out Worker가 follower 집합을 조회
4. 일반 사용자의 follower 타임라인에는 post reference를 push
5. celebrity 사용자는 별도 source stream에 기록
6. 캐시 무효화 또는 새 cursor 구간 반영

여기서 중요한 점은 **타임라인에 전체 본문을 복제할지, post reference만 넣을지**입니다.

- **reference 저장:** 저장 비용이 작고 수정 반영이 쉬움
- **본문 복제 저장:** 읽기 시 추가 조회가 줄지만 동기화 비용이 커짐

보통은 `post_id`, 작성 시각, 일부 가벼운 메타데이터 정도만 저장하고,  
필요한 상세 정보는 Post Store나 캐시에서 조합하는 편이 안전합니다.

예를 들어 최근 항목 순서를 빠르게 가져와야 한다면 Redis sorted set 같은 구조를 타임라인 캐시나 보조 저장소로 활용할 수 있습니다.[^redis-sorted-sets]

### 피드 조회 흐름

1. 사용자가 홈 피드 조회 요청
2. Feed Service가 Timeline Cache를 먼저 확인
3. cache miss면 Timeline Store에서 cursor 이후 항목 조회
4. celebrity source가 있으면 별도 merge
5. 필요한 post 본문과 작성자 정보를 batch fetch
6. 정렬과 중복 제거 후 응답

이때 설명이 좋아지는 포인트는 다음입니다.

- **pagination은 cursor 기반**으로 설명
- **N+1 조회를 피하려고 batch fetch** 한다고 설명
- **중복 post 제거와 soft delete 반영** 을 말해 줌

cursor 기반 pagination이 자연스러운 이유는 다음과 같습니다.

- offset 기반은 뒤로 갈수록 비용이 커질 수 있음
- 새 글이 들어오면 페이지 경계가 흔들리기 쉬움
- 피드처럼 append-heavy한 읽기 모델에 더 잘 맞음

---

## 확장 전략

뉴스 피드에서 확장 전략은 결국 **celebrity 문제를 어떻게 흡수할 것인가**로 수렴하는 경우가 많습니다.

주요 포인트는 다음과 같습니다.

- **Hot partition:** follower 수가 큰 사용자 관련 데이터에 부하 집중
- **Write amplification:** post 한 건이 너무 많은 timeline write를 유발
- **Cache skew:** 특정 사용자의 피드나 특정 post가 과도하게 자주 조회
- **Fan-out queue 적체:** burst write 때 worker 지연이 발생

대표 대응은 다음과 같습니다.

| **문제** | **대응** | **대가** |
| --- | --- | --- |
| celebrity fan-out 폭발 | 해당 사용자만 read-time merge로 분리 | 읽기 경로 복잡도 증가 |
| hot timeline cache | shard, replica, request coalescing | 캐시 일관성 관리 필요 |
| 대량 follower write | 비동기 fan-out, batch write | 최신성 지연 허용 필요 |
| 너무 큰 timeline 저장량 | 최근 N개만 유지, 오래된 항목은 재조합 | 깊은 페이지의 조회 비용 증가 |

또한 피드 저장소는 단순 해시 분산만으로 끝나지 않을 수 있습니다.

- follower graph는 사용자 단위 접근이 많음
- timeline은 사용자 단위 cursor 조회가 많음
- post store는 post id 기준 조회가 많음

즉, 데이터 성격이 서로 다르므로 하나의 저장소 전략으로 모두 풀기보다,  
**그래프, 원본 콘텐츠, 읽기 모델의 경계를 분리**해서 설명하는 편이 좋습니다.

랭킹 기반 피드까지 들어가면 feature 계산, 후보 생성, ranking 서빙 계층이 추가될 수 있습니다.  
다만 기본 면접 답변에서는 최신순 피드를 먼저 설명하고, 랭킹은 후속 질문에서 확장하는 편이 안전합니다.

---

## 장애와 운영 포인트

뉴스 피드는 강한 트랜잭션보다 **부분 실패를 어떻게 흡수할지**가 중요합니다.

대표 운영 포인트는 다음과 같습니다.

- **피드 생성 지연:** fan-out queue lag가 커지면 새 글 반영이 늦어짐
- **캐시 장애:** cache miss 폭증으로 timeline store와 post store가 함께 흔들릴 수 있음
- **중복 노출:** 재시도나 비동기 중복 실행으로 같은 post가 반복 노출될 수 있음
- **삭제 반영 지연:** 이미 materialized timeline에 남은 post를 빨리 숨겨야 함

이때 좋은 답변은 다음 원칙을 같이 말합니다.

- **핵심 경로와 부가 경로 분리:** 좋아요 수, 뷰 수는 늦어져도 피드 자체는 떠야 함
- **degraded mode 허용:** 랭킹이 깨지면 최신순 fallback을 둘 수 있음
- **재계산 가능성 확보:** timeline은 derived data이므로 재생성 경로를 둠
- **관측 지표 명확화:** cache hit ratio, fan-out lag, read latency, duplication rate, dropped task

운영성은 [모니터링 및 로깅 (Monitoring & Logging)](monitoring-and-logging.md) 문서와 같이 설명하면 자연스럽습니다.  
특히 피드 서비스에서는 사용자 영향 지표와 내부 pipeline 지표를 함께 보는 편이 좋습니다.

---

## 트레이드오프 말하는 방법

뉴스 피드 문제에서 답변이 강해지려면 다음 식으로 정리하는 편이 좋습니다.

1. **조회 지연을 우선하면** 미리 timeline을 materialize하는 전략이 유리하다
2. **쓰기 비용과 celebrity 대응을 우선하면** read-time merge가 유리하다
3. **둘 다 중요하면** hybrid로 간다

예를 들어 이렇게 말할 수 있습니다.

> 일반 사용자는 fan-out on write로 읽기 지연을 줄이고, follower 수가 매우 큰 계정은 fan-out on read로 분리하겠습니다. 이렇게 하면 평균 사용자 경험은 지키면서도 celebrity가 만드는 write amplification을 완화할 수 있습니다.

이 한 문장에 다음 요소가 들어가면 좋습니다.

- 무엇을 우선하는지
- 어떤 구조를 선택했는지
- 그 대가가 무엇인지
- 어떤 예외 케이스를 따로 처리하는지

좋은 답변은 "뉴스 피드는 Redis로 합니다"가 아니라,  
**피드가 읽기 최적화 문제이며, celebrity 때문에 단일 전략이 잘 안 맞아 hybrid가 현실적이다**는 점을 설명하는 답변입니다.

---

## 면접관이 자주 던지는 꼬리질문

1. **celebrity가 글을 올리면 follower 수천만 명에게 어떻게 반영할 것인가**
   - 모든 follower 타임라인에 즉시 push하지 않고, read-time merge나 비동기 지연 반영으로 분리한다고 답하는 편이 좋습니다.

2. **pagination은 offset과 cursor 중 무엇을 쓸 것인가**
   - 피드는 append-heavy이고 새 글 유입이 많으므로 cursor가 더 자연스럽다고 설명할 수 있습니다.

3. **게시글 삭제나 차단이 반영되면 기존 timeline은 어떻게 정리할 것인가**
   - source of truth 기준 필터링, tombstone, 비동기 cleanup을 함께 설명하면 좋습니다.

4. **랭킹 기반 피드는 어디서 계산할 것인가**
   - 기본 답변은 최신순, 확장은 후보 생성과 ranking 계층 분리로 가져가면 됩니다.

5. **캐시가 날아가면 어떻게 할 것인가**
   - timeline store fallback, batch fetch, request coalescing, rate limit 같은 보호 장치를 같이 말하면 좋습니다.

6. **celebrity 글 발행과 push notification은 어떻게 연결할 것인가**
   - 피드 반영과 푸시 발송은 동기 처리로 묶지 않고, 별도 이벤트 경로로 분리해 지연이나 실패가 홈 피드 핵심 경로를 막지 않게 한다고 설명하는 편이 좋습니다.

---

## 면접 포인트

- **뉴스 피드는 읽기 최적화와 개인화가 함께 있는 문제라서 타임라인 읽기 모델을 따로 두는 설명이 자연스럽습니다.**
- **fan-out on write, fan-out on read, hybrid의 장단점을 비교할 수 있어야 합니다.**
- **celebrity 문제, hot partition, write amplification을 짚어야 답변이 시니어답게 들립니다.**
- **pagination, 캐시, batch fetch, 중복 제거 같은 읽기 경로 디테일을 같이 말하면 좋습니다.**
- **피드 저장소는 원본 사실이 아니라 재생성 가능한 derived data로 보는 편이 운영 설명이 쉬워집니다.**

---

## 참고 자료

[^meta-taobench]: Meta Engineering, "Open-sourcing TAOBench: An end-to-end social network benchmark" - https://engineering.fb.com/2022/09/07/core-infra/taobench/
[^meta-dragon]: Meta Engineering, "Dragon: A distributed graph query engine" - https://engineering.fb.com/2016/03/18/data-infrastructure/dragon-a-distributed-graph-query-engine/
[^redis-sorted-sets]: Redis Docs, "Redis sorted sets" - https://redis.io/docs/latest/develop/data-types/sorted-sets/
