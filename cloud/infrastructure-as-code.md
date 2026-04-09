---
title: IaC (Infrastructure as Code)
description: IaC의 목적, 선언형 관리, 변경 추적과 운영 자동화를 다룹니다.
parent: 클라우드
nav_order: 6
---

# IaC (Infrastructure as Code)

## 목차

- [IaC를 왜 묻는가](#iac를-왜-묻는가)
- [IaC란](#iac란)
- [왜 IaC가 필요한가](#왜-iac가-필요한가)
- [선언형 관리의 장점과 한계](#선언형-관리의-장점과-한계)
- [Terraform과 CloudFormation](#terraform과-cloudformation)
- [State와 Drift](#state와-drift)
- [Plan, Apply, Review Workflow](#plan-apply-review-workflow)
- [모듈화와 재사용](#모듈화와-재사용)
- [비밀정보와 IaC의 경계](#비밀정보와-iac의-경계)
- [운영 시 자주 보는 포인트](#운영-시-자주-보는-포인트)
- [면접 포인트](#면접-포인트)
- [참고 자료](#참고-자료)

---

## IaC를 왜 묻는가

백엔드 면접에서 IaC는 "Terraform 써봤나요?" 같은 도구 질문으로 끝나지 않습니다.

보통은 다음 질문으로 이어집니다.

- 인프라 변경을 어떻게 재현 가능하게 관리하는가
- 콘솔 클릭 운영을 어떻게 줄였는가
- 배포와 인프라 변경을 어떤 흐름으로 검토하고 승인하는가
- drift나 잘못된 변경을 어떻게 발견하는가

즉, 이 문서의 핵심은  
**인프라를 코드처럼 versioning, review, automation 가능한 대상으로 다룰 수 있는가**입니다.

배포 흐름과 릴리스 안전성은 [배포 전략과 CI/CD (Deployment Strategies and CI/CD)](ci-cd-and-deployment.md), 컨테이너/오케스트레이션 관점은 [Kubernetes](kubernetes.md) 문서와 같이 보면 좋습니다.

---

## IaC란

**IaC(Infrastructure as Code)** 는  
서버, 네트워크, 데이터베이스, 권한, 로드밸런서 같은 인프라 구성을 코드나 선언 파일로 정의하고 관리하는 방식입니다.

핵심은 다음과 같습니다.

- 인프라 구성을 텍스트로 명시한다
- 버전 관리 시스템에 넣는다
- 변경을 review와 pipeline으로 적용한다
- 같은 구성을 반복해서 재현할 수 있게 만든다

즉, IaC는 "클라우드 리소스를 자동 생성한다"보다  
**인프라 변경을 수동 작업에서 관리 가능한 변경으로 바꾸는 접근**에 가깝습니다.

---

## 왜 IaC가 필요한가

IaC가 필요한 이유는 콘솔 클릭 운영이 가진 한계가 분명하기 때문입니다.

- **재현성 부족:** 누가 무엇을 어떻게 바꿨는지 남기기 어려움
- **환경 차이:** dev, staging, prod가 조금씩 달라지기 쉬움
- **review 부재:** 위험한 네트워크/권한 변경이 바로 운영에 반영될 수 있음
- **복구 어려움:** 장애 시 같은 인프라를 빠르게 다시 만들기 어려움

IaC를 도입하면 얻는 대표 이점은 다음과 같습니다.

- **변경 이력 관리:** Git commit과 PR로 추적 가능
- **반복 가능성:** 같은 스택을 여러 환경에 재사용 가능
- **자동화:** CI/CD와 연결해 승인된 변경만 적용 가능
- **표준화:** 팀이 같은 패턴으로 리소스를 정의할 수 있음

좋은 답변은 "Terraform으로 만들었습니다"보다  
**왜 콘솔 작업보다 review 가능한 코드 변경이 중요한지**를 먼저 설명하는 편이 좋습니다.

---

## 선언형 관리의 장점과 한계

IaC는 보통 **선언형(Declarative)** 관리 모델로 설명하는 편이 자연스럽습니다.

- 원하는 최종 상태를 기술한다
- 도구가 현재 상태와 비교해 차이를 적용한다

| **관점** | **장점** | **주의점** |
| --- | --- | --- |
| 변경 관리 | diff를 보고 review 가능 | 실제 적용 결과를 항상 정확히 예측하긴 어려움 |
| 재현성 | 같은 정의로 환경을 반복 생성 가능 | 외부 수동 변경이 끼면 drift가 생김 |
| 자동화 | plan/apply 파이프라인 구성에 유리 | 잘못된 코드도 자동으로 큰 영향을 줄 수 있음 |
| 표준화 | 모듈과 패턴을 팀 차원에서 공유 가능 | 추상화를 과하게 하면 오히려 이해가 어려워짐 |

선언형 관리가 만능은 아닙니다.

- 복잡한 조건 분기나 점진적 변경은 더 신중한 설계가 필요함
- stateful 리소스는 apply 자체보다 migration 순서가 더 중요할 수 있음
- 일부 변경은 여전히 수동 검증이나 단계적 rollout이 필요함

즉, IaC의 장점은 "모든 걸 자동으로 바꾼다"가 아니라  
**변경을 더 예측 가능하고 검토 가능하게 만든다**는 점입니다.

---

## Terraform과 CloudFormation

면접에서는 이 둘을 도구 이름 암기로 설명하기보다, 운영 감각 차이로 묶는 편이 좋습니다.

| **항목** | **Terraform** | **CloudFormation** |
| --- | --- | --- |
| 기본 성격 | 멀티 클라우드 / 멀티 프로바이더 지향 | AWS 네이티브 IaC |
| 강점 | 다양한 provider, 모듈 생태계, 범용성 | AWS 서비스와의 통합, AWS 네이티브 운영 감각 |
| 주의점 | state 관리와 provider 버전 관리가 중요 | AWS 종속성이 강하고 대규모 템플릿 관리가 복잡할 수 있음 |
| 잘 맞는 경우 | 여러 클라우드/서비스를 함께 다룸 | AWS 중심 조직과 서비스 |

### Terraform

- 여러 provider를 한 흐름에서 다루기 쉬움
- 모듈화와 재사용 패턴이 강함
- state 파일 관리가 운영 핵심 포인트임

### CloudFormation

- AWS 리소스를 AWS 방식으로 정의하기 자연스러움
- Stack과 Change Set 개념으로 변경을 관리함
- AWS 중심 조직에는 더 직접적인 선택지가 될 수 있음

좋은 답변은 "Terraform이 더 좋다" 같은 결론보다  
**우리 조직이 멀티 클라우드인지, AWS 중심인지, 운영팀이 어떤 생태계에 익숙한지**를 같이 설명하는 편이 좋습니다.

---

## State와 Drift

IaC를 쓰기 시작하면 거의 반드시 나오는 운영 질문입니다.

### State

특히 Terraform은 현재 인프라 상태를 state로 관리합니다.

- 어떤 리소스가 이미 존재하는가
- 선언 파일과 실제 리소스를 어떻게 매핑하는가
- 다음 apply 때 무엇을 바꿔야 하는가

그래서 state는 보통 원격 저장소에 두고, 잠금(locking)과 접근 제어를 같이 설계합니다.

### Drift

**Drift** 는 코드에 적힌 상태와 실제 인프라 상태가 달라진 경우입니다.

예를 들어:

- 누군가 콘솔에서 보안 그룹 규칙을 직접 바꿈
- autoscaling 설정이 코드 밖에서 수정됨
- tag나 정책이 운영 중 수동으로 바뀜

drift가 쌓이면 IaC의 신뢰가 떨어집니다.

- 다음 apply가 예상치 못한 변경을 만들 수 있음
- review에서 본 diff와 실제 결과가 어긋날 수 있음
- 환경 일관성이 깨짐

좋은 운영에서는 다음을 같이 봅니다.

- 콘솔 수동 변경 최소화
- 정기적인 drift detection
- state backend 보호
- import / reconciliation 절차 준비

즉, IaC의 핵심 운영 포인트는 "코드를 쓴다"보다  
**state와 실제 환경이 계속 맞는지 유지하는 것**입니다.

---

## Plan, Apply, Review Workflow

IaC는 보통 다음 workflow로 설명하면 실무적입니다.

1. **코드 변경**
   - 모듈, 변수, 리소스 정의 수정

2. **Plan 생성**
   - 어떤 리소스가 생성/변경/삭제될지 diff 확인

3. **Review**
   - 팀원이 PR과 plan 결과를 함께 검토
   - 특히 권한, 네트워크, 삭제 영향 확인

4. **Apply**
   - 승인된 변경만 적용

5. **Post-check**
   - 의도한 리소스가 생성됐는지, alarm이나 health check가 정상인지 확인

면접에서는 단순히 "`terraform apply` 합니다"보다  
**plan을 review artifact로 쓰고, apply는 통제된 파이프라인에서만 수행한다**고 설명하는 편이 좋습니다.

관련 릴리스 자동화 감각은 [배포 전략과 CI/CD (Deployment Strategies and CI/CD)](ci-cd-and-deployment.md) 문서와 연결됩니다.

---

## 모듈화와 재사용

IaC가 커지면 복붙보다 모듈화가 중요해집니다.

예를 들어 다음은 공통 모듈 후보입니다.

- VPC / subnet 세트
- Kubernetes 클러스터 공통 설정
- 서비스용 IAM role
- 표준 로그/모니터링 리소스

모듈화의 장점:

- 공통 패턴 재사용
- 환경별 차이를 변수로 관리
- 보안/네트워크 기본값을 표준화

하지만 과한 추상화는 오히려 독이 됩니다.

- 모듈을 열어봐야 실제 리소스가 보임
- 변수 계층이 너무 깊어짐
- 작은 예외를 처리하려다 모듈이 비대해짐

좋은 답변은 "모듈화합니다"보다  
**자주 반복되는 안정적 패턴만 모듈화하고, 예외가 많은 영역은 무리하게 감추지 않는다**고 설명하는 편이 좋습니다.

---

## 비밀정보와 IaC의 경계

IaC를 쓸 때 자주 헷갈리는 부분입니다.

원칙적으로는 다음을 구분하는 편이 좋습니다.

- **IaC로 관리할 것:** 리소스 자체, 권한 구조, secret store 리소스
- **IaC로 직접 넣지 않을 것:** 평문 비밀번호, 토큰, 인증서 원문

즉, IaC는 secret을 **어디에 둘지와 누가 접근할지**는 관리할 수 있지만,  
민감한 값 자체를 코드와 state에 직접 남기는 것은 피하는 편이 좋습니다.

대표 패턴은 다음과 같습니다.

- AWS Secrets Manager / SSM Parameter Store 리소스는 IaC로 생성
- 실제 secret 값 주입은 별도 안전한 경로 사용
- CI 환경의 secret과 IaC state 접근 권한을 분리

좋은 답변은 "Secret도 코드로 관리합니다"보다  
**비밀은 secret manager에 두고, IaC는 그 경계와 권한만 관리한다**고 설명하는 편이 안전합니다.

---

## 운영 시 자주 보는 포인트

- **state backend 보호:** 원격 저장, 잠금, 권한 제어
- **drift 감지:** 수동 변경이 끼지 않았는지 주기적 확인
- **destroy 위험 통제:** 삭제가 의도치 않게 발생하지 않도록 review 강화
- **provider / template 버전 관리:** 업그레이드 영향 확인
- **환경 분리:** dev / staging / prod를 변수만 다른 같은 구조로 유지
- **실패 복구:** apply 중 실패했을 때 재시도와 수동 정리 절차 준비

면접에서는 "자동화되어 편합니다"보다  
**IaC도 결국 운영 시스템이라 state, drift, 권한, review를 같이 관리해야 한다**고 말하는 편이 더 실무적으로 들립니다.

---

## 면접 포인트

- **IaC는 인프라 생성을 자동화하는 도구라기보다, 인프라 변경을 코드처럼 관리하는 방식입니다.**
- **선언형 관리의 강점은 재현성과 review 가능성이지만, drift와 state 관리가 중요한 운영 과제가 됩니다.**
- **Terraform과 CloudFormation은 우열보다 조직의 클라우드 전략과 운영 감각에 따라 선택하는 편이 맞습니다.**
- **좋은 IaC workflow는 plan, review, apply, post-check를 분리합니다.**
- **비밀정보는 IaC 코드에 직접 넣기보다 secret manager와 권한 경계로 다루는 편이 안전합니다.**

---

## 참고 자료

- [Terraform Docs, "Terraform Language"](https://developer.hashicorp.com/terraform/language)
- [Terraform Docs, "State"](https://developer.hashicorp.com/terraform/language/state)
- [AWS CloudFormation User Guide](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html)
- [AWS CloudFormation, "What is drift?"](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-stack-drift.html)
