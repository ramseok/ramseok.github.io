# PM 포트폴리오 (ramseok.github.io)

서핏 커리어 프로필 Standard 테마를 본뜬 정적 포트폴리오 + Supabase 기반 관리자 페이지.

| 파일 | 역할 |
|---|---|
| `index.html` + `site.js` | 공개 페이지. `data.default.js` 를 먼저 그리고, Supabase 에 저장된 내용이 있으면 덮어 그린다 |
| `admin.html` + `admin.js` | 관리자. 로그인 → 섹션별 편집 → 저장. 프로필 사진·프로젝트 이미지·파일 업로드 |
| `data.default.js` | 기본 콘텐츠 (DB 가 비어 있을 때 표시, 관리자 첫 진입 시 초기값) |
| `config.js` | Supabase URL / anon key |
| — | DB 초기 설정 SQL 은 비공개 저장소(pm-work)의 `setup/supabase-setup.sql` 에 있다 |

## 처음 한 번 설정

1. supabase.com → New project (Region: Northeast Asia — Seoul)
2. SQL Editor → 비공개 저장소의 `setup/supabase-setup.sql` 전체 붙여넣고 Run
   - 파일 상단 `portfolio_owner_email()` 의 이메일을 본인 관리자 이메일로 맞출 것
3. Authentication → Users → **Add user** (2번 이메일과 동일하게, 비밀번호 지정, Auto Confirm 체크)
4. Authentication → Providers → Email → **Allow new users to sign up** 끄기
5. Project Settings → API → Project URL, anon public key 를 `config.js` 에 입력
6. `git push` → 1분 뒤 https://ramseok.github.io/admin.html 에서 로그인

## 지원처별 버전 (예: `/megazone`)

같은 포트폴리오를 지원처마다 다른 버전으로 내보낼 수 있다. **달라지는 항목만 저장**되고 나머지는 기본 문서(main)를 그대로 따라가므로, 프로젝트 카드 같은 공통 내용을 고치면 모든 버전에 자동 반영된다.

### 새 버전 만드는 순서

1. **관리자 → 버전 → `+ 새 버전`** — 주소(슬러그)와 지원처명을 입력한다. 슬러그는 영문 소문자·숫자·하이픈 2~39자
2. 바꾸고 싶은 섹션에서 **`이 버전에서 다르게 쓰기`** 를 누르고 수정 → **저장**
   - 버튼을 누르지 않은 섹션은 기본 문서를 그대로 상속한다 (사이드 메뉴의 `●` 표시 = 이 버전에서 다르게 쓰는 섹션)
3. 페이지 폴더를 만들고 커밋한다
   ```bash
   node scripts/new-version.mjs megazone
   git add megazone && git commit -m "feat: megazone 버전 페이지" && git push
   ```
4. 링크: `https://ramseok.github.io/megazone/`

### 지원서마다 디자인 바꾸기

관리자의 **디자인** 섹션에서 포인트 컬러 · 배경 · 본문 폭 · 모서리 · 여백을 지정한다. 다른 섹션과 같은 규칙이라, 지원서에서  를 누르면 그 지원서만 다른 색·여백으로 나간다.

| 항목 | 값 |
|---|---|
| 포인트 컬러 | 링크 · 강조 숫자 · 칩 테두리. 지원 회사 브랜드 색을 넣어도 된다 |
| 배경 | 흰색 / 따뜻한 아이보리 / 차가운 연회색 |
| 본문 폭 | 1240 / 1100 / 960px |
| 모서리 | 많이 둥글게 / 살짝 / 각지게 |
| 여백 | 보통 / 넓게 / 좁게 |

CSS 토큰(`--point` `--bg` `--content-max` `--radius` `--padding-*`)을 덮어쓰는 방식이라 레이아웃은 모든 지원서가 동일하다.

### 알아둘 것

- **버전 삭제는 두 군데** — 관리자에서 삭제하면 내용만 지워지고, 링크를 완전히 닫으려면 저장소의 해당 폴더도 지워야 한다
- **지원한 회사 목록은 공개되지 않는다** — 공개 페이지는 `get_portfolio(slug)` 함수로 해당 버전 1건만 받아 간다. 목록 조회는 로그인한 본인만 가능 (`setup/supabase-versions.sql`)
- 이미지·파일은 버전과 무관하게 공유된다
- 슬러그로 쓸 수 없는 이름: `admin` `assets` `scripts` `setup` `index` `styles` `config` `site` `data`

## 편집 규칙

- 텍스트에서 `**굵게**` 는 굵게, `[대괄호]` 는 노란 자리표시자로 표시된다. 자리표시자가 하나라도 남아 있으면 우하단에 "초안" 배지가 뜬다.
- 목록형 항목(경력·프로젝트·학력 등)은 비우면 해당 섹션과 사이드 메뉴가 자동으로 숨겨진다.
- 저장 전 **JSON 내보내기** 로 백업할 수 있고, 내보낸 파일은 **JSON 가져오기** 로 복원된다.
- 이미지는 `portfolio` 버킷의 `profile/` `projects/` `files/` 폴더에 올라간다.
