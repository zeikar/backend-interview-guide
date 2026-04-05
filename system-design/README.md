# 백엔드 시스템 디자인 면접 질문 모음

## 소개

대규모 트래픽을 처리하는 백엔드 시스템 디자인 면접 질문들을 정리한 모음입니다.

## 목차

- [시스템 디자인 기초 (System Design Basics)](system-design-basics.md)
- [로드 밸런싱 (Load Balancing)](load-balancing.md)
- [고가용성 (High Availability)](high-availability.md)
- [API 설계 (API Design)](api-design.md)

## 작성 예정 주제

- 확장성 (Scalability)
  - 수직적 확장 vs 수평적 확장
  - 상태 유지 (Stateful) vs 무상태 (Stateless) 서비스
  - 샤딩 전략 (Sharding Strategies)
- 데이터베이스 설계
  - 데이터베이스 선택 기준
  - RDBMS vs NoSQL
  - 읽기 복제본과 쓰기 분리
- 캐싱 전략
  - 캐시 유형 (CDN, 애플리케이션 캐시, 데이터베이스 캐시)
  - 캐시 패턴 (Cache-Aside, Write-Through, Write-Back)
  - 캐시 무효화 (Invalidation) 전략
- 마이크로서비스 아키텍처
  - 모놀리식 vs 마이크로서비스
  - 서비스 분리 기준
  - 서비스 간 통신
- 메시징 및 이벤트 기반 아키텍처
  - 메시지 큐 (Kafka, RabbitMQ 등)
  - 이벤트 소싱 (Event Sourcing)
  - CQRS (Command Query Responsibility Segregation)
- 분산 시스템
  - CAP 이론
  - 분산 일관성 관리
  - 분산 ID 생성 및 시계 동기화
- 보안 설계
  - 인증 및 권한 부여
  - API 보안
  - 데이터 암호화 및 보안 저장
- 모니터링 및 로깅
  - 분산 트레이싱
  - 로그 집계 및 분석
  - 알림 및 대시보드 설계
