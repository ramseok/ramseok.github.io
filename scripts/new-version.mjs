#!/usr/bin/env node
// 지원처별 버전 페이지 폴더 생성
//   node scripts/new-version.mjs megazone "메가존클라우드 공공사업 PM"
// → megazone/index.html 을 만든다. 커밋·푸시하면 https://ramseok.github.io/megazone/ 로 열린다.
// 내용(문서)은 관리자 페이지에서 같은 슬러그로 만든 버전을 따라간다.
import fs from 'node:fs';
import path from 'node:path';

const slug = (process.argv[2] || '').trim().toLowerCase();
const label = (process.argv[3] || '').trim();
if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(slug)) {
  console.error('슬러그는 영문 소문자·숫자·하이픈 2~39자여야 합니다.  예) node scripts/new-version.mjs megazone');
  process.exit(1);
}
const RESERVED = ['admin', 'assets', 'scripts', 'setup', 'index', 'styles', 'config', 'site', 'data'];
if (RESERVED.includes(slug)) { console.error('예약어라 슬러그로 쓸 수 없습니다: ' + slug); process.exit(1); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dir = path.join(root, slug);
if (fs.existsSync(dir)) { console.error('이미 있는 폴더입니다: ' + slug); process.exit(1); }

const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/(href|src)="(?!https?:|\/\/|#|mailto:|tel:|data:|\.\.\/)([^"]+)"/g, '$1="../$2"')
  .replace('<script src="../site.js"></script>',
    '<script>window.PORTFOLIO_VARIANT = ' + JSON.stringify(slug) + ';</script>\n<script src="../site.js"></script>');

fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, 'index.html'), shell);
console.log('만들었습니다: ' + slug + '/index.html' + (label ? '  (' + label + ')' : ''));
console.log('');
console.log('다음 순서로 진행하세요.');
console.log('  1) 관리자 페이지 → 버전 → 새 버전 만들기 → 슬러그에 "' + slug + '" 입력');
console.log('  2) git add ' + slug + ' && git commit -m "feat: ' + slug + ' 버전 페이지" && git push');
console.log('  3) 링크: https://ramseok.github.io/' + slug + '/');
