---
name: interview-guide
description: "백엔드 면접 가이드 프로젝트의 전체 콘텐츠 워크플로우를 조율하는 오케스트레이터. 콘텐츠 생성, 리뷰, 구조 검증을 자동으로 연결하여 실행한다. '면접 가이드 콘텐츠 만들어줘', '새로운 주제 추가해줘', '전체 문서 검토해줘', '시스템 디자인 섹션 채워줘' 등 면접 가이드의 콘텐츠를 생성하거나 전체적으로 검토/보강하는 요청에 트리거. 단일 문서의 간단한 수정이 아닌, 체계적인 콘텐츠 생성-검증 워크플로우가 필요할 때 반드시 사용할 것."
---

# Interview Guide Orchestrator

백엔드 면접 가이드의 콘텐츠 생성-검증 워크플로우를 조율하는 통합 스킬.

## 실행 모드: 서브 에이전트

콘텐츠 생성 → 리뷰 → 수정의 순차적 결과 전달 구조이므로 서브 에이전트 모드를 사용한다.

## 에이전트 구성

| 에이전트 | 역할 | 스킬 | 출력 |
|---------|------|------|------|
| content-writer | 콘텐츠 작성/보강 | content-generation | 마크다운 문서 |
| content-reviewer | 기술 정확성/면접 적합성 검토 | content-review | 리뷰 보고서 |
| consistency-checker | README ↔ 파일 구조 검증 | consistency-check | 일관성 보고서 |

## 워크플로우

### Phase 1: 준비

1. 사용자 입력 분석:
   - **작업 유형 파악:** 신규 생성 / 기존 보강 / 전체 검토
   - **대상 카테고리:** database / cloud / system-design / programming
   - **구체적 주제:** (예: "확장성", "Redis", "Go 동시성")

2. `_workspace/` 디렉토리 생성 (없으면)

3. 대상 카테고리의 기존 문서 목록 확인

### Phase 2: 콘텐츠 생성/보강

**실행 방식:** 순차 (content-writer → content-reviewer)

1. **content-writer 실행:**
   ```
   Agent(
     prompt: "다음 작업을 수행하라:
       1. .claude/skills/content-generation/SKILL.md를 읽고 스타일 가이드를 숙지하라
       2. [카테고리] 디렉토리의 기존 문서 2~3개를 읽고 스타일을 파악하라
       3. [주제]에 대한 면접 가이드 콘텐츠를 작성하라
       4. 작성한 문서를 [카테고리]/[파일명].md에 저장하라
       5. 초안을 _workspace/01_writer_[주제].md에도 저장하라
       6. 해당 카테고리의 README.md에 새 문서 링크를 추가하라",
     name: "content-writer",
     model: "opus"
   )
   ```

   **보강 모드일 때는 prompt 조정:**
   ```
   "기존 [파일경로]를 읽고, content-generation 스킬의 보강 모드 절차에 따라 내용을 보강하라"
   ```

2. **결과 확인:** content-writer가 생성/수정한 파일을 Read로 확인

### Phase 3: 품질 검토

1. **content-reviewer 실행:**
   ```
   Agent(
     prompt: "다음 작업을 수행하라:
       1. .claude/skills/content-review/SKILL.md를 읽고 리뷰 기준을 숙지하라
       2. [카테고리] 디렉토리의 기존 우수 문서 1~2개를 읽고 비교 기준을 수립하라
       3. [대상 파일 경로]를 리뷰하라
       4. 리뷰 결과를 _workspace/02_reviewer_feedback.md에 저장하라",
     name: "content-reviewer",
     model: "opus"
   )
   ```

2. **리뷰 결과 확인:** `_workspace/02_reviewer_feedback.md`를 Read

3. **수정 필요 시 content-writer 재실행 (최대 2회):**
   ```
   Agent(
     prompt: "다음 리뷰 피드백을 반영하여 [대상 파일]을 수정하라:
       [리뷰 피드백 내용]
       수정 사항만 반영하고, 기존에 잘 된 부분은 유지하라.",
     name: "content-writer",
     model: "opus"
   )
   ```

### Phase 4: 구조 검증

1. **consistency-checker 실행:**
   ```
   Agent(
     prompt: "다음 작업을 수행하라:
       1. .claude/skills/consistency-check/SKILL.md를 읽고 검증 규칙을 숙지하라
       2. 프로젝트 루트의 전체 구조를 검증하라
       3. 검증 결과를 _workspace/03_consistency_report.md에 저장하라
       4. 자동 수정 가능한 문제는 직접 수정하라",
     name: "consistency-checker",
     model: "opus"
   )
   ```

2. **검증 결과 확인:** `_workspace/03_consistency_report.md`를 Read

3. **구조 문제가 있으면:** 오케스트레이터가 직접 수정하거나 사용자에게 보고

### Phase 5: 정리 및 보고

1. `_workspace/` 디렉토리 보존 (사후 검증용)

2. 사용자에게 결과 요약:
   ```markdown
   ## 작업 완료 요약
   
   ### 생성/수정된 파일
   - [파일 목록]
   
   ### 리뷰 결과
   - 전체 평가: [상/중/하]
   - 주요 피드백: [요약]
   
   ### 구조 검증 결과
   - 누락 파일: [있으면 목록]
   - 수정된 항목: [있으면 목록]
   ```

## 데이터 흐름

```
사용자 입력
    ↓
[content-writer] → 마크다운 문서 생성
    ↓
[content-reviewer] → 리뷰 피드백
    ↓
(수정 필요 시) [content-writer] → 문서 수정  ← 최대 2회 반복
    ↓
[consistency-checker] → 구조 검증 + 자동 수정
    ↓
사용자에게 결과 보고
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| content-writer 실패 | 1회 재시도. 재실패 시 사용자에게 알리고 수동 작성 안내 |
| content-reviewer 실패 | 1회 재시도. 재실패 시 리뷰 없이 진행, 보고서에 "미검토" 명시 |
| consistency-checker 실패 | 1회 재시도. 재실패 시 구조 검증 건너뛰고 보고 |
| 리뷰 결과 "하" 평가 | content-writer 재실행 (최대 2회). 3회째도 "하"이면 현재 상태로 전달 + 수동 검토 권장 |
| 카테고리 디렉토리 없음 | 디렉토리 생성 후 진행 |

## 작업 유형별 단축 워크플로우

모든 Phase를 거치지 않아도 되는 경우:

| 작업 유형 | 실행 Phase |
|----------|-----------|
| 신규 콘텐츠 생성 | Phase 1 → 2 → 3 → 4 → 5 (전체) |
| 기존 콘텐츠 보강 | Phase 1 → 2 → 3 → 5 (구조 검증 생략 가능) |
| 전체 구조 검토만 | Phase 1 → 4 → 5 |
| 기존 콘텐츠 리뷰만 | Phase 1 → 3 → 5 |

## 테스트 시나리오

### 정상 흐름

1. 사용자가 "시스템 디자인의 확장성(Scalability) 콘텐츠 만들어줘" 요청
2. Phase 1: system-design 카테고리, scalability 주제 파악
3. Phase 2: content-writer가 `system-design/scalability.md` 생성 + README 업데이트
4. Phase 3: content-reviewer가 리뷰 → "상" 평가
5. Phase 4: consistency-checker가 구조 검증 → 문제 없음
6. Phase 5: 결과 요약 보고
7. 예상 결과: `system-design/scalability.md` 생성, `system-design/README.md` 업데이트

### 에러 흐름

1. 사용자가 "데이터베이스 최적화 문서 보강해줘" 요청
2. Phase 2: content-writer가 `database/optimization.md` 보강
3. Phase 3: content-reviewer가 리뷰 → "하" 평가 (기술 오류 발견)
4. content-writer 재실행 → 리뷰 피드백 반영하여 수정
5. content-reviewer 재리뷰 → "중" 평가
6. Phase 4: consistency-checker 실행 → 정상
7. Phase 5: "리뷰 1차 '하' → 수정 후 '중'" 경과 포함하여 보고
