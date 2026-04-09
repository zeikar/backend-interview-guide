---
title: Kubernetes
description: Kubernetes 핵심 개념과 운영 포인트를 백엔드 면접 관점에서 살펴봅니다.
parent: 클라우드
nav_order: 3
---

# Kubernetes

## 목차

- [Kubernetes란](#kubernetes란)
- [왜 Kubernetes를 쓰는가](#왜-kubernetes를-쓰는가)
- [핵심 구성 요소](#핵심-구성-요소)
- [핵심 오브젝트](#핵심-오브젝트)
- [배포와 운영에서 중요한 포인트](#배포와-운영에서-중요한-포인트)
- [Kubernetes의 장점](#kubernetes의-장점)
- [Kubernetes의 한계와 주의점](#kubernetes의-한계와-주의점)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## Kubernetes란

**Kubernetes(K8s)** 는 컨테이너화된 워크로드와 서비스를 자동으로 배포, 확장, 운영하기 위한 오픈소스 오케스트레이션 플랫폼입니다.[^k8s-overview]

핵심은 "컨테이너를 실행한다"가 아니라, **원하는 상태(desired state)를 선언하고 시스템이 그 상태를 맞추도록 한다**는 점입니다.[^k8s-objects]

예를 들어 운영자는 "이 서비스는 파드 3개로 항상 살아 있어야 한다"라고 선언하고, Kubernetes는 장애가 나도 그 상태를 복구하려고 동작합니다.

---

## 왜 Kubernetes를 쓰는가

- **자동화된 운영:** 배포, 복구, 스케일링을 자동화하기 쉽습니다.
- **컨테이너 표준화:** 여러 서비스의 배포 방식을 하나의 플랫폼 위로 맞출 수 있습니다.
- **복구 능력:** 파드가 죽으면 다시 띄우고, 노드 장애에도 워크로드를 재스케줄링할 수 있습니다.
- **서비스 추상화:** 파드가 바뀌어도 Service 추상화를 통해 안정적으로 접근할 수 있습니다.[^k8s-service]
- **플랫폼 일관성:** 온프레미스와 클라우드 환경을 어느 정도 같은 모델로 다룰 수 있습니다.

---

## 핵심 구성 요소

Kubernetes 클러스터는 크게 **control plane** 과 **worker node** 로 나뉩니다.[^k8s-overview]

### Control Plane

- **API Server:** 클러스터 상태를 바꾸는 모든 요청의 진입점
- **Scheduler:** 새 파드를 어느 노드에 올릴지 결정
- **Controller Manager:** desired state와 actual state 차이를 계속 맞춤
- **etcd:** 클러스터 상태 저장소

### Worker Node

- **Kubelet:** 노드에서 파드 상태를 유지하는 에이전트
- **Container Runtime:** 실제 컨테이너 실행 계층
- **kube-proxy / CNI 계층:** 서비스 네트워킹과 트래픽 전달

운영 관점에서는 API Server를 통해 선언하고, 컨트롤러와 스케줄러가 그 선언을 현실 상태에 반영하는 구조라고 보면 됩니다.

---

## 핵심 오브젝트

### Pod

Kubernetes의 가장 작은 배포 단위입니다. 하나 이상의 컨테이너가 네트워크와 스토리지를 공유합니다.

### Deployment

무상태(stateless) 애플리케이션 배포의 기본 오브젝트입니다. 보통 직접 Pod를 만들기보다 Deployment를 사용합니다.[^k8s-config]

### Service

파드 집합을 안정적인 네트워크 엔드포인트로 노출하는 추상화입니다. 파드는 바뀌어도 Service는 고정된 접근 지점을 제공합니다.[^k8s-service]

### ConfigMap / Secret

- **ConfigMap:** 일반 설정 데이터
- **Secret:** 민감 정보 저장용 오브젝트

다만 Secret은 기본적으로 base64 인코딩이며, etcd 암호화와 접근 제어는 별도 설정이 필요합니다.[^k8s-secret][^k8s-secret-good]

| **오브젝트** | **역할** | **실무에서 주로 쓰는 위치** |
| --- | --- | --- |
| Pod | 실행 단위 | 직접보다는 상위 오브젝트로 생성 |
| Deployment | 배포와 롤링 업데이트 | 일반 웹/API 서비스 |
| Service | 안정적 네트워크 접근 | 서비스 디스커버리 |
| ConfigMap | 설정 분리 | 비민감 설정값 |
| Secret | 민감정보 분리 | 토큰, 비밀번호, 인증서 |

---

## 배포와 운영에서 중요한 포인트

Kubernetes를 면접에서 설명할 때는 "배포 자동화"보다 **운영 안전장치**를 같이 말하는 편이 좋습니다.

- **리소스 requests/limits:** 과도한 자원 사용과 noisy neighbor 문제를 줄입니다.
- **Readiness / Liveness Probe:** 트래픽 투입 시점과 재시작 기준을 분리합니다.
- **Rolling Update:** 점진적 교체로 무중단 배포를 구현합니다.
- **Service와 Ingress:** 내부/외부 트래픽 진입 구조를 나눕니다.
- **Namespace / RBAC:** 격리와 권한 제어의 기본입니다.
- **Secret 관리:** 기본 Secret만 믿지 말고 암호화, least privilege, 외부 secret store 연계를 검토해야 합니다.[^k8s-secret-good]

예를 들어 readiness probe가 없으면, 애플리케이션이 실제로 준비되기 전에 Service 트래픽이 붙어 장애처럼 보일 수 있습니다.

---

## Kubernetes의 장점

- **운영 자동화 수준이 높다**
- **애플리케이션 복구와 스케일링이 체계적이다**
- **Service 추상화 덕분에 네트워크 구성이 단순해진다**
- **플랫폼 표준화와 팀 간 공통 운영 모델을 만들기 좋다**
- **클라우드 네이티브 생태계와 잘 맞는다**

---

## Kubernetes의 한계와 주의점

- **학습 비용:** 오브젝트, 네트워크, 스토리지, 보안까지 이해해야 합니다.
- **운영 복잡도:** 클러스터 자체가 하나의 분산 시스템입니다.
- **관측성 필요:** 로깅, 모니터링, 트레이싱이 없으면 운영이 빠르게 어려워집니다.
- **보안 기본값 한계:** Secret, Pod 권한, 네트워크 정책을 별도 설계해야 합니다.[^k8s-secret-good]
- **과한 도입 위험:** 작은 서비스에 무조건 Kubernetes를 쓰면 운영비만 늘 수 있습니다.

즉, Kubernetes는 강력하지만 "컨테이너를 쓰니까 자동으로 필요해지는 기술"은 아닙니다.

---

## 면접 포인트

- **Kubernetes는 컨테이너 실행 도구가 아니라 desired state 기반 오케스트레이션 플랫폼입니다.**
- **Pod, Deployment, Service 역할을 명확히 구분해 설명할 수 있어야 합니다.**
- **Secret은 기본적으로 암호화 저장이 아니라는 점을 알고 있어야 합니다.**
- **운영 포인트로 readiness/liveness, requests/limits, rolling update를 같이 말하면 답변이 강해집니다.**
- **작은 서비스에 과도한 플랫폼이 될 수 있다는 트레이드오프도 언급하는 편이 좋습니다.**

---

## 참고 자료

[^k8s-overview]: [Kubernetes Docs, "Concepts"](https://kubernetes.io/docs/concepts/)
[^k8s-objects]: [Kubernetes Docs, "Objects In Kubernetes"](https://kubernetes.io/docs/concepts/abstractions/overview/)
[^k8s-service]: [Kubernetes Docs, "Service"](https://kubernetes.io/docs/concepts/services-networking/service/)
[^k8s-config]: [Kubernetes Docs, "Kubernetes Configuration Best Practices"](https://kubernetes.io/docs/concepts/configuration/overview/)
[^k8s-secret]: [Kubernetes Docs, "Secrets"](https://kubernetes.io/docs/concepts/configuration/secret/)
[^k8s-secret-good]: [Kubernetes Docs, "Good practices for Kubernetes Secrets"](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)
