# AI 업무 자동화 포트폴리오 (PDF)

`portfolio-source.html` 한 파일이 원본입니다. 이 HTML을 Chrome으로 인쇄해 PDF를 만듭니다.

## 파일

| 파일 | 설명 |
|---|---|
| `portfolio-source.html` | **원본.** A4 19페이지. 여기만 고치면 됩니다 |
| `portfolio.pdf` | 생성 결과 (영문 파일명 — 모바일·메신저 전달용) |
| `AI업무자동화_포트폴리오.pdf` | 같은 파일의 한글 파일명 사본 |
| `*.png` | 원본 스크린샷 (PM Station 11장 · PRD Toolkit 6장) |
| `crops/*.png` | 설명에 맞춰 잘라낸 이미지. `tools/crop.py`로 생성 |
| `tools/crop.py` | PNG 크롭 스크립트 (macOS `sips` 사용) |

원본 스크린샷 전체는 비공개 저장소 `pm-work` 의 `ax-portfolio/assets/` 에도 있습니다.

## PDF 다시 만들기

**macOS**

```bash
cd assets/ax
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --no-pdf-header-footer --virtual-time-budget=30000 \
  --print-to-pdf=portfolio.pdf "file://$PWD/portfolio-source.html"
cp portfolio.pdf "AI업무자동화_포트폴리오.pdf"
```

**Windows (PowerShell)**

```powershell
cd assets\ax
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new `
  --disable-gpu --no-pdf-header-footer --virtual-time-budget=30000 `
  --print-to-pdf="$PWD\portfolio.pdf" "file:///$($PWD -replace '\\','/')/portfolio-source.html"
Copy-Item portfolio.pdf "AI업무자동화_포트폴리오.pdf"
```

Chrome 없이 확인만 할 때는 `portfolio-source.html` 을 브라우저로 열고 `Ctrl/Cmd + P` → 대상 "PDF로 저장",
용지 A4, 여백 **없음**, **배경 그래픽 켜기** 로 인쇄해도 동일한 결과가 나옵니다.

## 레이아웃 미리보기 (페이지 단위로 눈으로 확인)

전체를 한 장으로 캡처한 뒤 1123px 높이로 잘라 보면 각 페이지가 어떻게 나뉘는지 확인할 수 있습니다.
(18페이지 × 1123px = 20214)

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --hide-scrollbars --virtual-time-budget=25000 \
  --window-size=794,20214 --screenshot=pages.png "file://$PWD/portfolio-source.html"
python3 tools/crop.py pages.png p01.png 0 0 794 1123      # 1페이지
python3 tools/crop.py pages.png p02.png 0 1123 794 1123   # 2페이지 …
```

## 이미지 자르기

```bash
python3 tools/crop.py <원본.png> <저장경로.png> <x> <y> <너비> <높이>
# 예) python3 tools/crop.py pm-notify.png crops/pm-notify-teams.png 860 330 1700 620
```

`sips`(macOS 기본 내장)를 씁니다. Windows에서는 Python `Pillow` 로 대체하거나 그림판/캡처 도구로 잘라도 됩니다.

## 구조 (19페이지)

| 페이지 | 내용 |
|---|---|
| 01 | 표지 (고지 문구 포함) |
| 02 | 한 장 요약 — 지표 4 · 두 시스템 비교표 · 공통 기준 · CONTENTS |
| — | PRD Toolkit 도입 (Project 01, 노트북 + 폰 목업, 쪽번호 없음) |
| 04 | PRD Toolkit 개요 — 가상 예시 고지 · 문제 · 해결 · 성과 · 이전→이후 표 |
| 05–08 | PRD Toolkit 산출물 — 시안 허브 / 화면별 기획서 / TC·코멘트 / 관리자 시안·디자인 가이드 |
| 09 | PRD Toolkit 도구 선정 — 디자인 자동화 도구 7종을 품질 · 비용 · Claude Code 연동 · 공수로 비교 |
| — | PM Station 도입 (Project 02, 노트북 목업, 쪽번호 없음) |
| 11 | PM Station 개요 — 문제 · 해결 · 성과 |
| 12–18 | PM Station 화면 — 대시보드 / WBS·상세 / Teams 알림 / 운영 보고서 / AI 회의록 / AI 챗봇 / 변경 이력 |
| — | 마무리 (쪽번호 없음) |

## 손댈 때 주의

- 페이지는 `.page` (210×297mm 고정) 한 덩어리입니다. 내용을 늘리면 **다음 페이지로 넘치지 않고 잘립니다.** 추가 후에는 반드시 미리보기로 확인하세요.
- 각 `.page` 안의 `.pnum` 값이 곧 인쇄되는 쪽번호입니다. 페이지를 추가·삭제하면 **뒤쪽 번호를 모두 손으로 고쳐야 합니다.**
- PRD Toolkit 산출물은 **가상 예시 프로젝트(무지개 일기)** 로 생성한 것입니다. 실제 고객사 산출물로 교체하지 마세요 (01 · PRD 도입 · 04페이지와 꼬리말에 고지돼 있음).
- 수치는 **1~2주 → 30분~1시간** 으로 통일돼 있습니다. `data.default.js` · 이력서 자소서와 같은 값이어야 합니다.

## 디자인 원칙

- 포인트 컬러는 `--accent`(#e2461c) 하나만 씁니다. 파스텔 배경 상자 · 색 배지 · 둥근 카드는 쓰지 않습니다.
- 구분은 면이 아니라 **선**으로 합니다 — 섹션 머리 .6pt, 수치 · 카드 머리 1.4pt.
- 영문 · 숫자는 Inter Tight, 한글은 Pretendard. 큰 제목은 자간을 좁게(-.035em 이하).
- 내용 페이지의 남는 아래 공간은 원본 맨 끝의 `autospace` 스크립트가 항목 사이 간격으로 자동 분배합니다(간격당 최대 16mm). 레이아웃이 이상하면 이 스크립트부터 확인하세요.
- 프로젝트 앞에는 도입 페이지(.dv)를 둡니다: 번호 · 이름 · 한 줄 설명 → 기기 목업 → 핵심 수치 3개 → Role · Period · Stack.
