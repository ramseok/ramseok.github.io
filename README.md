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

## 편집 규칙

- 텍스트에서 `**굵게**` 는 굵게, `[대괄호]` 는 노란 자리표시자로 표시된다. 자리표시자가 하나라도 남아 있으면 우하단에 "초안" 배지가 뜬다.
- 목록형 항목(경력·프로젝트·학력 등)은 비우면 해당 섹션과 사이드 메뉴가 자동으로 숨겨진다.
- 저장 전 **JSON 내보내기** 로 백업할 수 있고, 내보낸 파일은 **JSON 가져오기** 로 복원된다.
- 이미지는 `portfolio` 버킷의 `profile/` `projects/` `files/` 폴더에 올라간다.
