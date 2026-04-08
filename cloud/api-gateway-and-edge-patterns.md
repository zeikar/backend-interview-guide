---
title: API Gateway와 Edge 패턴 (API Gateway and Edge Patterns)
description: API Gateway의 역할, 공통 처리 책임, 서비스 경계 설계를 살펴봅니다.
parent: 클라우드
nav_order: 11
---

# API Gateway와 Edge 패턴 (API Gateway and Edge Patterns)

## 목차

- [API Gateway와 Edge 패턴을 왜 묻는가](#api-gateway와-edge-패턴을-왜-묻는가)
- [API Gateway란](#api-gateway란)
- [API Gateway가 주로 맡는 역할](#api-gateway가-주로-맡는-역할)
- [인증, 인가, 라우팅 감각](#인증-인가-라우팅-감각)
- [Rate Limit과 보호 계층](#rate-limit과-보호-계층)
- [Aggregation과 BFF](#aggregation과-bff)
- [CDN, Reverse Proxy, Load Balancer와의 차이](#cdn-reverse-proxy-load-balancer와의-차이)
- [Edge에서 처리하면 좋은 것과 아닌 것](#edge에서-처리하면-좋은-것과-아닌-것)
- [실무에서 자주 나는 실수](#실무에서-자주-나는-실수)
- [트레이드오프](#트레이드오프)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## API Gateway와 Edge 패턴을 왜 묻는가

백엔드 면접에서 이 주제는 "게이트웨이 제품을 써봤는가"보다  
**서비스 앞단에서 무엇을 공통 처리하고, 무엇은 뒤쪽 서비스로 남길지 설명할 수 있는가**를 보는 질문에 가깝습니다.

보통 다음 질문으로 이어집니다.

- 인증은 어디서 확인할 것인가
- 레이트 리밋은 어느 층에서 걸 것인가
- 여러 백엔드 호출을 게이트웨이에서 합칠 것인가
- CDN과 API Gateway는 어떻게 역할을 나눌 것인가

즉, 이 문서의 핵심은  
**Edge 계층을 단순 진입점이 아니라 정책과 보호 계층으로 설명할 수 있는가**입니다.

API 설계 관점은 [API 설계 (API Design)](../system-design/api-design.md),  
레이트 리밋의 기준 단위와 알고리즘은 [레이트 리미팅 (Rate Limiting)](../system-design/rate-limiting.md),  
네트워크 경계 관점은 [네트워크 설계 (Network Design)](network-design.md),  
마이크로서비스 경계 관점은 [마이크로서비스 아키텍처 (MSA)](microservices.md) 와 같이 보면 좋습니다.

---

## API Gateway란

API Gateway는 클라이언트와 내부 서비스 사이의 공통 진입 계층입니다.[^aws-apigw]

보통 여기서 다음을 담당합니다.

- 인증 토큰 검증
- 라우팅
- rate limit
- 요청/응답 변환
- 공통 로깅과 메트릭

좋은 답변은 "모든 요청을 받는 프록시"보다  
**여러 서비스 앞단의 공통 정책을 모으는 계층**이라고 설명하는 편이 낫습니다.

---

## API Gateway가 주로 맡는 역할

| **역할** | **설명** |
| --- | --- |
| 인증 연계 | JWT, OAuth, API Key 검증 또는 외부 인증 시스템 연동 |
| 라우팅 | 경로, 호스트, 버전, 테넌트 기준으로 백엔드 분기 |
| 보호 | rate limit, quota, WAF 연동, IP 제한 |
| 관측성 | access log, tracing header, 공통 메트릭 |
| 변환 | 헤더 정리, 경량 응답 변환, protocol bridging |

핵심은 게이트웨이가 "모든 비즈니스 로직"을 가져가는 곳이 아니라는 점입니다.

공통 정책과 입구 제어는 게이트웨이에 두고,  
도메인 규칙과 핵심 데이터 처리 로직은 뒤쪽 서비스에 두는 편이 자연스럽습니다.

---

## 인증, 인가, 라우팅 감각

게이트웨이 문맥에서 자주 헷갈리는 것은 인증과 인가를 어디까지 앞단에서 할지입니다.

### 인증

앞단에서 비교적 자연스럽게 처리되는 편입니다.

- 토큰 존재 여부
- 토큰 서명 검증
- 만료 여부
- issuer / audience 확인

### 인가

세밀한 인가는 뒤쪽 서비스에 남는 경우가 많습니다.

예를 들어:

- "이 사용자가 로그인했는가"는 게이트웨이에서 확인 가능
- "이 사용자가 이 주문을 수정할 수 있는가"는 도메인 서비스가 더 잘 앎

즉, 좋은 답변은  
**게이트웨이는 신원 확인과 공통 정책, 서비스는 자원별 권한 판단**이라고 나누는 편이 좋습니다.

### 라우팅

라우팅은 단순 경로 매핑보다 더 넓게 설명할 수 있습니다.

- `/api/v1/*` → 기존 서비스
- `/api/v2/*` → 새 서비스
- 특정 테넌트만 canary 백엔드로 전환
- 내부 / 외부 API를 다른 백엔드로 분기

배포 전략과 연결하면 [배포 전략과 CI/CD (Deployment Strategies and CI/CD)](ci-cd-and-deployment.md) 의 canary와도 이어집니다.

---

## Rate Limit과 보호 계층

게이트웨이는 보호 계층으로 자주 사용됩니다.

대표 예시는 다음과 같습니다.

- 사용자별 요청 수 제한
- IP별 burst 제한
- API key별 quota와 봇성 트래픽 차단

좋은 답변은 "`429`를 반환합니다"에서 멈추지 않습니다.

- 기준 단위는 무엇인가
- 초당 제한과 분당 제한을 같이 둘 것인가
- 초과 시 바로 거절할지, queueing할지
- WAF와 어떤 식으로 역할을 나눌지

까지 설명하면 더 실무적입니다.

여기서는 **입구 계층에서 어떻게 집행할지**에 집중하고, 알고리즘 선택과 분산 카운터 설계는 [레이트 리미팅 (Rate Limiting)](../system-design/rate-limiting.md) 문서로 넘기는 편이 좋습니다.

---

## Aggregation과 BFF

게이트웨이에서 여러 백엔드 응답을 합치는 패턴도 자주 나옵니다.

대표 예시는 다음과 같습니다.

- 모바일 앱 홈 화면용 API
- 여러 마이크로서비스 데이터를 한 번에 묶는 조회
- 클라이언트 종류별 응답 최적화

이 경우 두 패턴이 자주 나옵니다.

- **Aggregation:** 게이트웨이나 별도 조합 계층이 여러 내부 호출 결과를 합침
- **BFF (Backend for Frontend):** 웹, 모바일 등 클라이언트별 최적화 백엔드 제공

다만 이 계층이 너무 뚱뚱해지면 문제가 생깁니다.

- 비즈니스 로직이 새어 들어옴
- 병목이 한 곳에 몰림
- 장애 전파 범위가 넓어짐

즉, 좋은 답변은  
**Edge에서 조합은 하되, 핵심 도메인 규칙까지 끌어오진 않는다**는 선을 갖는 편이 좋습니다.

---

## CDN, Reverse Proxy, Load Balancer와의 차이

| **구성 요소** | **주 역할** | **잘 맞는 경우** |
| --- | --- | --- |
| CDN | 정적 콘텐츠 캐싱, 지리적 분산, edge cache | 이미지, JS, CSS, 캐시 가능한 API |
| API Gateway | 공통 정책, 인증 연계, 라우팅, 보호 | 여러 API 앞단 제어 |
| Reverse Proxy | 요청 중계, 기본 라우팅, TLS 종료 | 단순 프록시, 내부 진입점 |
| Load Balancer | 여러 대상에 트래픽 분산 | 인스턴스 / 파드 분산 |

핵심은 "겹치는 기능이 있다"와 "같은 역할이다"를 구분하는 것입니다.

예를 들어:

- CDN도 일부 헤더 기반 제어를 할 수 있지만, 주 역할은 캐싱과 edge 분산[^cloudflare-cdn]
- API Gateway도 라우팅을 하지만, 주 역할은 정책과 보호 계층
- Load Balancer도 앞단에 있지만, 서비스 공통 정책의 중심은 아님

좋은 답변은  
**CDN은 캐시와 분산, Gateway는 정책과 보호, LB는 분산**으로 구분하면 충분합니다.

---

## Edge에서 처리하면 좋은 것과 아닌 것

### Edge에서 처리하면 좋은 것

- 토큰 기본 검증
- rate limit
- WAF 연계
- 기본 헤더 정리
- 지역 라우팅, 버전 라우팅, canary 라우팅

### Edge에서 과도하게 두면 안 좋은 것

- 복잡한 도메인 권한 로직
- 긴 동기 aggregation 체인
- DB 직접 조회
- 서비스별 상세 비즈니스 규칙

즉, Edge 계층은  
**앞단 공통 정책과 보호를 담당하되, 도메인 중심 애플리케이션 서버를 대체하지는 않는 편이 좋습니다**.

---

## 실무에서 자주 나는 실수

- 인증 검증과 자원별 인가를 모두 게이트웨이에서 해결하려고 함
- 레이트 리밋 기준이 사용자, 토큰, IP 중 무엇인지 불명확함
- 게이트웨이에 aggregation을 몰아넣어 새로운 병목을 만듦
- CDN과 Gateway 역할이 섞여 캐시 정책이 불명확해짐
- 공통 로깅은 넣었지만 tracing header 전파를 놓침
- 게이트웨이가 단일 장애점이 되는데 이중화와 관측성 준비가 부족함

---

## 트레이드오프

| **선택** | **장점** | **주의점** |
| --- | --- | --- |
| 게이트웨이에서 공통 정책 집중 | 인증, 로깅, rate limit을 일관되게 적용 가능 | 중앙 병목과 변경 영향 범위가 커질 수 있음 |
| Edge rate limit 강화 | 백엔드 보호와 비정상 트래픽 차단에 유리 | 정상 사용자까지 함께 제한될 수 있음 |
| BFF 분리 | 클라이언트별 응답 최적화가 쉬움 | 서비스 수와 운영 복잡도가 증가 |
| CDN 적극 활용 | 원본 부하와 지연을 줄이기 좋음 | 캐시 무효화와 역할 경계 관리가 필요 |

좋은 답변은 "게이트웨이를 둡니다"보다  
**무엇을 공통 계층으로 끌어올리고, 무엇은 서비스에 남길지 선을 긋는다**는 식이 더 좋습니다.

---

## 면접 포인트

- API Gateway는 단순 프록시가 아니라 공통 정책과 보호 계층으로 설명하는 편이 좋다.
- 인증은 앞단에서 일부 처리할 수 있지만, 세밀한 인가는 도메인 서비스가 더 잘 안다.
- 레이트 리밋은 기준 단위와 초과 시 동작까지 같이 말해야 실무 답변이 된다.
- CDN, API Gateway, Load Balancer는 기능이 일부 겹쳐도 중심 역할이 다르다.
- Edge 계층에 너무 많은 비즈니스 로직을 넣으면 중앙 병목과 복잡도가 커진다.

---

## 참고 자료

[^aws-apigw]: AWS Documentation, What is Amazon API Gateway? - https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html
[^cloudflare-cdn]: Cloudflare Learning Center, What is a CDN? - https://www.cloudflare.com/learning/cdn/what-is-a-cdn/
