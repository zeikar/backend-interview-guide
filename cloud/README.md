# 백엔드 클라우드 면접 질문 모음

## 소개

대규모 트래픽을 처리하는 백엔드 클라우드 관련 면접 질문들을 정리한 모음입니다.

## 목차

- [클라우드 컴퓨팅 (Cloud Computing)](cloud-computing.md)
- [컨테이너 (Container)](container.md)
- [Kubernetes](kubernetes.md)
- [서버리스 (Serverless)](serverless.md)
- [마이크로서비스 아키텍처 (MSA)](microservices.md)
  - [메시징 시스템 (Messaging System)](messaging-system.md)
  - [gRPC](grpc.md)
  - [서비스 메시 (Service Mesh)](service-mesh.md)
  - [로깅 및 모니터링 (Logging & Monitoring)](logging-monitoring.md)

## 작성 예정 주제

- 배포 전략과 CI/CD
  - Blue-Green Deployment
  - Canary Deployment
  - 롤백 전략과 배포 검증
- IaC (Infrastructure as Code)
  - Terraform
  - CloudFormation
  - 선언형 인프라 관리의 장단점
- 클라우드 보안 (Cloud Security)
  - IAM 최소 권한
  - Secret 관리
  - 네트워크 격리와 암호화
- 네트워크 설계
  - VPC / Subnet 분리
  - Ingress / Egress 제어
  - 내부망과 외부망 분리 전략
- 오토스케일링과 용량 계획
  - 스케일 업 vs 스케일 아웃
  - HPA / Cluster Autoscaler
  - 피크 트래픽 대응 전략
- 장애 대응과 DR (Disaster Recovery)
  - 백업과 복구
  - 리전 장애 대응
  - RTO / RPO
- API Gateway와 Edge 패턴
  - 인증과 라우팅
  - 레이트 리밋
  - CDN과의 역할 분리
