---
title: 네트워크 설계 (Network Design)
description: VPC, 서브넷, 라우팅, 노출 경계 등 클라우드 네트워크 설계 핵심을 다룹니다.
parent: 클라우드
nav_order: 8
---

# 네트워크 설계 (Network Design)

## 목차

- [네트워크 설계를 왜 묻는가](#네트워크-설계를-왜-묻는가)
- [클라우드 네트워크 설계란](#클라우드-네트워크-설계란)
- [VPC와 Subnet 분리](#vpc와-subnet-분리)
- [Public Subnet과 Private Subnet](#public-subnet과-private-subnet)
- [Ingress와 Egress 제어](#ingress와-egress-제어)
- [Internal LB, External LB, NAT 감각](#internal-lb-external-lb-nat-감각)
- [보안 그룹, Firewall Rule, NACL 감각](#보안-그룹-firewall-rule-nacl-감각)
- [서비스 간 통신 경로와 내부망/외부망 분리](#서비스-간-통신-경로와-내부망외부망-분리)
- [트레이드오프](#트레이드오프)
- [실무에서 자주 나는 설계 실수](#실무에서-자주-나는-설계-실수)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## 네트워크 설계를 왜 묻는가

백엔드 면접에서 클라우드 네트워크 설계는  
"VPC를 만들 줄 아는가"보다 **무엇을 외부에 노출하고 무엇을 내부에 숨길지 설명할 수 있는가**를 보는 질문에 가깝습니다.

보통 다음 질문으로 이어집니다.

- 어떤 리소스가 public subnet에 있어야 하는가
- DB와 캐시는 왜 private subnet에 두는가
- ingress와 egress를 어떻게 통제하는가
- 내부 서비스 통신과 외부 사용자 트래픽을 어떻게 나누는가

즉, 이 문서의 핵심은  
**네트워크를 그냥 연결하는 것이 아니라, 노출 면과 통신 경로를 의도적으로 제한하는가**입니다.

관련 보안 관점은 [클라우드 보안 (Cloud Security)](cloud-security.md),  
플랫폼 관점은 [Kubernetes](kubernetes.md), 서비스 경계 관점은 [서비스 메시 (Service Mesh)](service-mesh.md) 문서와 같이 보면 좋습니다.

---

## 클라우드 네트워크 설계란

클라우드 네트워크 설계는 보통 다음을 같이 다룹니다.

- IP 대역을 어떻게 나눌 것인가
- 어느 리소스를 public/private으로 분리할 것인가
- 어떤 경로로 들어오고 나갈 수 있는가
- 내부 서비스 통신을 어디까지 허용할 것인가
- 장애와 확장 시 네트워크 병목이나 단일 실패점을 어떻게 줄일 것인가

좋은 답변은 "VPC를 나눕니다"에서 끝나지 않습니다.

- 왜 그 리소스가 그 subnet에 있어야 하는가
- 왜 그 포트만 열었는가
- 왜 저 트래픽은 NAT를 거치고, 저 트래픽은 private endpoint를 쓰는가

까지 이어져야 실무형 답변이 됩니다.

---

## VPC와 Subnet 분리

### VPC

**VPC(Virtual Private Cloud)** 는  
클라우드 안에서 격리된 가상 네트워크 경계라고 보면 됩니다.[^aws-vpc]

보통 VPC 수준에서는 다음을 먼저 정합니다.

- CIDR 대역
- 환경 분리 전략
- 리전/가용 영역 배치
- 외부 연결 방식(VPN, Direct Connect, Peering 등)

### Subnet

Subnet은 VPC 안의 더 작은 네트워크 구간입니다.

실무에서는 subnet을 보통 다음 기준으로 나눕니다.

- public / private 구분
- AZ별 분산
- 워크로드 역할 구분
  - ingress
  - application
  - database

좋은 설계는 subnet을 많이 나누는 것이 아니라  
**서로 다른 노출 수준과 운영 목적을 가진 리소스를 분리하는 것**입니다.

---

## Public Subnet과 Private Subnet

이 구분은 면접에서 매우 자주 나옵니다.

| **구분** | **주로 두는 리소스** | **주의점** |
| --- | --- | --- |
| Public Subnet | ALB, Bastion 같은 외부 진입점, NAT Gateway 같은 외부 연결용 구성 요소 | 불필요한 워크로드까지 두면 공격 면이 넓어짐 |
| Private Subnet | 애플리케이션 서버, DB, 캐시, 내부 워커 | 외부 업데이트 경로와 운영 접근 경로를 따로 설계해야 함 |

일반적으로는 다음 구성이 자연스럽습니다.

- 외부 트래픽을 받는 Load Balancer만 public
- 애플리케이션 서버는 private
- DB와 캐시는 더 제한된 private 영역

핵심은 **사용자와 직접 통신해야 하는 리소스만 public으로 둔다**는 점입니다.

예를 들어 DB를 public으로 두면 당장 편해 보일 수 있지만,
운영 실수 한 번으로 바로 외부 노출 사고로 이어질 수 있습니다.

---

## Ingress와 Egress 제어

네트워크 보안은 단순히 "들어오는 것만 막는가"의 문제가 아닙니다.

- **Ingress:** 외부나 다른 네트워크에서 들어오는 트래픽
- **Egress:** 내부에서 외부로 나가는 트래픽

실무에서는 ingress보다 egress를 느슨하게 두는 경우가 많은데,  
이게 데이터 유출이나 예상 밖 외부 호출의 원인이 되기도 합니다.

좋은 설계는 다음과 같습니다.

- 필요한 포트와 출발지/목적지만 허용
- DB는 app subnet 또는 app security group에서만 접근 허용
- 외부 API 호출이 필요한 워크로드만 egress 허용
- 관리자 접근은 VPN, bastion, SSM 같은 통제된 경로로 제한

좋은 답변은 "`443`만 엽니다"보다  
**누가 어느 경로로 누구에게 접근할 수 있는지 명시적으로 관리한다**고 설명하는 편이 좋습니다.

---

## Internal LB, External LB, NAT 감각

이 구분은 실제 운영 감각을 보여 주는 포인트입니다.

| **구성 요소** | **역할** | **주 사용 위치** |
| --- | --- | --- |
| External LB | 인터넷에서 들어오는 요청 수신 | public subnet |
| Internal LB | 내부 서비스 간 안정적 진입점 제공 | private subnet |
| NAT | private subnet의 아웃바운드 인터넷 통신 중계 | public subnet |

### External LB

external load balancer는 인터넷에서 들어오는 요청을 받아 애플리케이션 계층으로 전달합니다.

보통 여기서 처리하는 것은 다음과 같습니다.

- TLS 종료
- 호스트/경로 기반 라우팅
- 헬스 체크
- 여러 인스턴스나 파드로 트래픽 분산

면접에서는 "로드 밸런서를 둡니다"보다  
**인터넷 공개가 필요한 엔드포인트만 external LB 뒤에 둔다**고 설명하는 편이 좋습니다.

### Internal LB

internal load balancer는 외부에 공개되지 않는 내부 트래픽용 진입점입니다.

예를 들어:

- API 서버가 내부 이미지 처리 서비스 호출
- 사내 백오피스 시스템이 내부 서비스 호출
- Kubernetes 내부 Ingress / Service 구조와 연결된 사설 엔드포인트

내부 LB를 두면 내부 서비스 주소 체계를 단순화하고, 네트워크 정책도 더 명확하게 잡기 쉽습니다.

### NAT

private subnet의 리소스가 외부로 나가야 하지만 외부에서 직접 들어올 필요는 없을 때 자주 나옵니다.[^aws-nat]

- 패키지 다운로드
- 외부 API 호출
- OS 업데이트

이 경우 NAT Gateway나 NAT 인스턴스를 통해 egress만 열어두는 식으로 설명할 수 있습니다.

핵심은 NAT가 **외부에서 private subnet으로 직접 들어오는 통로를 만드는 것이 아니라**, private subnet의 아웃바운드 연결을 가능하게 한다는 점입니다.

### Private Endpoint

관리형 서비스 접근을 인터넷이 아니라 프라이빗 네트워크 안에서 처리하고 싶을 때는 private endpoint도 검토할 수 있습니다.[^aws-privatelink]

- S3, Secrets Manager 같은 지원 서비스와의 통신을 private하게 유지
- DB는 보통 private subnet과 내부 IP 경로로 접근하며, private endpoint 적용 가능 여부는 서비스별로 다름
- NAT 비용과 외부 노출 경로를 줄이는 데 도움

좋은 답변은 "NAT를 둡니다"보다  
**왜 어떤 트래픽은 NAT를 거치고, 어떤 트래픽은 internal LB나 private endpoint가 더 나은지**를 같이 설명하는 편이 좋습니다.

---

## 보안 그룹, Firewall Rule, NACL 감각

면접에서는 이 장치들을 어떻게 구분하는지도 자주 나옵니다.

플랫폼마다 이름은 조금 다르지만 감각은 비슷합니다.

| **항목** | **Security Group / Firewall Rule** | **NACL** |
| --- | --- | --- |
| 적용 위치 | 인스턴스, NIC, 서비스 단위 | Subnet 수준 |
| 성격 | 보통 stateful 또는 리소스 중심 허용 정책 | 보통 stateless에 가까운 경계 정책 |
| 용도 | 워크로드 단위의 세밀한 허용 정책 | subnet 경계 보조 제어 |
| 실무 감각 | 누가 누구에게 붙을 수 있는지 관계 중심 설명이 쉬움 | 더 거친 네트워크 경계 차단에 적합 |

좋은 답변은 다음 감각을 가지면 충분합니다.

- security group이나 firewall rule은 "누가 이 리소스에 접근 가능한가"를 워크로드 기준으로 제어
- NACL은 subnet 경계에서 더 거친 수준의 허용/차단
- 대부분의 세밀한 정책은 security group이나 방화벽 규칙이 주 역할

즉, 이들을 경쟁 관계로 설명하기보다  
**리소스 경계는 security group / firewall rule, subnet 경계는 NACL**로 설명하는 편이 자연스럽습니다.[^aws-sg][^aws-nacl]

---

## 서비스 간 통신 경로와 내부망/외부망 분리

외부 사용자 요청과 내부 서비스 간 통신을 같은 경로에 섞어두면 운영이 어려워집니다.

대표적으로 다음을 분리하는 편이 좋습니다.

- 외부 사용자용 API 트래픽
- 내부 서비스 간 east-west 트래픽
- 운영자 접근 트래픽
- 배치/백오피스/관리 트래픽

예를 들어:

- 외부 요청은 public ALB → app tier
- 내부 서비스 호출은 internal LB 또는 service mesh
- DB 접근은 app tier에서만 허용

이렇게 분리하면 얻는 장점은 다음과 같습니다.

- 노출 면 축소
- 정책 적용 단순화
- 장애 추적 경로 명확화

즉, 네트워크 설계는 **인터넷-facing 경로와 내부 시스템 경로를 분리하는 것**부터 시작하는 경우가 많습니다.

마이크로서비스 경계와 통신 정책은 [마이크로서비스 아키텍처 (MSA)](microservices.md),  
세밀한 east-west 트래픽 제어는 [서비스 메시 (Service Mesh)](service-mesh.md),  
Kubernetes 안의 서비스 노출 구조는 [Kubernetes](kubernetes.md) 와 같이 보면 연결이 좋습니다.

---

## 트레이드오프

네트워크 설계는 정답을 외우는 문제가 아니라, 보안, 운영, 비용의 균형을 어떻게 잡는지 설명하는 문제입니다.

| **선택** | **장점** | **비용/주의점** |
| --- | --- | --- |
| public/private 분리 강화 | 노출 면 축소, 데이터 계층 보호 | 운영 접근과 디버깅이 번거로움 |
| NAT 경유 아웃바운드 통제 | private 자원 보호, egress 관찰 용이 | 비용 증가, 병목 지점 가능성 |
| VPC를 환경별로 분리 | 강한 격리, 실수 전파 감소 | 연결과 운영 복잡도 증가 |
| internal LB 적극 사용 | 내부 경계 명확화, 주소 체계 단순화 | 구성 요소 증가, 비용 증가 |
| 세밀한 firewall 정책 | 최소 권한 네트워크 구현 | 규칙 관리 복잡도 증가 |

면접에서는 "보안을 위해 다 막겠습니다"보다  
**어디는 강하게 분리하고, 어디는 운영 편의 때문에 단순화할지**를 말하는 편이 더 설득력 있습니다.

---

## 실무에서 자주 나는 설계 실수

- **DB/Redis를 public subnet에 둠**
- **`0.0.0.0/0` 인바운드를 운영 편의로 열어 둠**
- **egress를 무제한 허용해 데이터 유출 경로를 방치**
- **AZ 분산 없이 한 subnet 또는 한 AZ에만 몰아둠**
- **내부 서비스 호출도 모두 외부 LB를 거치게 설계**
- **운영 접근 경로와 애플리케이션 트래픽 경로를 분리하지 않음**

좋은 답변은 "실수를 막는다"보다  
**실수하더라도 노출 범위가 작도록 경계와 권한을 나눈다**는 흐름이 좋습니다.

---

## 면접 포인트

- **클라우드 네트워크 설계의 핵심은 리소스를 연결하는 것보다 노출 면과 통신 경로를 제한하는 것입니다.**
- **public subnet에는 외부 진입점만 두고, 애플리케이션과 데이터 저장소는 private으로 두는 구성이 기본입니다.**
- **ingress뿐 아니라 egress 제어도 같이 설명해야 실무적으로 들립니다.**
- **security group이나 firewall rule은 리소스 경계의 세밀한 제어, NACL은 subnet 경계 보조 제어 정도로 설명하면 자연스럽습니다.**
- **좋은 답변은 external LB, internal LB, NAT, private endpoint를 문제 맥락에 맞게 연결합니다.**
- **보안, 장애 대응, 운영 편의, 비용 사이의 트레이드오프를 같이 언급하면 답변이 더 강해집니다.**

---

## 참고 자료

[^aws-vpc]: AWS Docs, "What is Amazon VPC?" - https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html
[^aws-sg]: AWS Docs, "VPC security groups" - https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html
[^aws-nacl]: AWS Docs, "Network ACLs" - https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html
[^aws-nat]: AWS Docs, "NAT gateways" - https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
[^aws-privatelink]: AWS Docs, "AWS PrivateLink" - https://docs.aws.amazon.com/vpc/latest/privatelink/what-is-privatelink.html
