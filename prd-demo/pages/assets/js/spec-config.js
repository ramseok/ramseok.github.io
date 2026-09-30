/* =====================================================================
   spec-config.js — 프로젝트별 리뷰 드로어 설정 (자동 생성 파일)

   ⚠️ 이 파일은 `.claude/kit/install-review-kit.ps1` 이 02_PAGE.md 를 읽어 생성한다.
      손으로 라벨을 고치지 말고, 02_PAGE.md 를 고친 뒤 설치 스크립트를 다시 실행한다.
      (Supabase 키는 손으로 넣는 값이며, 재설치해도 보존된다.)

   - project     : 저장소 네임스페이스. 같은 Supabase 테이블을 여러 프로젝트가 공유해도
                   page_key 앞에 이 슬러그가 붙어 코멘트가 섞이지 않는다.
   - labels      : 코멘트 '기획서 No.' 자동 표기용 (02_PAGE.md 의 ID + 페이지명)
   - supabaseUrl / supabaseKey
                 : **비어 있으면 localStorage 모드** — 코멘트·테스트케이스 결과가 그 브라우저에만 남는다.
                   고객사와 함께 보려면 Supabase 값 2개를 여기 넣는다 (중앙 저장·전원 공유로 자동 전환):
                     · supabaseUrl : Supabase 대시보드 > Settings > API > Project URL
                     · supabaseKey : 같은 화면의 **anon public** 키 (service_role 키는 절대 넣지 않는다)
                   테이블·버킷 셋업은 `.claude/kit/supabase-setup.sql` 을 SQL Editor 에서 한 번 실행.
                   자세한 절차·문제해결은 `.claude/kit/SUPABASE_MANUAL.md`.
   ===================================================================== */
window.SPEC_CONFIG = {
  project: 'rainbow-diary',
  supabaseUrl: '',
  supabaseKey: '',
  labels: {
    'user/splash': 'P1 스플래시',
    'user/login': 'P2 로그인',
    'user/onboarding-pet': 'P3 온보딩: 반려견 등록',
    'user/home': 'P4 상태별 홈',
    'user/pet-manage': 'P5 반려견 관리',
    'user/rainbow-transition': 'P6 무지개다리 전환',
    'user/family-share': 'P7 가족 공유',
    'user/notification-settings': 'P8 알림·표시 설정',
    'user/diary-list': 'P9 일상 다이어리 목록',
    'user/diary-write': 'P10 다이어리 작성·수정',
    'user/health-record': 'P11 건강·삶의 질 기록',
    'user/sound-pawprint': 'P12 소리·발도장 보관함',
    'user/timeline': 'P13 추억 타임라인',
    'user/bucket-list': 'P14 버킷리스트',
    'user/prep-checklist': 'P15 준비 체크리스트·마지막 날 플래너',
    'user/pre-letter': 'P16 미리 쓰는 편지',
    'user/funeral-info': 'P17 장례 정보',
    'user/memorial-edit': 'P18 메모리얼 페이지 관리',
    'user/memorial-public': 'P19 공개 추모관 (비회원·가족 방문자)',
    'user/letter-to-sky': 'P20 하늘로 보내는 편지',
    'user/care-content': 'P21 케어 콘텐츠',
    'user/community': 'P22 커뮤니티',
    'user/memorial-extras': 'P23 추모 확장(앨범 제작·AI 회고록)',
    'user/account-billing': 'P24 구독·결제·데이터 내보내기',
    'user/inquiry': 'P25 1:1 문의',
    'user/mypage': 'P26 마이페이지',
    'admin/login': 'P27 관리자 로그인',
    'admin/dashboard': 'P28 대시보드(통계)',
    'admin/members': 'P29 회원·반려견 관리',
    'admin/inquiries': 'P30 1:1 문의 관리',
    'admin/content-cms': 'P31 콘텐츠 관리(CMS)',
    'admin/reports': 'P32 신고·모더레이션',
    'admin/partners': 'P33 제휴 업체 관리'
  }
};
