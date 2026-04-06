---
title: 서버리스 (Serverless)
description: 서버리스 실행 모델, 콜드 스타트, 운영 트레이드오프를 살펴봅니다.
parent: 클라우드
nav_order: 4
---

# 서버리스 (Serverless)

## 목차

- [서버리스란](#서버리스란)
- [서버리스의 대표 모델](#서버리스의-대표-모델)
- [서버리스의 장점](#서버리스의-장점)
- [서버리스의 한계와 트레이드오프](#서버리스의-한계와-트레이드오프)
- [대규모 트래픽 환경에서의 서버리스](#대규모-트래픽-환경에서의-서버리스)
- [실무 운영 포인트](#실무-운영-포인트)
- [적합한 사용 사례](#적합한-사용-사례)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 서버리스란

**서버리스(Serverless)** 는 개발자가 서버 프로비저닝과 운영을 직접 관리하지 않고, 코드나 기능 단위를 실행하는 클라우드 운영 모델입니다.  
이름이 서버가 없다는 뜻은 아니고, **서버 관리를 클라우드 사업자가 추상화한다**는 의미에 가깝습니다.

서버리스를 설명할 때 보통 다음 특성이 같이 따라옵니다.

- 이벤트 기반 실행
- 자동 확장
- 사용량 기반 과금
- 무상태 실행 단위 중심 설계

---

## 서버리스의 대표 모델

### FaaS

**FaaS(Function as a Service)** 는 가장 대표적인 서버리스 모델입니다.

- 함수 단위로 코드를 배포합니다.
- 이벤트가 들어오면 실행됩니다.
- 실행 시간, 메모리, 동시성 같은 제약 안에서 동작합니다.

대표 예시는 AWS Lambda, Azure Functions, Google Cloud Functions입니다.

### BaaS

**BaaS(Backend as a Service)** 는 인증, 스토리지, 메시징, 데이터베이스 같은 백엔드 기능을 관리형 서비스로 소비하는 모델입니다.

즉, 실무에서 서버리스는 "Lambda만 쓴다"가 아니라 **FaaS + 관리형 서비스 조합**으로 구성되는 경우가 많습니다.

---

## 서버리스의 장점

- **운영 부담 감소:** 서버 패치, 오토스케일링, 인프라 프로비저닝 부담이 줄어듭니다.
- **빠른 출시:** 작은 기능 단위로 빠르게 배포할 수 있습니다.
- **비용 효율:** 유휴 시간이 많은 워크로드에서는 사용량 기반 과금이 유리할 수 있습니다.[^lambda-pricing]
- **자동 확장:** 요청 증가에 따라 실행 환경이 자동으로 늘어납니다.[^lambda-concurrency]
- **이벤트 중심 설계와 궁합:** S3 업로드, 큐 메시지 처리, 스케줄 잡처럼 이벤트 기반 업무와 잘 맞습니다.

---

## 서버리스의 한계와 트레이드오프

- **콜드 스타트:** 유휴 후 첫 호출에서 초기화 지연이 발생할 수 있습니다.
- **실행 시간 제한:** 장시간 실행 작업에는 부적합할 수 있습니다.
- **상태 관리 어려움:** 함수 자체는 무상태로 보는 것이 기본이므로 상태는 외부 저장소로 분리해야 합니다.
- **플랫폼 종속성:** 이벤트 모델, IAM, 배포 방식이 클라우드별로 다릅니다.
- **관측성 복잡도:** 함수 수가 많아지면 로그와 트레이싱이 흩어질 수 있습니다.
- **비용 역전 가능성:** 호출이 매우 많고 지속적인 고부하라면 서버리스가 항상 더 싸지는 않습니다.

서버리스는 "운영이 없어지는 기술"이 아니라, **운영의 종류가 바뀌는 기술**입니다. 인프라 대신 이벤트 흐름, 권한, 비용, 관측성이 더 중요해집니다.

---

## 대규모 트래픽 환경에서의 서버리스

서버리스는 대규모 트래픽을 자동으로 흡수할 수 있지만, 무한정 자유로운 것은 아닙니다.

- AWS Lambda는 동시성 모델을 기준으로 확장됩니다.[^lambda-concurrency]
- 계정/함수 단위 동시성 한도와 reserved concurrency, provisioned concurrency를 이해해야 합니다.[^lambda-concurrency][^lambda-reserved-concurrency]
- 호출량이 급증하면 함수는 빨리 늘어나지만, 뒤에 있는 DB나 외부 API가 그 속도를 못 버틸 수 있습니다.

즉, 대규모 트래픽 환경에서는 다음 질문이 더 중요합니다.

- Lambda가 아니라 **백엔드 의존성**이 병목 아닌가
- 콜드 스타트가 사용자 경험에 치명적인가
- 비동기 큐와 배치 윈도우로 완충할 수 있는가

---

## 실무 운영 포인트

- **멱등성(idempotency):** 중복 이벤트가 들어와도 안전하게 처리해야 합니다.[^lambda-best-practices]
- **연결 재사용:** DB 클라이언트나 SDK 클라이언트는 핸들러 밖에서 재사용하는 편이 일반적입니다.[^lambda-best-practices]
- **동시성 제어:** 장애 시 reserved concurrency를 조정해 과도한 확장을 막을 수 있습니다.[^lambda-best-practices][^lambda-reserved-concurrency]
- **비용 관측:** 호출 수, 실행 시간, 메모리 설정, provisioned concurrency 비용을 함께 봐야 합니다.
- **비동기 이벤트 소스 조합:** SQS, EventBridge, 스트림과 함께 설계하면 급격한 트래픽을 더 안정적으로 흡수할 수 있습니다.

---

## 적합한 사용 사례

- 이벤트 기반 후처리
- 이미지 리사이징, 파일 변환
- 간헐적 API 백엔드
- 스케줄성 잡
- 관리형 서비스 중심의 빠른 프로토타이핑

반대로 다음에는 신중해야 합니다.

- 매우 긴 실행 시간의 작업
- 초저지연이 항상 필요한 API
- 연결 유지형 애플리케이션
- 지속적으로 높은 부하가 발생하는 워크로드

---

## 면접 포인트

- **서버리스는 서버가 없는 것이 아니라 서버 관리가 추상화된 운영 모델입니다.**
- **장점은 운영 단순화와 자동 확장이지만, 콜드 스타트와 상태 관리 문제를 같이 말해야 합니다.**
- **대규모 트래픽에서 중요한 것은 Lambda 자체보다 뒤쪽 의존성의 병목과 동시성 제어입니다.**
- **idempotency, concurrency limit, 비용 관측을 함께 설명하면 실무형 답변이 됩니다.**
- **유휴가 많은 이벤트성 워크로드에는 강하지만, 항상 더 싸거나 더 빠른 것은 아닙니다.**

---

## 참고 자료

[^lambda-pricing]: AWS Lambda Pricing - https://aws.amazon.com/lambda/pricing/
[^lambda-concurrency]: AWS Lambda Docs, "Understanding Lambda function scaling and concurrency" - https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html
[^lambda-reserved-concurrency]: AWS Lambda Docs, "Configuring reserved concurrency for a function" - https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html
[^lambda-best-practices]: AWS Lambda Docs, "Best practices for working with AWS Lambda functions" - https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
