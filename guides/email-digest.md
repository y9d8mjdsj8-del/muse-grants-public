# PC 없이 받는 지원사업 이메일

GitHub Actions가 한국 시간 오전 8:17에 매일 실행합니다. 예약 실행은 지연될 수 있습니다.
Resend를 통해 하루 최대 한 통, 새 추천과 저장 공고 D-7/D-3/D-1을 묶어 보냅니다.
새 추천은 사이트와 같은 매칭 로직을 쓰고, 숨김·삭제·비추를 제외합니다.
새 추천 상위 5건만 본문에 표시하며 전체 건수를 안내합니다. 나머지는 사이트에서 확인합니다.
내용이 없으면 발송하지 않습니다. 최초 실행은 기준 시각만 저장해 과거 공고 대량 발송을 막습니다.

## 연결 순서
1. Supabase SQL Editor에서 `cloud/supabase/migrations/0008_email_digest.sql` 실행.
2. Resend 계정과 발신 도메인을 연결·검증하고 발송 전용 API key 생성.
   테스트 도메인은 계정 소유자에게만 시험 발송 가능하며 운영용 검증 도메인을 권장합니다.
3. GitHub Settings → Secrets and variables → Actions에 다음 **Secrets** 저장.
   - `RESEND_API_KEY`: 발송 전용 키
   - `DIGEST_USER_ID`: Supabase Authentication → Users의 실제 사이트 사용자 UUID
   - `DIGEST_TO`: 알림을 받을 이메일 한 개 (사이트 로그인 주소와 달라도 됨)
   - `DIGEST_FROM`: 검증된 발신 주소 (예: MUSE Grants <grants@example.com>)
   - 기존 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 사용
4. **Variables**에 `DIGEST_SITE_URL` (사이트 HTTPS 주소), `EMAIL_DIGEST_ENABLED=true` 저장.
5. ‘지원사업 이메일’ 작업을 dry_run으로 실행한 후 발송 모드로 실행해 기준 시각 초기화.
   이후 새 추천이나 마감 대상이 있어야 실제 메일이 발송됩니다.
6. 받은 메일에서 링크·Gmail 라벨 적용을 확인. API 성공은 수신 성공과 다릅니다.

키·수신 주소·사용자 UUID는 공개 코드나 로그에 넣지 마세요.
Gmail 필터: 제목에 `"MUSE Grants" 지원사업` → 지원사업 라벨 적용 + 받은편지함 건너뛰기.
중지: GitHub Actions → 지원사업 이메일 → Disable workflow, 또는 EMAIL_DIGEST_ENABLED=false.

## 장애 처리
발송 본문과 중복 방지 키를 비공개 DB에 먼저 저장하고 같은 본문으로 재시도합니다.
Resend 중복 방지 키 유효기간은 24시간이므로, 미확정 발송이 23시간 넘으면 자동 중단합니다.
Resend 발송 기록과 DB outbox를 대조해 운영자가 해소해야 합니다. 임의 삭제 후 재발송하지 마세요.
워크플로 외부에서 동시에 실행하지 마세요. 일일 발송 잠금은 워크플로 concurrency와 DB 일자 고유키를 함께 사용합니다.
GitHub 예약 작업이 중단되거나 지연되면 알림도 지연되며, 지난 D-7/D-3/D-1 알림을 소급하지 않습니다.
공개 저장소의 예약 작업 비활성화 안내를 받으면 Actions에서 재활성화하세요.

검증: `pnpm --filter @muse/collectors exec tsx test/digest.test.ts`
실데이터 발송 없는 점검: `pnpm --filter @muse/collectors exec tsx src/send-digest.ts --dry`

## 초기 연결 검증
워크플로 파일을 main에서 변경하면 활성화된 설정으로 한 번 실행하고, 이어서 발송 없는 프로필·선별 검증을 수행합니다.
수동 실행의 test_email은 별도 테스트 메일 전용입니다. dry_run을 해제해야 실제 발송되며 정기 발송 기준 시각은 바꾸지 않습니다.
테스트 성공은 메일 서비스 접수를 뜻합니다. 수신함 도착 및 해당 수신 계정의 Gmail 필터 적용은 별도로 확인하세요.
