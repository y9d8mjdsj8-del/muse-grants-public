# MUSE Grants

> 👉 **처음 설치하시나요? [INSTALL.md](INSTALL.md)** 를 따라 하세요. (처음이면 1시간 안팎, 무료, 아무것도 설치하지 않고 브라우저에서 진행, 개발 지식 없이 가능)

지원사업 · 용역·입찰 · 교육 · 대관 공고를 모아 보고, 판정하고, 준비하는 대시보드.

## 지금 들어 있는 것 (v0.1 · 로드맵 1~3단계)

| 폴더 | 내용 |
|---|---|
| `apps/web` | 휴대폰·PC 브라우저용 웹앱 (Next.js). 공고 피드(종류 탭·목록/포스터 보기·검색·필터), 공고 상세(주체별 판정·적합도·의견·결정 도장), 공고 추가(링크·포스터·직접 입력), 대화로 분석하기(결과 붙여넣기), [○○와 작성하기], 캘린더, 지원 관리, 설정, 다크 모드 |
| `packages/core` | 공통 타입, D-day 계산, 종류 자동 분류, 규칙 매칭, 중복 판별, 샘플 데이터 |
| `packages/collectors` | 수집기: 아트누리 · NCAS · 예술경영지원센터 · K-Startup(API) · 문화예술 내일 · 아트모아 + 범용 게시판 파서 |
| `cloud/supabase` | 클라우드 DB 스키마 + 보안(RLS) |
| `.github/workflows` | 자동 일꾼 (하루 2회 수집) |

## 바로 실행해 보기 (데모 모드)

```bash
# Node 20 이상, pnpm 필요 (npm i -g pnpm)
pnpm install
pnpm dev          # http://localhost:3000
```
환경변수가 없으면 **데모 모드**로 샘플 공고를 보여줍니다. 휴대폰으로 보려면 같은 와이파이에서 `http://<PC IP>:3000`.

## 클라우드 연결 (휴대폰에서도 보기)

1. **Supabase** (공고 데이터는 전용 스키마 `grants`에 따로 저장 — 다른 앱과 같은 프로젝트를 써도 섞이지 않음)
   - 새로 설치: SQL Editor에 `cloud/supabase/setup.sql` 한 번만 실행 (아래 개별 파일 대신)
   - SQL Editor → New query → `cloud/supabase/migrations/0001_init.sql` 전체 붙여넣고 **Run**, 이어서 `0002_manual_notices.sql`, `0003_delete_residency.sql`, `0004_files.sql`, `0005_guest_read.sql`·`0006_guest_showcase.sql`(로그인 없는 체험 모드와 예시 계정, 원하지 않으면 생략. 0006의 이메일은 본인 것으로, Vercel 환경변수 `NEXT_PUBLIC_SHOWCASE_NAME`에 예시 이름), `0007_drafts.sql`(초안 편집기)도 순서대로 같은 방법으로 **Run**
   - Project Settings → Data API → **Exposed schemas**에 `grants` 추가 → Save
   - Authentication → URL Configuration → **Redirect URLs**에 `https://<Vercel 주소>/**` 추가 (같은 프로젝트를 다른 앱과 함께 쓰면 Site URL은 그대로 둘 것)
2. **GitHub**: 저장소 Settings → Secrets and variables → Actions에 등록
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys의 secret/service_role 키)
   - `DATA_GO_KR_KEY` (선택, 공공데이터포털 인증키 — K-Startup · 조달청 나라장터 입찰공고. data.go.kr에서 "조달청_나라장터 입찰공고정보서비스" 활용 신청 필요)
3. **Vercel**: Project → Settings → Environment Variables → 추가 후 Redeploy
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon 키)
4. GitHub Actions 탭 → "공고 수집" → **Run workflow** 로 첫 수집
5. **사용자 등록**: 새 가입은 막혀 있음 → Supabase → Authentication → Users → **Add user**(또는 Invite)로 쓸 사람 이메일 추가

> 나중에 PC 앱의 설정 마법사가 이 과정을 자동으로 해줍니다 (`guides/휴대폰에서도보기_설정가이드.md`).

## 수집기 확인·조정

```bash
pnpm --filter @muse/collectors collect:dry               # 저장 없이 결과 표 출력
pnpm --filter @muse/collectors collect:dry --only=artnuri
pnpm --filter @muse/collectors test                      # 파서 테스트
```
⚠️ 각 사이트의 목록 주소·구조는 **첫 실행 때 --dry로 확인**해야 합니다 (개발 환경에서 해당 사이트 접속이 막혀 있어 실제 페이지로는 아직 검증 전).
결과가 0건이거나 이상하면 `packages/collectors/src/sources/*.ts`의 주소와 `link` 조건을 조정하세요.

## 다음 단계
- 수집기 실제 사이트 검증 → 지역 문화재단·대관·나라장터 추가
- PC 앱(Electron)으로 감싸기 + 지원서 작업 폴더 + MCP 연결
- 휴대폰 웹푸시 마감 알림

## 기업 지원사업 분야 (2026-10 추가)

피드의 **어떤 지원이 필요한가요?**에서 사업비·자금 지원, 대출·정책자금,
수출바우처, 전시·박람회, 디자인·브랜딩, 연구개발·연구소, 예술·브랜드 협업을 선택합니다.
관심 분야(뷰티·향·화장품), 기관(KOTRA·예경·문체부), 대상(여성기업·여성창업)은
접힌 상세 조건에서 선택합니다. 같은 묶음은 OR, 다른 묶음은 AND로 적용됩니다.
선택 조건은 접어도 표시되며 개별 해제·초기화와 현재 결과 건수를 제공합니다.
기존 단일 topic 설정을 유지해 읽고, 새 선택부터 topics 배열로 저장합니다.
기존 종류 탭·검색·지역 조건과 함께 적용됩니다. 지원 조건 초기화는 이 분류만 해제합니다.
분류는 제목·기관·본문·검색 출처 기반입니다. 공식 업종 분류나 지원 자격 판정이 아닙니다.
예술·브랜드 협업은 기존 수집 공고에서 예술과 협업 관련 키워드가 함께 있는 경우를 찾으며,
기업·컨소시엄 참여 가능 여부까지 보장하지 않습니다.
여성기업 확인서나 연구소가 없어도 관련 공고를 숨기지 않으며,
개인사업자 허용 여부·사업장 지역·서류 보유 조건은 반드시 원문으로 확인합니다.

추가 수집처:
- 기업마당: 뷰티·화장품·디자인·여성기업·여성창업·전시회·박람회·연구개발,
  기업부설연구소 본문 검색, 예경/KOTRA 수행기관 및 문체부 소관 공고,
  서울·송파 및 수출바우처·수출지원기반활용 제목 검색. API 키 없이 공개 목록을 읽습니다.
  대출·융자·정책자금·특례보증·신용보증·이차보전·자금·지원금·보조금·사업비 지원·사업화 지원·이자 지원 제목 검색도 포함합니다.
- KOTRA 무역투자24: 신청기한이 있는 사업과 상시 사업을 분리 수집합니다.
- 여성기업 종합정보포털: 모집중 사업공고를 수집합니다.
- 기존 예술경영지원센터 직접 수집은 유지합니다.

문체부·디자인·연구소·수출바우처·대출·자금지원 등은 기업마당에 등록된 공고를 가져옵니다.
대출·융자와 자금지원은 별도 필터이며 복합 사업은 양쪽에 표시될 수 있습니다.
자금지원 분류는 무상지원 보장이 아닙니다. 금리·보증료·상환·심사 조건 및 자부담·정산·환수 조건을 원문에서 확인하며 금융 신청은 자동으로 수행하지 않습니다.
수출바우처는 관련 사업 명칭도 함께 분류하되, 일반 수출사업 전체를 바우처로 분류하지 않습니다.
수출 실적 보유만으로 자격을 확정하지 않으며, 기준연도·인정금액·증빙·업종·규모·자부담·중복지원 조건은 원문 확인 대상입니다.
모든 기관의 모든 공고를 보장하지는 않습니다. 한 실행당 기업마당은 검색별
최대 10페이지(15건씩), KOTRA는 유형별 최대 5페이지(100건 요청),
여성기업 포털은 최대 3페이지를 읽습니다. 같은 URL은 합치고 검색 분류를 보존합니다.
신청기간만 마감일로 사용하며 게시일·행사 개최일을 마감일로 추정하지 않습니다.

검증 (저장하지 않음):
```bash
pnpm --filter @muse/collectors test
pnpm --filter @muse/collectors typecheck
pnpm --filter web typecheck
pnpm --filter @muse/collectors collect:dry --only=bizinfo
pnpm --filter @muse/collectors collect:dry --only=kotra
pnpm --filter @muse/collectors collect:dry --only=wbiz
```
기존 GitHub Actions 공고 수집에 자동 포함됩니다. 배포 후 첫 수집은 Actions의
공고 수집 → Run workflow로 실행할 수 있습니다. 개인정보·사업자등록증은
공개 코드에 저장하지 말고 로그인한 계정의 지원 주체 설정에서 관리하세요.

## 먼저 살펴볼 공고

피드 상단에 로그인 계정의 지원 주체 프로필·관심 키워드로 계산한 추천 3건을 표시합니다.
현재 검색·분류 필터와 독립적으로 표시하며 추천 사유, 주체 이름, 마감 및 확인할 자격 조건을 제공합니다.
같은 공고의 수집처 중복, 마감, 명시적 타 지역·다른 구 제한, 해당 주체 지원 불가 판정은 추천에서 제외합니다.
기업 프로필의 협업 선호가 있으면 단독 개인작가·레지던시 공고를 우선 추천하지 않습니다.
프로필이 없거나 근거가 부족하면 임의 추천 대신 설정 안내를 표시합니다. 개인 프로필은 공개 코드에 포함하지 않습니다.
이 추천은 키워드 기반 검토 순서이며 지원 자격·선정·금융 심사 결과를 보장하지 않습니다.
아직 안 본 상위 추천 건수, 추천·저장 공고의 7일 이내 마감 안내는 사이트 내부에서만 표시됩니다.
한국 날짜 기준으로 계산하고 화면이 열린 동안 매분 갱신합니다. 이메일·문자·브라우저 푸시는 발송하지 않습니다.
프로필·키워드는 설정에서 수정하며, 기존 전체 공고 검색과 원문 확인 기능은 유지됩니다.
