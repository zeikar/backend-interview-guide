---
title: 오토스케일링과 용량 계획 (Autoscaling and Capacity Planning)
description: 오토스케일링 기준, 병목 지표, 용량 계획을 설명할 때 핵심 포인트를 정리했습니다.
parent: 클라우드
nav_order: 9
---

# 오토스케일링과 용량 계획 (Autoscaling and Capacity Planning)

## 목차

- [오토스케일링과 용량 계획을 왜 같이 묻는가](#오토스케일링과-용량-계획을-왜-같이-묻는가)
- [오토스케일링이란](#오토스케일링이란)
- [Scale Up vs Scale Out](#scale-up-vs-scale-out)
- [무엇을 기준으로 스케일할 것인가](#무엇을-기준으로-스케일할-것인가)
- [HPA, VPA, Cluster Autoscaler 감각](#hpa-vpa-cluster-autoscaler-감각)
- [피크 트래픽 대응 전략](#피크-트래픽-대응-전략)
- [Cooldown, Thrashing, 최소 여유 용량](#cooldown-thrashing-최소-여유-용량)
- [용량 계획의 기본 질문](#용량-계획의-기본-질문)
- [비용과 가용성 트레이드오프](#비용과-가용성-트레이드오프)
- [실무에서 자주 보는 실수](#실무에서-자주-보는-실수)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 오토스케일링과 용량 계획을 왜 같이 묻는가

백엔드 면접에서 이 주제는 "오토스케일링을 켜면 끝나는가"를 보는 질문이 아닙니다.

보통은 다음 질문으로 이어집니다.

- 무엇을 기준으로 늘리고 줄이는가
- 피크 트래픽 전에 미리 올릴 것인가, 반응형으로 올릴 것인가
- 스케일링이 너무 자주 일어나면 어떻게 막는가
- 비용을 아끼면서도 장애를 막으려면 어느 정도 여유 용량을 둘 것인가

즉, 이 문서의 핵심은  
**오토스케일링을 기능이 아니라 운영 정책으로 설명할 수 있는가**입니다.

시스템 전체 확장성 관점은 [확장성 (Scalability)](../system-design/scalability.md),  
배포와 운영 자동화 관점은 [배포 전략과 CI/CD (Deployment Strategies and CI/CD)](ci-cd-and-deployment.md),  
플랫폼 관점은 [Kubernetes](kubernetes.md) 와 같이 보면 연결이 좋습니다.

---

## 오토스케일링이란

오토스케일링은 워크로드의 상태를 보고 인프라나 애플리케이션 리소스를 자동으로 조정하는 방식입니다.

보통 다음 축으로 나눠 설명하면 충분합니다.

- 애플리케이션 인스턴스 수를 늘리거나 줄이는가
- 노드 자체 수를 늘리거나 줄이는가
- 한 인스턴스의 CPU / 메모리 크기를 조정하는가

좋은 답변은 "CPU 70% 넘으면 늘립니다"보다  
**어떤 병목을 어떤 신호로 감지해서 어느 층을 늘릴지**를 말하는 편이 낫습니다.

---

## Scale Up vs Scale Out

| **방식** | **의미** | **장점** | **주의점** |
| --- | --- | --- | --- |
| Scale Up | 한 인스턴스의 CPU / 메모리 / 스펙을 키움 | 구조 변경이 적고 단순함 | 한계가 분명하고 단일 실패점이 커질 수 있음 |
| Scale Out | 인스턴스 수를 늘려 분산 처리 | 가용성과 확장성이 좋음 | 무상태화, 세션 처리, 분산 운영이 필요 |

### Scale Up

scale up은 빠르게 대응하기 쉽습니다.

- 작은 서비스의 초기 대응
- DB 인스턴스 스펙 상향
- 캐시 노드 메모리 확대

다만 면접에서는 scale up만으로 버티는 구조의 한계도 같이 말해야 합니다.

- 장비 상한이 있음
- 교체나 재시작 때 영향 범위가 큼
- 병목이 애플리케이션 구조에 있으면 스펙만 올려도 해결되지 않음

### Scale Out

scale out은 분산 전제를 더 많이 요구하지만, 운영상 더 일반적인 방향입니다.

- stateless 애플리케이션 서버 증설
- queue consumer 수평 확장
- read replica 추가

좋은 답변은 "스케일 아웃이 더 좋다"가 아니라  
**애플리케이션 계층은 scale out, 상태 저장 계층은 scale up과 scale out을 함께 검토한다**는 식이 자연스럽습니다.

---

## 무엇을 기준으로 스케일할 것인가

스케일링 신호는 단순할수록 좋지만, 병목과 연결되어야 의미가 있습니다.

대표 신호는 다음과 같습니다.

- **CPU 사용률:** 계산 집약적 워크로드에 자연스러움
- **메모리 사용률:** 캐시, 런타임 메모리 압박 감지에 도움
- **요청 수 / 동시성:** HTTP 서버와 API 게이트웨이에 자주 사용
- **지연 시간(latency):** 사용자 체감 품질과 연결됨
- **큐 길이(queue length):** 비동기 worker 확장에 적합
- **에러율 / 드롭률:** 단독 기준으로는 거칠지만 보호 신호로 유용

핵심은 **병목이 어디인지에 맞는 신호를 고르는 것**입니다.

예를 들어:

- API 서버는 CPU보다 p95 latency나 in-flight request가 더 나은 경우가 있음
- 배치 worker는 CPU보다 queue backlog가 더 직접적일 수 있음
- DB는 단순 CPU보다 connection saturation, lock wait, IOPS가 더 중요할 수 있음

면접에서는 "`CPU 70%`" 같은 숫자를 외우기보다  
**이 워크로드의 병목이 CPU인지, I/O인지, 대기열인지 먼저 본다**고 설명하는 편이 좋습니다.

---

## HPA, VPA, Cluster Autoscaler 감각

Kubernetes 문맥에서는 이 세 가지를 같이 구분할 줄 알아야 합니다.

| **구성 요소** | **무엇을 조정하는가** | **주 용도** |
| --- | --- | --- |
| HPA | 파드 수 | stateless 앱, worker 수평 확장 |
| VPA | 파드 요청 자원 | request/limit 재조정, 권장치 제공 |
| Cluster Autoscaler | 노드 수 | 파드가 배치될 노드 용량 확보 |

### HPA

HPA(Horizontal Pod Autoscaler)는 파드 수를 늘리고 줄입니다.[^k8s-hpa]

- CPU / 메모리 기반
- custom metric 기반
- queue lag, request rate 같은 외부 지표 연계 가능

웹 애플리케이션과 worker는 보통 HPA가 가장 먼저 나옵니다.

### VPA

VPA(Vertical Pod Autoscaler)는 파드의 요청 자원을 조정합니다.[^k8s-vpa]

장점:

- 잘못 잡은 request/limit를 보정하기 좋음
- 자원 낭비를 줄이는 데 도움

주의점:

- 재시작이 필요할 수 있음
- HPA와 동시에 쓸 때 충돌하지 않게 범위를 정해야 함

### Cluster Autoscaler

Cluster Autoscaler는 노드 자체를 조정합니다.[^k8s-ca]

예를 들어 HPA가 파드를 늘렸는데 빈 노드가 없다면,  
문제는 파드 수가 아니라 클러스터 용량입니다.

좋은 답변은 세 요소를 따로 외우는 것이 아니라  
**파드 수, 파드 크기, 노드 수가 서로 다른 층의 문제**라고 구분하는 편이 좋습니다.

---

## 피크 트래픽 대응 전략

오토스케일링은 반응형이라서, 이미 늦은 뒤에 늘어나는 문제가 있습니다.

그래서 피크 트래픽 대응은 다음 방식을 같이 봅니다.

- **예측 기반 사전 증설:** 이벤트, 마케팅, 정기 배치 전에 미리 올림
- **버퍼 용량 유지:** 최소 replica와 최소 노드 수를 충분히 둠
- **큐 완충:** 갑작스러운 입력을 비동기 처리로 흡수
- **캐시 / CDN 활용:** 원본 계층 부하를 줄임

좋은 운영은 "오토스케일링이 있으니 괜찮다"가 아니라  
**예측 가능한 피크는 미리 대비하고, 예측 불가능한 피크는 자동 대응으로 받는다**는 구조입니다.

관련 캐시 관점은 [캐싱 전략 (Caching Strategy)](../system-design/caching-strategy.md),  
Edge 계층 관점은 [API Gateway와 Edge 패턴 (API Gateway and Edge Patterns)](api-gateway-and-edge-patterns.md) 문서와 같이 보면 좋습니다.

---

## Cooldown, Thrashing, 최소 여유 용량

스케일링이 너무 민감하면 오히려 시스템이 흔들립니다.

대표 문제가 다음과 같습니다.

- **Cooldown 부족:** 잠깐 튄 지표에 바로 반응했다가 다시 줄어듦
- **Thrashing:** 늘렸다 줄였다를 반복하면서 오히려 불안정해짐
- **Cold Start 비용:** 새 인스턴스가 준비되기 전에 이미 지연이 커짐

실무에서는 다음 감각이 중요합니다.

- scale out과 scale in 조건을 완전히 같게 두지 않음
- 충분한 stabilization window를 둠
- 최소 replica와 최소 노드 수를 너무 공격적으로 줄이지 않음
- readiness가 끝나기 전에는 트래픽을 받지 않게 함

즉, 오토스케일링은 빠를수록 좋은 것이 아니라  
**너무 늦지 않으면서도, 너무 민감하지 않게 조정하는 문제**입니다.

---

## 용량 계획의 기본 질문

용량 계획은 오토스케일링을 보완하는 상위 개념입니다.

보통 다음 질문으로 시작합니다.

- 평시 QPS / TPS는 어느 정도인가
- 피크 시 몇 배까지 튀는가
- 평균이 아니라 p95 / p99 구간은 어떤가
- CPU, 메모리, 네트워크, DB connection 중 무엇이 먼저 포화되는가
- 장애 상황에서 한 AZ나 한 노드가 빠져도 버틸 수 있는가

좋은 답변은 "오토스케일링이 있으니 용량 계획은 대략 잡습니다"가 아닙니다.

오히려 다음이 중요합니다.

- 기준 부하를 측정
- 병목 자원을 파악
- 목표 여유율을 정함
- 장애 상황을 포함한 최소 용량을 계산

면접에서는 "추측보다 측정"이라는 태도가 좋습니다.

- 부하 테스트 결과
- 실제 트래픽 추이
- 과거 피크 데이터
- 장애 시 축소된 용량에서도 버티는지

를 기준으로 설명하면 더 실무형 답변이 됩니다.

---

## 비용과 가용성 트레이드오프

오토스케일링은 비용 절감 수단이기도 하지만, 너무 비용만 보면 가용성이 무너질 수 있습니다.

| **선택** | **장점** | **주의점** |
| --- | --- | --- |
| 최소 replica 축소 | 평시 비용 절감 | 피크 대응이 늦고 장애 여유가 줄어듦 |
| aggressive scale-in | 유휴 자원 감소 | thrashing과 cold start 위험 증가 |
| 큰 인스턴스 위주 구성 | 운영 단순화 | 실패 영향 범위와 단가 증가 |
| 많은 소형 인스턴스 | 분산과 탄력성 유리 | 관리 대상과 네트워크 오버헤드 증가 |

좋은 답변은 "비용을 줄입니다"보다  
**어디까지는 항상 켜 두고, 어디부터 자동 확장으로 넘길지 기준을 둔다**고 설명하는 편이 좋습니다.

---

## 실무에서 자주 보는 실수

- CPU만 보고 스케일링해서 실제 병목인 DB connection 포화를 놓침
- scale-in을 너무 빠르게 잡아 트래픽이 출렁일 때 thrashing 발생
- HPA는 늘리는데 Cluster Autoscaler가 늦어 파드가 pending 상태로 오래 머묾
- readiness 이전에 트래픽을 받아 cold start 구간에서 장애 체감 증가
- 피크 트래픽을 "오토스케일링이 알아서 해결"할 것이라고 가정
- 비용 최적화에 치우쳐 최소 여유 용량을 과도하게 줄임

---

## 면접 포인트

- 오토스케일링은 지표 하나가 아니라 병목과 연결된 신호 선택의 문제다.
- 애플리케이션 수, 파드 자원, 노드 수는 서로 다른 층의 스케일링이다.
- 예측 가능한 피크는 사전 증설, 예측 불가능한 피크는 자동 확장으로 받는 편이 자연스럽다.
- scale-in은 scale-out보다 더 보수적으로 잡는 경우가 많다.
- 비용 절감과 장애 여유는 항상 같이 봐야 한다.

---

## 참고 자료

[^k8s-hpa]: Kubernetes Documentation, Horizontal Pod Autoscaling - https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
[^k8s-vpa]: Kubernetes Autoscaler, Vertical Pod Autoscaler - https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler
[^k8s-ca]: Kubernetes Documentation, Cluster Autoscaler - https://kubernetes.io/docs/concepts/cluster-administration/node-autoscaling/
