---
title: 직렬화 (Serialization)
description: JSON, Protocol Buffers, Avro 같은 포맷 선택과 호환성, 성능, 역직렬화 주의점을 다룹니다.
parent: 프로그래밍
nav_order: 9
---

# 직렬화 (Serialization)

## 목차

- [왜 이 주제를 묻는가](#왜-이-주제를-묻는가)
- [직렬화란](#직렬화란)
- [왜 포맷 선택이 중요한가](#왜-포맷-선택이-중요한가)
- [Text와 Binary 포맷](#text와-binary-포맷)
- [JSON, Protocol Buffers, Avro 비교](#json-protocol-buffers-avro-비교)
- [Schema Evolution과 호환성](#schema-evolution과-호환성)
- [간단한 호환성 예시](#간단한-호환성-예시)
- [Precision, Default, Null 함정](#precision-default-null-함정)
- [Payload 크기와 CPU 비용](#payload-크기와-cpu-비용)
- [역직렬화 보안 주의점](#역직렬화-보안-주의점)
- [자주 하는 실수](#자주-하는-실수)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 왜 이 주제를 묻는가

백엔드 면접에서 직렬화는  
"JSON으로 주고받습니다" 수준의 선택지가 아닙니다.

보통 다음을 같이 봅니다.

- **어떤 포맷이 계약에 맞는가**
- **얼마나 작은 payload와 낮은 CPU 비용이 필요한가**
- **오래된 클라이언트와 새 서버가 함께 동작할 수 있는가**
- **기본값, null, 필드 제거가 어떤 문제를 만드는가**

이 문서는 **백엔드 프로그래밍 관점에서 데이터 표현과 역직렬화의 비용, 호환성, 실수 포인트**를 설명합니다.  
gRPC와 `.proto` 운영은 [gRPC](../cloud/grpc.md), API 계약 관점은 [API 설계 (API Design)](../system-design/api-design.md), 네트워크 비용 관점은 [네트워크 I/O와 이벤트 루프 (Network I/O and Event Loop)](network-io-and-event-loop.md) 문서를 함께 보면 더 직접적입니다.

---

## 직렬화란

**직렬화(Serialization)** 는 메모리 안의 객체나 구조화된 데이터를  
네트워크 전송, 저장, 큐 전달에 맞는 바이트나 문자열 형태로 바꾸는 과정입니다.

반대로 **역직렬화(Deserialization)** 는 그 표현을 다시 프로그램이 다룰 수 있는 구조로 복원하는 과정입니다.

백엔드에서는 거의 모든 경계에서 직렬화가 등장합니다.

- HTTP API 응답 JSON 생성
- gRPC 메시지 인코딩
- Kafka 메시지 포맷 선택
- 캐시 값 저장
- 파일, 로그, 스냅샷 저장

좋은 답변은 "포맷을 안다"보다  
**데이터 경계마다 어떤 비용과 호환성 문제가 생기는지**를 설명하는 답변입니다.

---

## 왜 포맷 선택이 중요한가

직렬화 포맷은 단순한 문법 취향 문제가 아닙니다.

- **가독성:** 사람이 바로 읽을 수 있는가
- **성능:** 인코딩/디코딩 비용이 얼마나 드는가
- **크기:** 네트워크와 저장소 비용이 얼마나 드는가
- **호환성:** 오래된 생산자/소비자와 함께 갈 수 있는가
- **스키마 통제:** 타입과 필드 변경을 얼마나 엄격히 관리할 수 있는가

예를 들면:

- 공개 웹 API는 디버깅과 생태계 때문에 JSON이 자연스러울 수 있음
- 내부 서비스 간 고빈도 호출은 바이너리 포맷이 더 유리할 수 있음
- 이벤트 스트리밍에서는 schema evolution이 특히 중요할 수 있음

즉, 직렬화 포맷은 **계약, 비용, 운영 방식**을 함께 바꾸는 선택입니다.

---

## Text와 Binary 포맷

직렬화 포맷은 크게 text와 binary로 나눠 생각하면 정리가 쉽습니다.

| **항목** | **Text 포맷** | **Binary 포맷** |
| --- | --- | --- |
| 예시 | JSON | Protocol Buffers, Avro |
| 장점 | 읽기 쉽고 디버깅이 편함 | 크기가 작고 파싱 비용이 낮은 경우가 많음 |
| 주의점 | 크기가 커지고 타입 표현이 느슨할 수 있음 | 툴링 없이는 사람이 읽기 어려움 |
| 잘 맞는 경우 | 공개 API, 사람 친화적 계약 | 내부 서비스 통신, 고빈도 메시징 |

JSON은 RFC 8259에서 정의된 텍스트 기반 포맷입니다.[^rfc8259]  
반면 Protocol Buffers와 Avro는 스키마 기반 바이너리 직렬화에 더 자주 연결됩니다.[^protobuf-guide][^avro-spec]

좋은 답변은 "바이너리가 빠르다"보다  
**가독성과 디버깅 편의성 대신 무엇을 얻는가**를 설명하는 편이 좋습니다.

---

## JSON, Protocol Buffers, Avro 비교

| **항목** | **JSON** | **Protocol Buffers** | **Avro** |
| --- | --- | --- | --- |
| 스키마 강제력 | 약함 | 강함 | 강함 |
| 가독성 | 매우 좋음 | 낮음 | 낮음 |
| 크기/성능 | 상대적으로 불리할 수 있음 | 유리한 경우가 많음 | 유리한 경우가 많음 |
| 호환성 관리 | 애플리케이션 규칙에 의존 | 필드 번호와 스키마 규칙 중요 | writer/reader schema 해석이 중요 |
| 잘 맞는 경우 | 공개 API, 범용 웹 생태계 | 내부 RPC, 다중 언어 서비스 계약 | 이벤트 스트리밍, 데이터 파이프라인 |

MessagePack이나 CBOR 같은 포맷은 **JSON보다 더 작은 binary 표현이 필요하지만, Protobuf/Avro만큼 강한 스키마 관리까지는 원하지 않을 때** 대안이 될 수 있습니다. 즉, 이들은 schema-less 또는 schema-light한 binary 포맷이라는 위치로 이해하면 충분합니다.

### JSON

- **장점:** 사람이 읽기 쉽고 도구 지원이 넓습니다.
- **주의점:** 숫자, null, optional field 의미가 느슨해지기 쉽습니다.

### Protocol Buffers

- **장점:** `.proto`로 명시적 계약을 만들고 코드 생성과 잘 연결됩니다.
- **주의점:** 필드 번호 관리, presence, 기본값 처리 규칙을 이해해야 합니다.

### Avro

- **장점:** writer schema와 reader schema를 기준으로 schema evolution을 다루기 좋습니다.
- **주의점:** 스키마 해석과 호환성 규칙을 모르면 운영 중 데이터 해석이 엇갈릴 수 있습니다.

면접에서는 "무조건 Protobuf"보다  
**공개 API인지, 내부 RPC인지, 이벤트 스트림인지**를 먼저 나누는 편이 더 좋습니다.

---

## Schema Evolution과 호환성

직렬화에서 가장 어려운 문제 중 하나는 **새 버전과 옛 버전이 같이 살아가는 상황**입니다.

대표 질문은 다음과 같습니다.

- 필드를 추가해도 오래된 소비자가 버틸 수 있는가
- 필드를 제거하면 기존 생산자 데이터는 어떻게 읽는가
- 필드 이름이 아니라 번호나 스키마 해석 규칙이 중요한가

Protocol Buffers는 필드 번호를 기반으로 동작하므로,  
필드 번호 재사용이나 의미 변경은 특히 조심해야 합니다.[^protobuf-guide]

또한 protobuf 문서는 proto3 기본 타입에 `optional`을 명시하는 편이 더 매끄러운 진화 경로를 준다고 안내합니다.[^protobuf-presence]

Avro는 writer schema와 reader schema의 해석 규칙을 통해 schema resolution을 다룹니다.[^avro-spec]

좋은 답변은 "필드 추가는 쉽다"보다  
**어떤 변경이 하위 호환인지, 기본값과 presence가 어떻게 동작하는지**를 설명하는 답변입니다.

---

## 간단한 호환성 예시

면접에서는 추상 설명만 하기보다 아주 짧은 예시를 같이 말하면 답변이 더 강해집니다.

```proto
message UserProfile {
  string user_id = 1;
  optional string nickname = 2;
}
```

이후 새 버전에서 `nickname`을 추가했다고 가정하면:

- **새 서버 -> 옛 클라이언트:** 옛 클라이언트는 모르는 필드를 무시할 수 있어 비교적 안전
- **옛 서버 -> 새 클라이언트:** 새 클라이언트는 `nickname`이 없을 수 있음을 처리해야 함
- **주의점:** `2`번 필드를 다른 의미로 재사용하면 호환성이 깨질 수 있음

JSON에서도 비슷한 상황은 생기지만, 보통은 필드 존재 여부와 null 의미를 애플리케이션 규칙으로 더 많이 관리하게 됩니다.

---

## Precision, Default, Null 함정

직렬화 문제는 문법보다 **의미 손실**에서 더 자주 생깁니다.

대표 함정은 다음과 같습니다.

- **정수 정밀도:** 언어나 런타임에 따라 큰 정수가 손실될 수 있음
- **Default Value:** 기본값과 "값이 없음"이 구분되지 않을 수 있음
- **Null 의미:** null, 빈 문자열, 0, 필드 미존재가 서로 다른 의미를 가질 수 있음
- **Enum 진화:** 새 enum 값이 오래된 클라이언트에서 해석되지 않을 수 있음

예를 들어:

- `age = 0`이 진짜 0인지, 값이 없는 것인지
- `status = null`이 미설정인지, 명시적 비움인지
- 오래된 소비자가 새 필드를 무시해도 되는지

즉, 직렬화는 타입 시스템 바깥으로 나가는 순간  
**언어 내부의 의미가 그대로 보존되지 않을 수 있다**는 점을 염두에 둬야 합니다.

---

## Payload 크기와 CPU 비용

직렬화는 CPU와 네트워크 비용에도 직접 영향을 줍니다.

- payload가 크면 네트워크 전송 시간이 늘어남
- 파싱 비용이 크면 CPU 사용량이 증가
- 작은 응답도 QPS가 높으면 누적 비용이 커짐
- 압축과 직렬화 비용이 서로 영향을 줄 수 있음

그래서 다음 질문이 중요합니다.

- 사람이 읽는 편의성이 더 중요한가
- 초당 수만 건의 내부 호출 최적화가 더 중요한가
- 메시지가 작지만 매우 자주 오가는가
- 캐시와 로그까지 같은 포맷으로 통일할 것인가

좋은 답변은 "binary가 빠르다"가 아니라  
**payload 크기, CPU, 디버깅 비용 중 무엇을 우선하는지**를 말하는 편이 좋습니다.

---

## 역직렬화 보안 주의점

역직렬화는 보안 관점에서도 조심해야 합니다.

신뢰할 수 없는 입력을 곧바로 객체로 복원하면 다음 문제가 생길 수 있습니다.

- 예상하지 못한 타입 생성
- 메모리 폭주
- 매우 큰 payload로 인한 자원 고갈
- 특정 포맷에서는 임의 코드 실행 위험

Python 문서도 `pickle`은 신뢰할 수 없는 데이터를 역직렬화하는 데 안전하지 않다고 명시합니다.[^python-pickle]

즉, 좋은 답변은 "역직렬화합니다"가 아니라  
**신뢰 경계 밖 입력에는 안전한 포맷과 검증 계층을 둔다**는 쪽입니다.

---

## 자주 하는 실수

- 공개 API와 내부 RPC에 같은 포맷 기준을 무조건 적용함
- 기본값과 필드 미존재를 같은 뜻으로 취급함
- protobuf에서 필드 번호 진화를 가볍게 봄
- schema evolution 규칙 없이 이벤트 포맷을 자주 바꿈
- 큰 정수, 시간, null 의미를 언어별로 확인하지 않음
- 신뢰할 수 없는 입력을 위험한 포맷으로 역직렬화함

---

## 면접 포인트

- **직렬화는 데이터 표현 형식 선택이 아니라, 계약과 비용과 호환성을 정하는 문제입니다.**
- **JSON은 가독성과 생태계가 강하고, Protocol Buffers와 Avro는 스키마 통제가 강한 편입니다.**
- **좋은 답변은 포맷 이름보다 공개 API, 내부 RPC, 이벤트 스트림의 맥락을 먼저 나눕니다.**
- **기본값, null, presence, schema evolution은 면접에서 꼬리질문이 붙기 좋은 지점입니다.**
- **역직렬화는 성능뿐 아니라 보안 문제도 만들 수 있다는 점까지 말하면 답변이 강해집니다.**

---

## 참고 자료

[^rfc8259]: RFC 8259, "The JavaScript Object Notation (JSON) Data Interchange Format" - https://www.rfc-editor.org/rfc/rfc8259
[^protobuf-guide]: Protocol Buffers Documentation - https://protobuf.dev/
[^protobuf-presence]: Protocol Buffers Documentation, "Application Note: Field Presence" - https://protobuf.dev/programming-guides/field_presence/
[^avro-spec]: Apache Avro Specification - https://avro.apache.org/docs/current/specification/
[^python-pickle]: Python Documentation, `pickle` module - https://docs.python.org/3/library/pickle.html
