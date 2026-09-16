// Supabase 연결 정보 — 두 값을 채우면 index.html 은 DB 내용을, admin.html 은 편집 기능을 사용한다.
// 비어 있으면 index.html 은 data.default.js 의 기본 내용만 보여준다.
// anon key 는 공개용 키(브라우저 노출 전제)이며, 쓰기 권한은 supabase-setup.sql 의 RLS 가 막는다.
window.PORTFOLIO_CONFIG = {
  SUPABASE_URL: 'https://akdrzligoexmvsshghfz.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZHJ6bGlnb2V4bXZzc2hnaGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0ODkxMjEsImV4cCI6MjEwNTA2NTEyMX0.DyDH9kndpIgRnFwA9LvUsz8zoSWGQBcYiDWAKxuOmp0',
  BUCKET: 'portfolio',   // supabase-setup.sql 이 만드는 공개 버킷
  ROW_ID: 'main',        // portfolio 테이블의 행 id (사이트 하나 = 행 하나)
};
