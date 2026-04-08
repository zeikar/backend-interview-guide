---
title: gRPC (Google Remote Procedure Call)
description: gRPC의 동작 방식, HTTP/2와 Protocol Buffers, 서비스 간 통신 설계를 살펴봅니다.
parent: 클라우드
nav_order: 14
---

# gRPC (Google Remote Procedure Call)

## 목차

- [gRPC란](#grpc란)
- [gRPC의 핵심 구성 요소](#grpc의-핵심-구성-요소)
- [RPC 호출 방식](#rpc-호출-방식)
- [gRPC가 빠른 이유](#grpc가-빠른-이유)
- [REST와의 차이](#rest와의-차이)
- [gRPC 사용 시 주의점](#grpc-사용-시-주의점)
- [적합한 사용 사례](#적합한-사용-사례)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## gRPC란

**gRPC** 는 Google이 시작한 고성능 RPC 프레임워크로, 여러 환경과 언어에서 서비스 간 호출을 효율적으로 만들기 위한 기술입니다.[^grpc-home]  
핵심은 "HTTP API를 설계한다"보다 **원격 함수를 정의하고 호출한다**는 모델에 가깝습니다.

이 문서는 **RPC 계약과 전송 모델**에 집중합니다. JSON, Protocol Buffers, Avro 같은 포맷 자체의 선택과 호환성 문제는 [직렬화 (Serialization)](../programming/serialization.md) 문서가 더 직접적인 심화 자료입니다.

예를 들어 REST에서는 `/users/123` 같은 리소스 중심으로 접근하지만, gRPC에서는 `GetUser`, `CreateOrder` 같은 RPC 메서드를 정의해 호출합니다.

---

## gRPC의 핵심 구성 요소

- **Protocol Buffers:** 서비스와 메시지 스키마를 `.proto` 파일로 정의합니다.[^grpc-intro]
- **Code Generation:** `protoc`와 gRPC 플러그인으로 클라이언트/서버 코드를 생성합니다.[^grpc-intro]
- **HTTP/2 Transport:** 멀티플렉싱, 스트리밍, 헤더 압축 같은 기능을 활용합니다.[^grpc-home]
- **Channel / Credentials:** 연결 단위 설정과 인증 정보를 붙이는 기본 모델입니다.[^grpc-auth]

gRPC를 설명할 때 중요한 포인트는, **직렬화 포맷과 인터페이스 정의가 코드 생성까지 연결되는 체계**라는 점입니다.

---

## RPC 호출 방식

gRPC는 네 가지 호출 방식을 지원합니다.[^grpc-intro]

| **방식** | **설명** | **적합한 경우** |
| --- | --- | --- |
| Unary | 요청 1개, 응답 1개 | 일반적인 서비스 호출 |
| Server Streaming | 요청 1개, 응답 여러 개 | 대량 조회, 피드 스트리밍 |
| Client Streaming | 요청 여러 개, 응답 1개 | 로그 업로드, 센서 데이터 전송 |
| Bidirectional Streaming | 요청/응답 모두 스트리밍 | 채팅, 실시간 협업 |

REST와 비교했을 때 gRPC가 자주 거론되는 이유도 이 스트리밍 모델 때문입니다. 특히 서비스 간 장시간 연결이나 양방향 데이터 흐름에서는 gRPC가 더 자연스럽습니다.

---

## gRPC가 빠른 이유

gRPC가 일반적으로 빠르다고 말하는 이유는 다음 두 가지가 결합되기 때문입니다.

- **바이너리 직렬화:** Protocol Buffers는 JSON보다 더 작고 파싱 비용이 낮은 경우가 많습니다.[^grpc-intro]
- **HTTP/2 기반 전송:** 하나의 연결에서 여러 요청을 동시에 처리하고 스트리밍을 효율적으로 다룰 수 있습니다.[^grpc-home]

다만 "항상 REST보다 빠르다"처럼 절대적으로 표현하기보다는, 워크로드와 운영 환경에 따라 달라진다고 설명하는 편이 좋습니다.

Protocol Buffers의 기본값, presence, schema evolution 같은 세부 포맷 이슈는 [직렬화 (Serialization)](../programming/serialization.md) 문서를 같이 보면 연결이 좋습니다.

- 작은 요청/응답 위주의 단순 공개 API는 REST가 충분히 낫고,
- 성능 차이보다 조직의 운영 편의성과 디버깅 경험이 더 중요할 때도 많습니다.

---

## REST와의 차이

| **항목** | **gRPC** | **REST** |
| --- | --- | --- |
| 인터페이스 모델 | RPC 메서드 중심 | 리소스 중심 |
| 데이터 포맷 | 보통 Protocol Buffers | 보통 JSON |
| 전송 | HTTP/2 기반이 일반적 | HTTP/1.1, HTTP/2 모두 가능 |
| 스트리밍 | 기본 지원 | 별도 설계 필요 |
| 브라우저 친화성 | 제한적 | 매우 좋음 |
| 내부 서비스 통신 | 강함 | 많이 사용되지만 비효율적일 수 있음 |

실무에서 자주 나오는 구분은 이렇습니다.

- **외부 공개 API:** REST가 더 단순하고 디버깅/문서화가 쉽습니다.
- **내부 서비스 간 통신:** gRPC가 타입 안정성과 성능 면에서 유리할 수 있습니다.

즉, 둘은 경쟁 기술이라기보다 **적용 레이어가 다른 경우가 많습니다.**

---

## gRPC 사용 시 주의점

- **브라우저 제약:** 일반 브라우저 환경에서는 gRPC를 직접 쓰기 어렵고, 보통 gRPC-Web 같은 추가 계층이 필요합니다.
- **디버깅 난이도:** JSON보다 사람이 바로 읽기 어렵기 때문에 툴링 의존도가 높습니다.
- **스키마 관리:** `.proto` 변경 시 하위 호환성을 신경 써야 합니다.
- **인증/보안:** gRPC는 TLS를 강하게 권장하지만, 모든 gRPC 연결이 무조건 TLS만 가능한 것은 아닙니다. 채널 credential, call credential, TLS, ALTS 등 여러 인증 메커니즘이 있습니다.[^grpc-auth]
- **스트리밍 운영:** 스트리밍 RPC는 flow control, timeout, cancellation, backpressure를 함께 고려해야 합니다.[^grpc-flow-control]

---

## 적합한 사용 사례

- **마이크로서비스 내부 통신**
- **고빈도 저지연 API 호출**
- **실시간 스트리밍**
- **다중 언어 서비스 간 인터페이스 통일**

반대로 다음 상황에서는 REST가 더 낫습니다.

- 브라우저에서 바로 호출해야 하는 공개 API
- 사람이 curl이나 브라우저로 쉽게 테스트해야 하는 환경
- JSON 중심 생태계와 문서화 도구가 더 중요한 경우

---

## 면접 포인트

- **gRPC는 Protocol Buffers + 코드 생성 + HTTP/2 기반 RPC 프레임워크로 설명하는 것이 깔끔합니다.**
- **성능 장점은 바이너리 직렬화와 HTTP/2에서 오지만, 무조건 REST보다 빠르다고 단정하면 안 됩니다.**
- **내부 서비스 통신에는 강하지만, 외부 공개 API는 REST가 더 자연스러운 경우가 많습니다.**
- **스트리밍과 타입 안정성이 gRPC의 큰 강점입니다.**
- **보안은 TLS를 자주 쓰지만, 인증 메커니즘은 그것만 있는 것이 아니라는 점도 알고 있어야 합니다.**

---

## 참고 자료

[^grpc-home]: gRPC - https://grpc.io/
[^grpc-intro]: gRPC Docs, "Introduction to gRPC" - https://grpc.io/docs/what-is-grpc/introduction/
[^grpc-auth]: gRPC Docs, "Authentication" - https://grpc.io/docs/guides/auth/
[^grpc-flow-control]: gRPC Docs, "Flow Control" - https://grpc.io/docs/guides/flow-control/
