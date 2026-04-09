---
title: 로깅 및 모니터링 (Logging & Monitoring)
description: 로그, 메트릭, 트레이싱으로 분산 시스템을 관측하는 방법을 다룹니다.
parent: 클라우드
nav_order: 16
---

# 로깅 및 모니터링 (Logging & Monitoring)

## 목차

- [왜 로깅과 모니터링이 중요한가](#왜-로깅과-모니터링이-중요한가)
- [로그, 메트릭, 트레이스](#로그-메트릭-트레이스)
- [MSA 환경에서 어려운 점](#msa-환경에서-어려운-점)
- [중앙 수집과 상관관계](#중앙-수집과-상관관계)
- [대표 도구와 역할](#대표-도구와-역할)
- [운영 시 주의점](#운영-시-주의점)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 왜 로깅과 모니터링이 중요한가

분산 시스템에서는 장애를 "재현"하기보다 **관측(observability)** 으로 추적하는 경우가 많습니다.  
특히 마이크로서비스 환경에서는 하나의 요청이 여러 서비스와 인프라를 거치기 때문에, 단일 서버 로그만 봐서는 원인을 찾기 어렵습니다.

그래서 운영에서는 보통 다음 질문에 답할 수 있어야 합니다.

- 지금 무엇이 실패하고 있는가
- 어느 서비스에서 지연이 시작됐는가
- 문제의 범위가 특정 인스턴스인지, 전체 시스템인지
- 최근 배포와 연관이 있는가

---

## 로그, 메트릭, 트레이스

관측성은 보통 세 가지 신호로 설명합니다. OpenTelemetry도 이 세 신호를 핵심으로 다룹니다.[^otel-what][^otel-logs]

| **신호** | **설명** | **주로 답하는 질문** |
| --- | --- | --- |
| 로그(Log) | 시점별 이벤트 기록 | 무슨 일이 있었는가 |
| 메트릭(Metric) | 시간에 따른 수치 집계 | 얼마나 느리고, 얼마나 많이 실패하는가 |
| 트레이스(Trace) | 요청 흐름과 구간별 지연 | 어디서 느려졌는가 |

- **로그:** 예외, 비즈니스 이벤트, 디버깅 정보
- **메트릭:** QPS, latency, error rate, CPU, 메모리
- **트레이스:** 요청이 서비스 A, B, C를 어떻게 통과했는지

핵심은 셋 중 하나만으로는 부족하다는 점입니다.  
예를 들어 메트릭이 지연 증가를 알려주고, 트레이스가 병목 구간을 찾고, 로그가 실제 에러 원인을 설명하는 식으로 함께 작동합니다.

---

## MSA 환경에서 어려운 점

MSA에서는 다음 문제가 흔합니다.

- **로그 분산:** 서비스별 인스턴스마다 로그가 흩어집니다.
- **지연 원인 추적 어려움:** 장애가 호출 체인을 따라 전파됩니다.
- **컨텍스트 단절:** 같은 요청인데 서비스마다 서로 다른 로그처럼 보일 수 있습니다.
- **동적 인프라:** 오토스케일링과 컨테이너 재기동으로 인스턴스가 계속 바뀝니다.

그래서 단순히 "로그를 남긴다"가 아니라, **공통 request ID, trace ID, resource metadata**를 같이 남기는 설계가 중요합니다.[^otel-logs][^otel-context]

---

## 중앙 수집과 상관관계

운영에서 중요한 것은 데이터 양보다 **서로 연결할 수 있는가**입니다.

- **중앙 수집:** 여러 서비스 로그와 메트릭을 한곳으로 모읍니다.
- **구조화 로그:** JSON 같은 포맷으로 남겨 검색과 필터링을 쉽게 합니다.
- **컨텍스트 전파:** trace id, span id, request id를 함께 전달합니다.[^otel-context]
- **상관관계 분석:** 같은 요청을 로그, 메트릭, 트레이스로 엮어 볼 수 있어야 합니다.

OpenTelemetry는 이런 상관관계를 위한 공통 계층으로 많이 쓰입니다. 애플리케이션에서 telemetry를 수집하고, Collector를 통해 가공·전달할 수 있습니다.[^otel-docs][^otel-ops]

---

## 대표 도구와 역할

| **분류** | **대표 도구** | **주요 역할** |
| --- | --- | --- |
| 로깅 | ELK, Loki, Graylog | 로그 수집, 저장, 검색 |
| 메트릭 | Prometheus | 시계열 메트릭 수집과 조회 |
| 시각화 | Grafana | 대시보드와 알림 |
| 트레이싱 | Jaeger, Tempo | 요청 흐름 추적 |
| 수집 계층 | OpenTelemetry Collector | 로그, 메트릭, 트레이스 수집·가공·전송 |

Prometheus는 메트릭 수집과 PromQL 기반 조회에 강하고,[^promql]  
Grafana는 여러 데이터 소스를 묶어 대시보드와 알림을 구성하는 데 많이 사용됩니다.

---

## 운영 시 주의점

- **과도한 로그:** 너무 많이 남기면 저장 비용과 검색 비용이 급격히 증가합니다.
- **민감정보 마스킹:** 토큰, 비밀번호, 개인정보는 로그에 남기면 안 됩니다.
- **고카디널리티 메트릭:** `user_id` 같은 라벨을 메트릭에 넣으면 시계열 수가 폭증할 수 있습니다.
- **샘플링 전략:** 모든 트레이스를 저장할지, 일부만 저장할지 결정해야 합니다.
- **알림 피로도:** 알림을 너무 많이 만들면 실제 중요한 신호를 놓칩니다.
- **SLO 기준:** 단순 CPU 사용률보다 사용자 영향 중심의 latency, error budget 지표가 더 중요할 때가 많습니다.

---

## 면접 포인트

- **로깅, 메트릭, 트레이스는 서로 대체 관계가 아니라 보완 관계입니다.**
- **MSA에서는 중앙 수집보다도 trace ID 같은 상관관계 설계가 중요합니다.**
- **OpenTelemetry는 vendor-neutral observability 계층으로 설명하면 좋습니다.**
- **메트릭은 이상 징후 탐지, 로그는 원인 분석, 트레이스는 호출 경로 추적에 강합니다.**
- **실무형 답변에서는 structured logging, context propagation, alert fatigue, high cardinality 같은 운영 포인트를 같이 말해야 합니다.**

---

## 참고 자료

[^otel-what]: [OpenTelemetry Docs, "What is OpenTelemetry?"](https://opentelemetry.io/docs/what-is-opentelemetry/)
[^otel-docs]: [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
[^otel-ops]: [OpenTelemetry Docs, "Getting started for Ops"](https://opentelemetry.io/docs/getting-started/ops/)
[^otel-logs]: [OpenTelemetry Docs, "OpenTelemetry Logging"](https://opentelemetry.io/docs/specs/otel/logs/)
[^otel-context]: [OpenTelemetry Docs, "Context propagation"](https://opentelemetry.io/docs/concepts/context-propagation/)
[^promql]: [Prometheus Docs, "Querying basics"](https://prometheus.io/docs/prometheus/latest/querying/basics/)
