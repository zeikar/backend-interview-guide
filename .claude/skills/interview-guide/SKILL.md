---
name: interview-guide
description: "백엔드 면접 가이드 프로젝트의 전체 콘텐츠 워크플로우를 조율하는 오케스트레이터. 콘텐츠 생성, 리뷰, 구조 검증을 자동으로 연결하여 실행한다. '면접 가이드 콘텐츠 만들어줘', '새로운 주제 추가해줘', '전체 문서 검토해줘', '시스템 디자인 섹션 채워줘' 등 면접 가이드의 콘텐츠를 생성하거나 전체적으로 검토/보강하는 요청에 트리거. 단일 문서의 간단한 수정이 아닌, 체계적인 콘텐츠 생성-검증 워크플로우가 필요할 때 반드시 사용할 것."
---

# Interview Guide Orchestrator

백엔드 면접 가이드의 콘텐츠 생성-검증 워크플로우를 조율하는 통합 스킬.

## 실행 모드: 서브 에이전트

콘텐츠 생성 → 리뷰/검증의 결과 전달 구조이므로 서브 에이전트 모드를 사용한다.

## 에이전트 구성

| 에이전트 | 역할 | 에이전트 정의 | 스킬 | Output Contract |
|---------|------|-------------|------|----------------|
| content-writer | 콘텐츠 작성/보강 | `.claude/agents/content-writer.md` | content-generation | Writer Output 형식 |
| content-reviewer | 기술 정확성/면접 적합성 검토 | `.claude/agents/content-reviewer.md` | content-review | REVIEW_SUMMARY 블록 포함 |
| consistency-checker | README ↔ 파일 구조 검증 | `.claude/agents/consistency-checker.md` | consistency-check | CONSISTENCY_SUMMARY 블록 포함 |

## 워크플로우

### Phase 1: 준비

1. **사용자 입력 분석:**
   - 작업 유형: 신규 생성 / 기존 보강 / 전체 검토 / 리뷰만
   - 대상 카테고리와 주제

2. **Dynamic Discovery:**
   - 루트 `README.md`를 읽어 카테고리 목록 파악
   - 대상 카테고리 `README.md`를 읽어 기존 문서 목록 파악
   - `Glob("{category}/*.md")`로 실제 파일 확인
   - AGENTS.md의 `Category Boundary Rules`를 확인해 카테고리 간 관점 차이를 먼저 정리

3. **Workspace 준비:**
   - `_workspace/{topic}/` 디렉토리 생성 (topic은 영문 소문자-하이픈)
   - 이전 실행의 같은 topic 디렉토리가 있으면 그대로 사용 (덮어쓰기)

4. **사용자에게 상태 보고:**
   ```
   [Phase 1] {카테고리}/{주제} — {작업유형} 시작
   ```

### Phase 2: 콘텐츠 생성/보강

content-writer 에이전트를 호출한다. 프롬프트에 충분한 컨텍스트를 주입한다.

**신규 생성 프롬프트:**
```
Agent(
  prompt: "당신은 백엔드 면접 가이드의 콘텐츠 작성자이다.

## 작업
'{주제}'에 대한 면접 가이드 콘텐츠를 작성하라.

## 컨텍스트
- 사용자 요청: {사용자 원문}
- 카테고리: {카테고리}
- 기존 문서: {해당 카테고리의 문서 목록}
- 이 문서는 작성 후 content-reviewer가 기술 정확성과 면접 적합성을 평가한다.

## 절차
1. .claude/skills/content-generation/SKILL.md를 읽고 워크플로우를 따르라
2. {카테고리} 디렉토리의 기존 문서 2~3개를 읽고 스타일을 파악하라
3. AGENTS.md의 Writing Tips를 숙지하라
4. {주제}에 대한 면접 가이드를 작성하라
5. {카테고리}/{파일명}.md에 저장하라
6. 초안을 _workspace/{topic}/01_draft.md에도 저장하라
7. {카테고리}/README.md에 새 문서 링크를 추가하라

## 품질 기대치
- YAML front matter 필수 (title, description, parent, nav_order)
- 면접에서 '왜?'라는 후속 질문에 답할 수 있는 깊이
- 모든 기술/패턴에 트레이드오프 포함
- 기존 문서와 동일한 구조/문체
- AGENTS.md Writing Tips 준수

## 출력
Writer Output 형식(에이전트 정의 참조)으로 결과를 보고하라.",
  name: "content-writer",
  subagent_type: "content-writer",
  model: "opus"
)
```

**보강 모드 프롬프트:**
```
Agent(
  prompt: "당신은 백엔드 면접 가이드의 콘텐츠 작성자이다.

## 작업
기존 문서 '{파일경로}'를 보강하라.

## 컨텍스트
- 사용자 요청: {사용자 원문}
- 이 문서는 수정 후 content-reviewer가 평가한다.

## 절차
1. .claude/skills/content-generation/SKILL.md를 읽고 보강 모드(Step 5) 절차를 따르라
2. {파일경로}를 전체 읽어라
3. AGENTS.md의 Writing Tips를 숙지하라
4. 기존 구조/문체를 유지하며 내용을 보강하라
5. 보강된 문서를 _workspace/{topic}/01_draft.md에도 저장하라

## 출력
Writer Output 형식으로 결과를 보고하라.",
  name: "content-writer",
  subagent_type: "content-writer",
  model: "opus"
)
```

결과 확인: content-writer가 생성/수정한 파일을 Read로 확인.

사용자에게 상태 보고:
```
[Phase 2] 콘텐츠 작성 완료 — {카테고리}/{파일명}.md ({N}줄)
```

### Phase 3+4: 품질 검토 + 구조 검증 (병렬)

content-reviewer와 consistency-checker는 독립적이므로 **동시에** 실행한다.

```
# 두 에이전트를 동시에 호출한다 (단일 메시지에 두 Agent 호출)

Agent(
  prompt: "당신은 백엔드 면접 가이드의 품질 검토자이다.

## 작업
'{대상 파일 경로}'를 리뷰하라.

## 컨텍스트
- 이 문서는 content-writer가 방금 작성/보강한 것이다.
- 카테고리: {카테고리}
- 리뷰 결과의 등급(상/중/하)에 따라 다음 단계가 결정된다:
  - 상: 완료 처리
  - 중: critical 항목이 있으면 writer 재실행
  - 하: writer 재작성

## 절차
1. .claude/skills/content-review/SKILL.md를 읽고 워크플로우를 따르라
2. AGENTS.md의 Writing Tips를 스타일 기준에 포함하라
3. {대상 파일 경로}를 리뷰하라
4. 리뷰 결과를 _workspace/{topic}/02_review.md에 저장하라

## 출력
반드시 <!-- REVIEW_SUMMARY --> 블록을 포함하는 리뷰 보고서를 작성하라.",
  name: "content-reviewer",
  subagent_type: "content-reviewer",
  model: "opus"
)

Agent(
  prompt: "당신은 면접 가이드 레포지토리의 구조 검증자이다.

## 작업
프로젝트 전체의 구조적 일관성을 검증하라.

## 컨텍스트
- content-writer가 방금 {카테고리}/{파일명}.md를 생성/수정했다.
- {카테고리}/README.md도 업데이트되었을 수 있다.

## 절차
1. .claude/skills/consistency-check/SKILL.md를 읽고 워크플로우를 따르라
2. scripts/check_markdown_links.py를 먼저 실행하라
3. 스크립트가 잡지 못하는 의미적 불일치를 수동 검증하라
4. 자동 수정 가능한 문제는 직접 수정하라
5. 결과를 _workspace/{topic}/03_consistency.md에 저장하라

## 출력
반드시 <!-- CONSISTENCY_SUMMARY --> 블록을 포함하는 보고서를 작성하라.",
  name: "consistency-checker",
  subagent_type: "consistency-checker",
  model: "opus"
)
```

사용자에게 상태 보고:
```
[Phase 3+4] 리뷰 + 구조 검증 완료
```

### Phase 3-R: 리뷰 기반 수정 (조건부)

리뷰 결과(`_workspace/{topic}/02_review.md`)를 Read하여 `<!-- REVIEW_SUMMARY -->` 블록을 파싱한다.

```
IF overall == "하":
  IF retry_count < 2:
    → "수정 필요 사항 (Critical)" 항목을 추출하여 content-writer에게 전달
    → retry_count += 1
    → 수정 후 content-reviewer 재실행
  ELSE:
    → 현재 상태로 전달 + 사용자에게 수동 검토 권장

ELIF overall == "중":
  IF critical_count > 0:
    → Critical 항목만 추출하여 content-writer에게 전달 (1회)
    → 수정 후 content-reviewer 재실행하지 않음 (Enhancement는 보고만)
  ELSE:
    → 현재 상태로 진행 (Enhancement는 보고만)

ELIF overall == "상":
  → 다음 단계로 진행
```

**수정 재요청 프롬프트:**
```
Agent(
  prompt: "당신은 백엔드 면접 가이드의 콘텐츠 작성자이다.

## 작업
리뷰 피드백을 반영하여 '{대상 파일 경로}'를 수정하라.

## 리뷰 피드백 (Critical 항목만)
{수정 필요 사항 섹션 내용}

## 유지할 부분 (변경 금지)
{잘된 부분 섹션 내용}

## 절차
1. {대상 파일 경로}를 읽어라
2. Critical 항목만 수정하라. 기존에 잘 된 부분은 유지하라.
3. 수정된 파일을 저장하라

## 출력
Writer Output 형식으로 수정 사항을 보고하라.",
  name: "content-writer",
  subagent_type: "content-writer",
  model: "opus"
)
```

### Phase 5: 정리 및 보고

1. `_workspace/{topic}/` 디렉토리 보존 (사후 검증용)

2. 사용자에게 결과 요약:

```markdown
## 작업 완료 요약

### 생성/수정된 파일
- {파일 목록 + 각 파일의 줄 수}

### 리뷰 결과
- 전체 평가: {상/중/하}
- 수정 이력: {있으면 "1차 하 → 수정 후 중" 등}
- 주요 피드백: {Enhancement 항목 요약}

### 구조 검증 결과
- 스크립트 결과: {OK/FAIL}
- 자동 수정: {N건 또는 없음}
- 수동 확인 필요: {N건 또는 없음}
```

## 작업 유형별 단축 워크플로우

| 작업 유형 | 실행 Phase | 비고 |
|----------|-----------|------|
| 신규 콘텐츠 생성 | 1 → 2 → 3+4 → (3-R) → 5 | 전체 |
| 기존 콘텐츠 보강 | 1 → 2 → 3 → (3-R) → 5 | 구조 검증 생략 가능 |
| 전체 구조 검토만 | 1 → 4 → 5 | consistency-checker만 |
| 기존 콘텐츠 리뷰만 | 1 → 3 → 5 | content-reviewer만 |
| 배치 생성 (여러 주제) | 주제별로 Phase 2를 순차 실행, Phase 3+4는 병렬 | |

## 에러 핸들링

```
IF content-writer 실패:
  → 1회 재시도 (같은 프롬프트)
  → 재실패 시 사용자에게 알리고 수동 작성 안내
  → _workspace/{topic}/에 실패 로그 보존

IF content-reviewer 실패:
  → 1회 재시도
  → 재실패 시 리뷰 없이 진행, 보고서에 "미검토" 명시

IF consistency-checker 실패:
  → 1회 재시도
  → 재실패 시 구조 검증 건너뛰고 보고

IF 카테고리 디렉토리 없음:
  → content-writer에게 디렉토리 + README 생성을 프롬프트에 포함

IF REVIEW_SUMMARY 파싱 실패:
  → 리뷰 보고서 전체를 텍스트로 읽어 등급을 수동 추출
  → 추출 불가 시 "중"으로 기본 처리하고 사용자에게 리뷰 확인 요청
```
