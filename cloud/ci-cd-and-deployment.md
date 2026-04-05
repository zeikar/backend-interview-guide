# 배포 전략과 CI/CD (Deployment Strategies and CI/CD)

## 목차

- [CI/CD를 왜 같이 묻는가](#cicd를-왜-같이-묻는가)
- [CI와 CD의 차이](#ci와-cd의-차이)
- [배포 파이프라인의 기본 단계](#배포-파이프라인의-기본-단계)
- [배포 전략 비교](#배포-전략-비교)
  - [Rolling Deployment](#rolling-deployment)
  - [Blue-Green Deployment](#blue-green-deployment)
  - [Canary Deployment](#canary-deployment)
- [롤백 전략](#롤백-전략)
- [배포 후 검증](#배포-후-검증)
- [Feature Flag와 배포의 관계](#feature-flag와-배포의-관계)
- [운영 시 자주 보는 포인트](#운영-시-자주-보는-포인트)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## CI/CD를 왜 같이 묻는가

백엔드 면접에서 CI/CD는 "GitHub Actions를 써봤는가" 같은 도구 질문으로 끝나지 않습니다.

보통은 다음 질문으로 이어집니다.

- 코드를 얼마나 자주, 얼마나 안전하게 배포할 수 있는가
- 빌드와 테스트를 어디까지 자동화했는가
- 배포 중 장애를 어떻게 줄이고, 문제 발생 시 어떻게 되돌리는가
- 새 버전을 배포한 뒤 정말 정상인지 무엇으로 판단하는가

즉, 이 문서의 핵심은  
**배포를 얼마나 자주 하느냐보다, 얼마나 반복 가능하고 안전하게 하느냐**를 설명하는 것입니다.

컨테이너와 오케스트레이션 관점은 [컨테이너 (Container)](container.md), [Kubernetes](kubernetes.md), 서버리스 관점은 [서버리스 (Serverless)](serverless.md) 문서와 같이 보면 좋습니다.

---

## CI와 CD의 차이

CI/CD는 붙어서 자주 말하지만, 역할은 다릅니다.

| **구분** | **CI (Continuous Integration)** | **CD (Continuous Delivery / Deployment)** |
| --- | --- | --- |
| 핵심 목표 | 변경을 자주 통합하고 빠르게 검증 | 검증된 변경을 일관되게 배포 |
| 주 관심사 | 빌드, 테스트, 정적 분석, 피드백 속도 | 배포 자동화, 롤백, 검증, 릴리스 안전성 |
| 대표 질문 | 이 변경이 깨졌는가 | 이 변경을 안전하게 운영에 반영할 수 있는가 |

### CI

CI는 개발자가 자주 변경을 합치더라도,  
기본 품질이 바로 깨지지 않게 하는 장치입니다.

- 빌드 성공 여부
- 단위 테스트 / 통합 테스트
- lint / format / type check
- 보안 스캔과 의존성 검사

### CD

CD는 검증된 결과물을 실제 환경으로 옮기는 과정입니다.

- staging / production 배포
- 배포 전략 선택
- 배포 후 health check
- rollback / promotion

면접에서는 "CI/CD 구축했습니다"보다  
**CI는 빠른 품질 피드백, CD는 안전한 릴리스 자동화**라고 나눠 설명하는 편이 좋습니다.

---

## 배포 파이프라인의 기본 단계

좋은 파이프라인은 단순히 스크립트가 길게 이어진 것이 아니라,  
문제 발견 시 가능한 빨리 실패하고, 통과 시 반복 가능하게 배포되는 구조입니다.

대표 단계는 다음과 같습니다.

1. **Build**
   - 애플리케이션 빌드, 이미지 생성, artifact 패키징

2. **Test**
   - 단위 테스트, 통합 테스트, 계약 테스트, smoke test

3. **Static / Security Check**
   - lint, type check, SAST, dependency scan, 이미지 취약점 스캔

4. **Deploy**
   - staging 또는 production에 배포

5. **Verify**
   - readiness, health check, smoke test, 주요 메트릭 확인

6. **Promote / Rollback**
   - 검증 성공 시 트래픽 확대, 실패 시 이전 버전 복귀

핵심은 모든 단계를 무겁게 만드는 것이 아니라,  
**빠른 실패와 운영 안전성을 같이 얻는 선에서 구성하는 것**입니다.

예를 들어:

- 단위 테스트는 빠르게 넓게 돌리고
- 무거운 E2E는 핵심 흐름만 남기고
- production 직전에는 smoke test와 metric gate를 두는 식입니다

---

## 배포 전략 비교

배포 전략은 "코드를 어디에 올리느냐"보다  
**트래픽을 어떻게 넘기고, 실패 시 어떻게 되돌릴 수 있느냐**의 문제입니다.

| **전략** | **장점** | **주의점** | **잘 맞는 경우** |
| --- | --- | --- | --- |
| Rolling | 추가 인프라 비용이 적음 | 중간 상태가 길어질 수 있음 | 일반적인 stateless 서비스 |
| Blue-Green | 빠른 전환과 빠른 rollback | 환경 2벌 유지 비용 | 비교적 큰 릴리스를 안전하게 전환 |
| Canary | 위험을 점진적으로 노출 | 관측성과 제어가 필요 | 대규모 트래픽, 점진 릴리스 |

### Rolling Deployment

기존 인스턴스를 조금씩 새 버전으로 교체하는 방식입니다.

- **장점:** 추가 인프라 비용이 적음
- **장점:** Kubernetes Deployment 기본 전략과 자연스럽게 맞음
- **단점:** 배포 중 구버전/신버전이 공존할 수 있음
- **단점:** DB 스키마 비호환이 있으면 위험할 수 있음

좋은 답변은 rolling을 "기본 전략"으로 설명하되,  
**버전 혼재를 견딜 수 있는 무상태 서비스에서 특히 자연스럽다**고 말하는 편이 좋습니다.

### Blue-Green Deployment

기존 환경(Blue)과 새 환경(Green)을 동시에 두고,  
검증 후 트래픽을 한 번에 전환하는 방식입니다.

- **장점:** 전환과 rollback이 빠름
- **장점:** 새 환경을 충분히 검증한 뒤 바꿀 수 있음
- **단점:** 환경을 두 벌 유지해야 하므로 비용이 듦
- **단점:** 데이터베이스 변경은 별도 전략이 필요함

이 전략은 "트래픽 전환은 쉽지만 데이터 전환은 따로 고민해야 한다"는 점까지 같이 말해야 답변이 좋아집니다.

### Canary Deployment

새 버전을 소량 트래픽에 먼저 노출하고,  
문제가 없으면 점진적으로 비율을 늘리는 방식입니다.

- **장점:** 장애 영향 범위를 줄일 수 있음
- **장점:** 실제 운영 트래픽으로 새 버전을 검증 가능
- **단점:** 트래픽 분할, 메트릭 비교, 자동 중단 조건이 필요함
- **단점:** 관측성이 약하면 오히려 운영이 복잡해질 수 있음

Canary는 "점진적 배포" 그 자체보다  
**언제 중단하고 언제 확대할지 기준을 같이 갖고 있어야 의미가 있다**고 설명하는 편이 좋습니다.

---

## 롤백 전략

배포 전략보다 더 중요한 질문은 "문제가 생기면 어떻게 되돌리는가"일 때가 많습니다.

롤백은 보통 다음 축으로 나눠서 봅니다.

- **애플리케이션 버전 롤백:** 이전 이미지나 artifact로 되돌림
- **트래픽 롤백:** Blue-Green이나 Canary에서 트래픽을 이전 버전으로 다시 전환
- **설정 롤백:** 잘못된 feature flag, config, secret 변경 되돌림
- **데이터 롤백:** DB migration이나 잘못된 데이터 변경 대응

중요한 점은 코드 롤백이 항상 충분하지 않다는 것입니다.

- 비호환 스키마 migration이 이미 적용됐을 수 있음
- 비동기 consumer가 새 포맷 이벤트를 이미 발행했을 수 있음
- 설정 변경이 장애 원인일 수 있음

그래서 실무에서는 다음 원칙이 중요합니다.

- backward-compatible migration 우선
- feature flag로 기능 노출 분리
- rollback 가능한 artifact와 배포 메타데이터 보존
- DB 변경은 expand/contract 패턴 검토

면접에서는 "`kubectl rollout undo` 합니다"보다  
**코드, 트래픽, 설정, 데이터의 rollback 경로를 구분한다**고 설명하는 편이 더 실무적입니다.

---

## 배포 후 검증

배포가 성공했다는 말은 보통 "명령이 끝났다"가 아니라  
**서비스가 정상적으로 응답하고 지표가 안정적이다**라는 뜻이어야 합니다.

대표 검증 항목은 다음과 같습니다.

- **Health Check:** 프로세스와 기본 의존성이 살아 있는가
- **Smoke Test:** 핵심 API나 주요 기능이 실제로 동작하는가
- **Readiness 확인:** 새 인스턴스가 트래픽을 받아도 되는가
- **Metric / Alarm 확인:** error rate, latency, saturation이 튀지 않는가
- **로그 확인:** 특정 에러 패턴이 급증하지 않는가

배포 후 검증은 자동화될수록 좋습니다.

- smoke test 자동 실행
- canary 단계의 metric gate
- 이상 징후 시 자동 중단
- SLO / 에러율 기반 promotion 조건

관측성 일반론은 [로깅 및 모니터링 (Logging & Monitoring)](logging-monitoring.md) 문서와 연결됩니다.

---

## Feature Flag와 배포의 관계

배포와 릴리스는 같은 말이 아닙니다.

- **배포:** 코드를 운영 환경에 올리는 것
- **릴리스:** 사용자가 실제로 기능을 쓰게 여는 것

Feature flag는 이 둘을 분리하는 도구입니다.

- 코드는 배포했지만 기능은 아직 끄기
- 내부 사용자만 먼저 켜기
- 일부 국가/사용자 그룹에만 열기
- 문제 시 전체 rollback 없이 기능만 끄기

장점은 분명합니다.

- 배포 위험과 기능 노출 위험을 분리할 수 있음
- 실험, 점진 노출, 긴급 차단이 쉬움

하지만 주의점도 있습니다.

- 오래된 flag가 쌓이면 코드 복잡도가 증가
- 테스트 조합 수가 늘어남
- 설정 관리와 권한 통제가 필요함

즉, feature flag는 배포 전략의 대체제가 아니라  
**배포 위험을 더 세밀하게 제어하는 보조 수단**으로 설명하는 편이 좋습니다.

---

## 운영 시 자주 보는 포인트

- **배포 빈도와 lead time:** 얼마나 자주, 얼마나 빨리 운영까지 가는가
- **change failure rate:** 배포 후 장애 비율이 높은가
- **MTTR:** 배포 사고 후 얼마나 빨리 복구하는가
- **artifact immutability:** 같은 빌드를 반복 재배포할 수 있는가
- **환경 일관성:** dev / staging / prod 차이가 과도하지 않은가
- **승격 기준:** 사람이 누를지, 자동으로 promotion할지 기준이 있는가

면접에서는 도구 이름만 말하기보다  
**배포 속도와 안정성을 동시에 보려면 어떤 지표와 gate를 둘지** 설명하는 편이 좋습니다.

---

## 면접 포인트

- **CI는 빠른 품질 피드백, CD는 안전한 릴리스 자동화로 나눠 설명하는 편이 좋습니다.**
- **배포 전략은 Rolling, Blue-Green, Canary의 트레이드오프로 설명해야 합니다.**
- **롤백은 코드만 되돌리는 문제가 아니라 트래픽, 설정, 데이터까지 같이 봐야 합니다.**
- **배포 후 검증은 health check, smoke test, metric gate를 함께 봐야 실무형 답변이 됩니다.**
- **feature flag는 배포와 릴리스를 분리하는 도구로 설명하면 자연스럽습니다.**

---

## 참고 자료

- Kubernetes Docs, "Deployment" - https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- AWS Prescriptive Guidance, "Blue/green deployments" - https://docs.aws.amazon.com/prescriptive-guidance/latest/blue-green-deployments/welcome.html
- AWS Prescriptive Guidance, "Canary deployments" - https://docs.aws.amazon.com/prescriptive-guidance/latest/canary-deployments/welcome.html
- Google Cloud, "CI/CD" - https://cloud.google.com/solutions/continuous-integration-continuous-delivery
