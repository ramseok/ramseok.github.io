/* =====================================================================
   spec-viewer.js — Ctrl + / 우측 슬라이드 리뷰 드로어 (리뷰 키트 소유 파일)

   이 파일은 **키트 자산**이다. 프로젝트마다 다시 쓰지 않고 그대로 복사한다.
   (원본: .claude/kit/spec-viewer.js → 설치 위치: pages/assets/js/spec-viewer.js)
   프로젝트마다 달라지는 값은 전부 spec-config.js 의 window.SPEC_CONFIG 로 주입한다 —
   이 파일을 프로젝트별로 편집하지 않는다.

   pages/user|admin/*.html 에서 로드되어 Ctrl + / (또는 우하단 '기획서' 버튼)로 열리고,
   탭 3개를 슬라이드 패널로 보여 준다.

   - 페이지 안내   : pages/specs/<타겟>/<파일명>.md 를 fetch → 마크다운 렌더 (드로어에서 수정·저장 가능)
   - 고객사 코멘트 : 코멘트 등록·상태(검토중/수정중/논의 필요/완료)·첨부·수정 로그·답글 스레드
   - 테스트케이스  : window.SPEC_TESTCASES[pageKey] 정의 + 결과(Pass/Fail)·코멘트 저장

   페이지가 넣어야 할 태그 (</body> 직전, 이 순서):
     <script src="../assets/js/spec-config.js" defer></script>
     <script src="../specs/<타겟>/<파일명>.tc.js" defer></script>
     <script src="../assets/js/spec-viewer.js" defer></script>
   → spec-viewer.css 는 이 스크립트가 자기 경로를 기준으로 자동 삽입하므로 <link> 는 필요 없다.

   저장소:
   - SPEC_CONFIG.supabaseUrl/Key 가 있으면 Supabase(중앙 저장·전원 공유)
   - 없으면 localStorage(이 브라우저에만 저장)
   - page_key 는 SPEC_CONFIG.project 접두사로 네임스페이스를 분리한다
     (여러 프로젝트 시안이 같은 테이블을 써도 서로 섞이지 않는다)
   ===================================================================== */
(function () {
  /* ---------- 프로젝트 설정 — pages/assets/js/spec-config.js 에서 주입 ----------
     { project: '<슬러그>', labels: { 'user/home': 'P2 홈', ... },
       supabaseUrl: '...', supabaseKey: '...' }
     supabaseUrl/Key 를 비우면 이 브라우저의 localStorage 에만 저장된다. */
  var CFG = window.SPEC_CONFIG || {};
  var SUPABASE_URL = CFG.supabaseUrl || '';
  var SUPABASE_ANON_KEY = CFG.supabaseKey || '';

  /* 프로젝트 네임스페이스 — 다른 시안과 코멘트가 섞이지 않도록 page_key 앞에 붙인다 */
  var PROJECT = CFG.project || 'prd';

  /* ---------- spec-viewer.css 자동 삽입 (페이지에 <link> 를 넣지 않아도 되게) ---------- */
  (function ensureCss() {
    if (document.querySelector('link[href*="spec-viewer.css"]')) return;
    var me = document.querySelector('script[src*="spec-viewer.js"]');
    var base = me ? me.getAttribute('src').replace(/js\/spec-viewer\.js.*$/, '') : '../assets/';
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = base + 'css/spec-viewer.css';
    document.head.appendChild(link);
  })();
  var m = location.pathname.match(/\/pages\/(user|admin)\/([^\/]+)\.html$/i) ||
          location.pathname.match(/\/(user|admin)\/([^\/]+)\.html$/i); // 배포(pages가 루트) 대응
  if (!m) return; // 허브 등 대상 아님

  var pageKey = m[1] + '/' + m[2];          // 예: user/home — 기획서 파일 경로용
  var scopeKey = PROJECT + ':' + pageKey;   // 예: myproj:user/home — 저장소 키
  var specUrl = '../specs/' + pageKey + '.md';
  var SPEC_KEY = '__spec__:' + scopeKey;    // 드로어에서 수정한 기획서 저장 스코프(.md를 덮어씀)
  var specMd = '';        // 현재 기획서 원문(마크다운)
  var specRowId = null;   // Supabase 저장본 행 id(있으면 수정, 없으면 신규 저장)
  var storeKey = 'spec-comments:' + scopeKey;
  var REMOTE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  var SB_TABLE = SUPABASE_URL + '/rest/v1/spec_comments';
  var SB_BUCKET = SUPABASE_URL + '/storage/v1/object';

  var overlay = null, imgModal = null, mdLoaded = false;
  var guideBody = null, cmtListEl = null, cmtCountEl = null;
  var tcListEl = null, tcCountEl = null;
  var tcRows = [];        // 테스트케이스 결과/코멘트 저장 행(page_key=__tc__:scopeKey)
  var tcLoaded = false, tcLoadError = false;
  var TC_SCOPE = '__tc__:' + scopeKey;
  var tcStoreKey = 'spec-testcases:' + scopeKey;
  var comments = [];
  var pendingFiles = [];   // 폼에서 선택된 첨부 파일 목록 [{file, name}]
  var editingMain = -1;    // 고객사 코멘트 본문 편집 중인 행 index
  var cmtLoadError = false;

  /* ---------- 기획서 라벨 (02_PAGE.md 기준) ---------- */
  /* ---------- 기획서 라벨 (02_PAGE.md 기준) — spec-config.js 의 labels 에서 주입 ---------- */
  var PAGE_LABELS = CFG.labels || {};
  var CURRENT_LABEL = PAGE_LABELS[pageKey] || pageKey;
  var STATUSES = ['검토중', '수정중', '논의 필요', '완료'];
  // 상태 → 카드 강조 클래스
  var ST_CLASS = { '검토중': 'review', '수정중': 'progress', '논의 필요': 'discuss', '완료': 'done' };

  /* ---------- 테스트케이스 정의 — pages/specs/<타겟>/<파일명>.tc.js 에서 주입 (window.SPEC_TESTCASES) ---------- */
  var TC_STATUSES = ['미확인', 'Pass', 'Fail'];
  var TC_CLASS = { 'Pass': 'pass', 'Fail': 'fail' };
  function tcDefs() {
    var all = window.SPEC_TESTCASES || {};
    return all[pageKey] || [];
  }
  var DELETED_KEY = '__deleted__';   // 삭제 표식 — page_key를 이 값으로 바꿔 조회에서 제외

  /* ---------- markdown → html ---------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  }
  function renderTable(rows) {
    var parseRow = function (r) {
      return r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|')
        .map(function (c) { return inline(esc(c.trim())); });
    };
    var header = parseRow(rows[0]);
    var body = rows.slice(1);
    if (body.length && /^\s*\|?\s*:?-{2,}/.test(body[0])) body = body.slice(1);
    var html = '<div class="spec-table-wrap"><table><thead><tr>';
    header.forEach(function (c) { html += '<th>' + c + '</th>'; });
    html += '</tr></thead><tbody>';
    body.forEach(function (r) {
      html += '<tr>';
      parseRow(r).forEach(function (c) { html += '<td>' + c + '</td>'; });
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }
  function renderList(block) {
    var html = '<ul>', sub = false;
    block.forEach(function (raw) {
      var nested = /^\s{2,}/.test(raw);
      var text = inline(esc(raw.replace(/^\s*[-*]\s+/, '')));
      if (nested) {
        if (!sub) { html += '<ul>'; sub = true; }
        html += '<li>' + text + '</li>';
      } else {
        if (sub) { html += '</ul>'; sub = false; }
        html += '<li>' + text + '</li>';
      }
    });
    if (sub) html += '</ul>';
    return html + '</ul>';
  }
  function renderMd(md) {
    var lines = md.replace(/\r/g, '').split('\n');
    var html = '', i = 0, buf, h;
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      if (/^-{3,}\s*$/.test(line)) { html += '<hr>'; i++; continue; }
      h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        var lv = h[1].length;
        html += '<h' + lv + '>' + inline(esc(h[2])) + '</h' + lv + '>';
        i++; continue;
      }
      if (/^\s*\|/.test(line)) {
        buf = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { buf.push(lines[i]); i++; }
        html += renderTable(buf);
        continue;
      }
      if (/^>\s?/.test(line)) {
        buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^>\s?/, '')); i++;
        }
        html += '<blockquote>' + buf.map(function (l) { return inline(esc(l)); }).join('<br>') + '</blockquote>';
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        buf = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { buf.push(lines[i]); i++; }
        html += renderList(buf);
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        buf = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++;
        }
        html += '<ol>' + buf.map(function (l) { return '<li>' + inline(esc(l)) + '</li>'; }).join('') + '</ol>';
        continue;
      }
      buf = [line]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) &&
             !/^(#{1,4}\s|\s*\||>\s?|-{3,}\s*$|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      html += '<p>' + buf.map(function (l) { return inline(esc(l)); }).join('<br>') + '</p>';
    }
    return html;
  }

  /* ---------- Supabase REST 헬퍼 ---------- */
  function sbHeaders(extra) {
    var h = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };
    if (extra) { for (var k in extra) h[k] = extra[k]; }
    return h;
  }
  function sbLoad() {
    return fetch(SB_TABLE + '?page_key=eq.' + encodeURIComponent(scopeKey) + '&order=id.asc', {
      headers: sbHeaders()
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  function sbInsert(row) {
    return fetch(SB_TABLE, {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
      body: JSON.stringify([row])
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (rows) { return rows[0]; });
  }
  function sbPatch(id, patch) {
    return fetch(SB_TABLE + '?id=eq.' + id, {
      method: 'PATCH',
      headers: sbHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch)
    }).then(function (r) { if (!r.ok) throw new Error(r.status); });
  }
  // 첨부 파일 업로드 — comment-images 버킷에 원본 그대로 저장
  function sbUploadFile(file, name) {
    var ext = (String(name).match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    var path = scopeKey.replace(/[:\/]/g, '-') + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e4) + ext;
    return fetch(SB_BUCKET + '/comment-images/' + path, {
      method: 'POST',
      headers: sbHeaders({ 'Content-Type': file.type || 'application/octet-stream' }),
      body: file
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return SB_BUCKET + '/public/comment-images/' + path;
    });
  }
  // 코멘트 삭제 — anon 키는 물리 DELETE가 RLS로 차단되므로 page_key를 삭제 스코프로 옮긴다
  function sbDelete(id) {
    return sbPatch(id, { page_key: DELETED_KEY });
  }
  function isImageName(n) { return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n || ''); }
  function downloadUrl(src, name) {
    if (!src) return '#';
    return src + (src.indexOf('?') > -1 ? '&' : '?') + 'download=' + encodeURIComponent(name || 'file');
  }

  /* ---------- 코멘트 로드/저장 ---------- */
  function loadComments() {
    cmtLoadError = false;
    if (!REMOTE) {
      try { comments = JSON.parse(localStorage.getItem(storeKey)) || []; }
      catch (e) { comments = []; }
      return Promise.resolve();
    }
    return sbLoad().then(function (rows) {
      comments = rows;
    }).catch(function () {
      comments = [];
      cmtLoadError = true;
    });
  }
  function saveLocal() {
    try { localStorage.setItem(storeKey, JSON.stringify(comments)); return true; }
    catch (e) { return false; }
  }
  /* 행 변경 저장 — 원격이면 PATCH, 아니면 localStorage */
  function persistRow(i, patch) {
    if (REMOTE && comments[i] && comments[i].id) {
      sbPatch(comments[i].id, patch).catch(function () {
        showListError('변경 사항 저장에 실패했습니다. 네트워크를 확인해 주세요.');
      });
    } else {
      saveLocal();
    }
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  /* 첨부 파일 목록 접근자 — img_url(JSON 배열)·단일 URL·구버전 모두 호환 */
  function filesOf(c) {
    var raw = c.img_url;
    if (typeof raw === 'string' && raw.charAt(0) === '[') {
      try {
        return JSON.parse(raw).map(function (o) { return { url: o.u || '', name: o.n || '' }; });
      } catch (e) { /* 파싱 실패 시 아래 단일 처리로 폴백 */ }
    }
    if (raw) return [{ url: raw, name: c.img_name || '' }];
    if (Array.isArray(c.img)) return c.img.map(function (n) { return { url: '', name: n }; });
    if (typeof c.img === 'string' && c.img) return [{ url: '', name: c.img }];
    return [];
  }

  /* ---------- 협의 스레드 + 수정 로그 인코딩 ----------
     dev 컬럼에 JSON으로 담는다(스키마 변경 불필요).
       { t: [ {b:'d'|'c', x:본문, at:날짜} ],  // 답글 스레드(개발사 d / 고객사 c)
         e: [ {x:이전본문, at:날짜} ] }         // 고객사 코멘트 수정 로그 */
  function parseMeta(c) {
    var raw = c && c.dev;
    if (raw && typeof raw === 'string' && raw.charAt(0) === '{') {
      try {
        var o = JSON.parse(raw);
        return { t: Array.isArray(o.t) ? o.t : [], e: Array.isArray(o.e) ? o.e : [] };
      } catch (e) { /* 아래 폴백 */ }
    }
    if (raw && typeof raw === 'string' && raw.trim()) return { t: [{ b: 'd', x: raw, at: '' }], e: [] };
    return { t: [], e: [] };
  }
  function metaStr(meta) {
    var t = (meta && meta.t) || [], e = (meta && meta.e) || [];
    if (!t.length && !e.length) return '';
    return JSON.stringify({ t: t, e: e });
  }
  /* textarea 자동 높이 조절 — 내용이 박스를 넘으면 함께 늘어남(최대 400px 후 스크롤) */
  function autogrow(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 400) + 'px';
  }

  function showFormError(msg) {
    var errEl = overlay.querySelector('#specCmtError');
    errEl.textContent = msg;
    errEl.classList.add('show');
  }
  function clearFormError() {
    overlay.querySelector('#specCmtError').classList.remove('show');
  }
  function showListError(msg) {
    var el = overlay.querySelector('#specCmtListError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function renderComments() {
    if (cmtCountEl) cmtCountEl.textContent = comments.length + '건';
    if (!cmtListEl) return;
    var errBar = '<div id="specCmtListError" class="spec-error" style="display:none; margin-bottom:10px;"></div>';
    if (cmtLoadError) {
      cmtListEl.innerHTML = errBar +
        '<div class="spec-empty">코멘트를 불러오지 못했습니다.<br>' +
        '네트워크 연결과 Supabase 설정(spec-viewer.js 상단 URL·KEY)을 확인해 주세요.</div>';
      return;
    }
    if (!comments.length) {
      cmtListEl.innerHTML = errBar +
        '<div class="spec-empty">등록된 코멘트가 없습니다.<br>' +
        '화면을 검토하시고 수정·문의 사항을 위 양식으로 남겨 주세요.</div>';
      return;
    }
    var html = errBar + '<div class="cmt-cards">';
    comments.forEach(function (c, i) {
      var meta = parseMeta(c);
      var opts = STATUSES.map(function (s) {
        return '<option' + (c.status === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('');

      // 첨부 파일
      var files = filesOf(c);
      var fileHtml = '';
      if (files.length) {
        fileHtml = '<div class="cmt-card-files"><div class="cmt-file-cell">' + files.map(function (f) {
          if (f.url) {
            if (isImageName(f.name) || (!f.name && /image/i.test(f.url))) {
              return '<img class="cmt-thumb" src="' + escAttr(f.url) + '" alt="' + escAttr(f.name || '첨부 이미지') + '" data-src="' + escAttr(f.url) + '" data-name="' + escAttr(f.name) + '">';
            }
            return '<a class="cmt-file-dl" href="' + escAttr(downloadUrl(f.url, f.name)) + '" target="_blank" rel="noopener" title="' + escAttr(f.name || '다운로드') + '"><i data-lucide="file-down"></i>' + esc(f.name || '다운로드') + '</a>';
          }
          return '<span class="cmt-file-dl" title="' + escAttr(f.name) + '"><i data-lucide="paperclip"></i>' + esc(f.name) + '</span>';
        }).join('') + '</div></div>';
      }

      // 고객사 코멘트 본문(보기/편집)
      var mainHtml;
      if (editingMain === i) {
        mainHtml =
          '<textarea class="textarea cmt-grow cmt-main-input" data-i="' + i + '" placeholder="코멘트 내용">' + esc(c.text) + '</textarea>' +
          '<div class="cmt-edit-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="main-cancel" data-i="' + i + '">취소</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-act="main-save" data-i="' + i + '"><i data-lucide="check"></i>저장</button>' +
          '</div>';
      } else {
        mainHtml =
          '<div class="cmt-maintext">' + esc(c.text) + '</div>' +
          '<button type="button" class="cmt-ic" data-act="main-edit" data-i="' + i + '" title="코멘트 수정"><i data-lucide="pencil"></i></button>';
      }

      // 수정 로그
      var elogHtml = '';
      if (meta.e.length) {
        elogHtml =
          '<button type="button" class="cmt-elog-toggle" data-act="elog" data-i="' + i + '">수정 ' + meta.e.length + '회 · 이전 내용 보기</button>' +
          '<div class="cmt-elog" data-elog="' + i + '" hidden>' +
            meta.e.map(function (ev) {
              return '<div class="cmt-elog-item"><span class="cmt-elog-date">' + esc(ev.at || '') + '</span><span class="cmt-elog-text">' + esc(ev.x) + '</span></div>';
            }).join('') +
          '</div>';
      }

      // 답글 스레드(개발사 ↔ 고객사)
      var threadHtml = meta.t.map(function (msg, mi) {
        var who = (msg.b === 'c') ? '고객사' : '개발사';
        return '<div class="cmt-msg ' + (msg.b === 'c' ? 'is-client' : 'is-dev') + '">' +
            '<div class="cmt-msg-hd"><span class="cmt-role">' + who + '</span>' +
              (msg.at ? '<span class="cmt-msg-date">' + esc(msg.at) + '</span>' : '') +
              '<button type="button" class="cmt-ic cmt-ic-del cmt-msg-del" data-act="msg-del" data-i="' + i + '" data-mi="' + mi + '" title="삭제"><i data-lucide="x"></i></button>' +
            '</div>' +
            '<div class="cmt-msg-text">' + esc(msg.x) + '</div>' +
          '</div>';
      }).join('');

      html +=
        '<div class="cmt-card cmt-st-' + (ST_CLASS[c.status] || 'review') + '">' +
          '<div class="cmt-card-hd">' +
            '<span class="cmt-badge">No.' + (i + 1) + '</span>' +
            '<span class="cmt-ref-chip">' + esc(c.ref || '-') + '</span>' +
            '<span class="cmt-date">' + esc(c.date || '') + '</span>' +
            '<select class="select cmt-status" data-i="' + i + '">' + opts + '</select>' +
            '<button type="button" class="cmt-ic cmt-ic-del" data-act="del" data-i="' + i + '" title="삭제"><i data-lucide="trash-2"></i></button>' +
          '</div>' +
          '<div class="cmt-main"><span class="cmt-role is-client">고객사</span><div class="cmt-main-in">' + mainHtml + '</div></div>' +
          elogHtml +
          fileHtml +
          (threadHtml ? '<div class="cmt-thread">' + threadHtml + '</div>' : '') +
          '<div class="cmt-reply">' +
            '<select class="select cmt-reply-role" data-i="' + i + '"><option value="d">개발사</option><option value="c">고객사</option></select>' +
            '<textarea class="textarea cmt-grow cmt-reply-input" data-i="' + i + '" rows="1" placeholder="답글을 입력하세요 (Ctrl+Enter 등록)"></textarea>' +
            '<button type="button" class="btn btn-primary btn-sm cmt-reply-send" data-act="reply" data-i="' + i + '">저장</button>' +
          '</div>' +
        '</div>';
    });
    cmtListEl.innerHTML = html + '</div>';
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    if (editingMain >= 0) {
      var inp = cmtListEl.querySelector('.cmt-main-input');
      if (inp) { inp.focus(); inp.selectionStart = inp.value.length; }
    }
    cmtListEl.querySelectorAll('.cmt-grow').forEach(autogrow);
  }

  /* 고객사 코멘트 본문 수정 저장 — 내용이 바뀌면 이전 본문을 수정 로그에 보관 */
  function saveMainEdit(i, newVal) {
    var c = comments[i]; if (!c) return;
    var next = (newVal || '').trim();
    if (!next) { window.alert('코멘트 내용을 입력해 주세요.'); return; }
    if (next !== c.text) {
      var meta = parseMeta(c);
      meta.e.push({ x: c.text, at: today() });
      c.text = next;
      c.dev = metaStr(meta);
      persistRow(i, { text: c.text, dev: c.dev });
    }
    editingMain = -1;
    renderComments();
  }
  /* 답글 등록 — 개발사('d')/고객사('c') 스레드에 추가 */
  function addReply(i, role, val) {
    var c = comments[i]; if (!c) return;
    var text = (val || '').trim();
    if (!text) return;
    var meta = parseMeta(c);
    meta.t.push({ b: (role === 'c' ? 'c' : 'd'), x: text, at: today() });
    c.dev = metaStr(meta);
    persistRow(i, { dev: c.dev });
    renderComments();
  }

  /* ---------- 테스트케이스: 로드 / 저장(결과·코멘트) / 렌더 ---------- */
  function loadTestcases() {
    tcLoadError = false;
    if (!REMOTE) {
      try { tcRows = JSON.parse(localStorage.getItem(tcStoreKey)) || []; }
      catch (e) { tcRows = []; }
      return Promise.resolve();
    }
    return fetch(SB_TABLE + '?page_key=eq.' + encodeURIComponent(TC_SCOPE) + '&order=id.asc', { headers: sbHeaders() })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) { tcRows = rows; })
      .catch(function () { tcRows = []; tcLoadError = true; });
  }
  function tcSaveLocal() { try { localStorage.setItem(tcStoreKey, JSON.stringify(tcRows)); return true; } catch (e) { return false; } }
  function tcRowFor(id) { for (var i = 0; i < tcRows.length; i++) { if (tcRows[i].ref === id) return tcRows[i]; } return null; }
  function showTcError(msg) { var el = tcListEl && tcListEl.querySelector('#specTcListError'); if (el) { el.textContent = msg; el.style.display = 'block'; } }
  // 결과/코멘트 저장 — 저장 행이 없으면 생성, 있으면 갱신
  function tcPersist(id, patch, done) {
    var row = tcRowFor(id);
    if (row) {
      for (var k in patch) row[k] = patch[k];
      if (REMOTE && row.id != null) {
        sbPatch(row.id, patch).then(function () { done && done(); }).catch(function () { showTcError('저장에 실패했습니다. 네트워크를 확인해 주세요.'); });
      } else { tcSaveLocal(); done && done(); }
    } else {
      var base = { page_key: TC_SCOPE, ref: id, text: '', img_url: '', img_name: '', date: today(), status: '', dev: '' };
      for (var k2 in patch) base[k2] = patch[k2];
      if (REMOTE) {
        sbInsert(base).then(function (r) { tcRows.push(r || base); done && done(); }).catch(function () { showTcError('저장에 실패했습니다. 네트워크를 확인해 주세요.'); });
      } else { tcRows.push(base); tcSaveLocal(); done && done(); }
    }
  }
  function setTcResult(id, val) { tcPersist(id, { status: val }, renderTestcases); }
  function addTcReply(id, role, val) {
    var text = (val || '').trim(); if (!text) return;
    var meta = parseMeta(tcRowFor(id) || { dev: '' });
    meta.t.push({ b: (role === 'c' ? 'c' : 'd'), x: text, at: today() });
    tcPersist(id, { dev: metaStr(meta) }, renderTestcases);
  }
  function delTcReply(id, mi) {
    var row = tcRowFor(id); if (!row) return;
    var meta = parseMeta(row);
    meta.t.splice(mi, 1);
    tcPersist(id, { dev: metaStr(meta) }, renderTestcases);
  }
  function renderTestcases() {
    if (!tcListEl) return;
    var list = tcDefs();
    if (tcCountEl) tcCountEl.textContent = list.length + '건';
    var errBar = '<div id="specTcListError" class="spec-error" style="display:none; margin-bottom:10px;"></div>';
    if (!list.length) {
      tcListEl.innerHTML = errBar + '<div class="spec-empty">이 페이지의 테스트케이스는 준비 중입니다.</div>';
      return;
    }
    var pass = 0, fail = 0;
    list.forEach(function (tc) { var r = tcRowFor(tc.id); if (r && r.status === 'Pass') pass++; else if (r && r.status === 'Fail') fail++; });
    var summary = '<div class="tc-summary">전체 <b>' + list.length + '</b> · <span class="tc-sum-pass">Pass ' + pass + '</span> · <span class="tc-sum-fail">Fail ' + fail + '</span> · 미확인 ' + (list.length - pass - fail) + '</div>';
    if (tcLoadError) summary = '<div class="spec-error" style="margin-bottom:10px;">저장된 결과를 불러오지 못했습니다(정의된 항목만 표시). 네트워크·설정을 확인해 주세요.</div>' + summary;

    var html = errBar + summary + '<div class="tc-cards">';
    list.forEach(function (tc) {
      var row = tcRowFor(tc.id);
      var result = (row && row.status) ? row.status : '';
      var meta = parseMeta(row || { dev: '' });
      var opts = TC_STATUSES.map(function (s) {
        var v = (s === '미확인') ? '' : s;
        return '<option value="' + v + '"' + (result === v ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
      var threadHtml = meta.t.map(function (msg, mi) {
        var who = (msg.b === 'c') ? '고객사' : '개발사';
        return '<div class="cmt-msg ' + (msg.b === 'c' ? 'is-client' : 'is-dev') + '">' +
            '<div class="cmt-msg-hd"><span class="cmt-role">' + who + '</span>' +
              (msg.at ? '<span class="cmt-msg-date">' + esc(msg.at) + '</span>' : '') +
              '<button type="button" class="cmt-ic cmt-ic-del cmt-msg-del" data-act="tc-msg-del" data-id="' + escAttr(tc.id) + '" data-mi="' + mi + '" title="삭제"><i data-lucide="x"></i></button>' +
            '</div>' +
            '<div class="cmt-msg-text">' + esc(msg.x) + '</div>' +
          '</div>';
      }).join('');
      html +=
        '<div class="tc-card tc-' + (TC_CLASS[result] || 'none') + '">' +
          '<div class="tc-hd">' +
            '<span class="tc-id">' + esc(tc.id) + '</span>' +
            (tc.cat ? '<span class="tc-cat">' + esc(tc.cat) + '</span>' : '') +
            '<span class="tc-title">' + esc(tc.title) + '</span>' +
            '<select class="select tc-result" data-id="' + escAttr(tc.id) + '">' + opts + '</select>' +
          '</div>' +
          (tc.pre ? '<div class="tc-line"><b>사전조건</b> ' + esc(tc.pre) + '</div>' : '') +
          (tc.steps ? '<div class="tc-line"><b>절차</b> ' + esc(tc.steps) + '</div>' : '') +
          '<div class="tc-line"><b>기대결과</b> ' + esc(tc.expect) + '</div>' +
          (threadHtml ? '<div class="cmt-thread tc-thread">' + threadHtml + '</div>' : '') +
          '<div class="cmt-reply tc-reply">' +
            '<select class="select cmt-reply-role tc-reply-role" data-id="' + escAttr(tc.id) + '"><option value="d">개발사</option><option value="c">고객사</option></select>' +
            '<textarea class="textarea cmt-grow tc-reply-input" data-id="' + escAttr(tc.id) + '" rows="1" placeholder="이 항목에 대한 코멘트 (Ctrl+Enter 저장)"></textarea>' +
            '<button type="button" class="btn btn-primary btn-sm" data-act="tc-reply" data-id="' + escAttr(tc.id) + '">저장</button>' +
          '</div>' +
        '</div>';
    });
    tcListEl.innerHTML = html + '</div>';
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    tcListEl.querySelectorAll('.cmt-grow').forEach(autogrow);
  }

  /* ---------- 이미지 라이트박스 ---------- */
  function openImgModal(src, name) {
    if (!imgModal) {
      imgModal = document.createElement('div');
      imgModal.className = 'spec-img-modal';
      imgModal.innerHTML =
        '<button type="button" class="spec-img-close" aria-label="닫기">&#10005;</button>' +
        '<figure><img alt=""><figcaption></figcaption>' +
        '<a class="spec-img-dl" target="_blank" rel="noopener"><i data-lucide="download"></i>다운로드</a></figure>';
      document.body.appendChild(imgModal);
      imgModal.addEventListener('click', function (e) {
        if (e.target === imgModal || e.target.closest('.spec-img-close')) closeImgModal();
      });
    }
    imgModal.querySelector('img').src = src;
    imgModal.querySelector('figcaption').textContent = name || '';
    var dlLink = imgModal.querySelector('.spec-img-dl');
    if (dlLink) dlLink.href = downloadUrl(src, name);
    imgModal.classList.add('show');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }
  function closeImgModal() {
    if (imgModal) imgModal.classList.remove('show');
  }
  function imgModalOpen() {
    return imgModal && imgModal.classList.contains('show');
  }

  /* ---------- drawer ---------- */
  function build() {
    overlay = document.createElement('div');
    overlay.className = 'spec-overlay';
    overlay.innerHTML =
      '<div class="spec-panel" role="dialog" aria-modal="true" aria-label="페이지 기획서">' +
        '<div class="spec-resizer" title="드래그해서 너비 조절"></div>' +
        '<div class="spec-head">' +
          '<div class="spec-tabs">' +
            '<button type="button" class="spec-tab active" data-pane="guide">페이지 안내</button>' +
            '<button type="button" class="spec-tab" data-pane="comments">고객사 코멘트 <span class="spec-tab-count" id="specCmtCount">0건</span></button>' +
            '<button type="button" class="spec-tab" data-pane="tests">테스트케이스 <span class="spec-tab-count" id="specTcCount">0건</span></button>' +
          '</div>' +
          '<div class="spec-head-actions">' +
            '<button type="button" class="btn btn-outline btn-sm spec-guide-edit" id="specGuideEdit"><i data-lucide="pencil"></i>수정</button>' +
            '<span class="spec-kbd">Ctrl + /</span>' +
            '<button class="spec-close" type="button" aria-label="닫기">&#10005;</button>' +
          '</div>' +
        '</div>' +
        '<div class="spec-body">' +
          '<div class="spec-pane active" data-pane="guide">' +
            '<div class="spec-guide-body" id="specGuideBody"><p class="spec-loading">기획서를 불러오는 중&hellip;</p></div>' +
          '</div>' +
          '<div class="spec-pane" data-pane="comments">' +
            '<form class="spec-cmt-form">' +
              '<div class="spec-cmt-row">' +
                '<div class="field w-ref"><label class="label">기획서 No.</label><input class="input cmt-ref-fixed" id="specCmtRef" value="' + escAttr(CURRENT_LABEL) + '" readonly tabindex="-1" title="이 페이지의 기획서로 자동 지정됩니다."></div>' +
                '<div class="field w-file"><label class="label">파일 첨부</label>' +
                  '<div class="row" style="gap:8px;">' +
                    '<label class="spec-cmt-file-label" for="specCmtFile"><i data-lucide="paperclip"></i>파일 선택</label>' +
                    '<input type="file" id="specCmtFile" multiple style="display:none;">' +
                    '<span class="spec-cmt-file-name" id="specCmtFileName">여러 개 선택 가능</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div class="spec-cmt-files" id="specCmtFiles"></div>' +
              '<div class="field"><label class="label">코멘트</label><textarea class="textarea cmt-grow" id="specCmtText" placeholder="수정 요청, 문의 사항 등을 입력해 주세요." style="min-height:64px;"></textarea></div>' +
              '<div class="spread">' +
                '<span class="spec-cmt-error" id="specCmtError">코멘트 내용을 입력해 주세요.</span>' +
                '<button type="submit" class="btn btn-primary btn-sm" id="specCmtSubmit">코멘트 등록</button>' +
              '</div>' +
            '</form>' +
            '<div id="specCmtList"><div class="spec-empty">코멘트를 불러오는 중&hellip;</div></div>' +
          '</div>' +
          '<div class="spec-pane" data-pane="tests">' +
            '<div id="specTcList"><div class="spec-empty">테스트케이스를 불러오는 중&hellip;</div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    guideBody = overlay.querySelector('#specGuideBody');
    cmtListEl = overlay.querySelector('#specCmtList');
    cmtCountEl = overlay.querySelector('#specCmtCount');
    tcListEl = overlay.querySelector('#specTcList');
    tcCountEl = overlay.querySelector('#specTcCount');
    if (tcCountEl) tcCountEl.textContent = tcDefs().length + '건';

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.spec-close').addEventListener('click', close);
    overlay.querySelector('#specGuideEdit').addEventListener('click', enterSpecEdit);

    // 드래그 리사이즈 — 좌측 엣지를 끌어 너비 조절, 마지막 너비는 localStorage에 기억
    var panel = overlay.querySelector('.spec-panel');
    var savedW = 0;
    try { savedW = parseInt(localStorage.getItem('spec-drawer-width'), 10) || 0; } catch (e) { savedW = 0; }
    if (savedW >= 420) {
      panel.style.width = Math.min(savedW, Math.round(window.innerWidth * 0.96)) + 'px';
    }
    var resizer = overlay.querySelector('.spec-resizer');
    resizer.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      resizer.setPointerCapture(e.pointerId);
      overlay.classList.add('resizing');
      var onMove = function (ev) {
        var w = window.innerWidth - ev.clientX;
        w = Math.max(420, Math.min(w, Math.round(window.innerWidth * 0.96)));
        panel.style.width = w + 'px';
      };
      var onUp = function () {
        overlay.classList.remove('resizing');
        resizer.removeEventListener('pointermove', onMove);
        resizer.removeEventListener('pointerup', onUp);
        resizer.removeEventListener('pointercancel', onUp);
        try { localStorage.setItem('spec-drawer-width', parseInt(panel.style.width, 10) || ''); } catch (err) { /* 무시 */ }
      };
      resizer.addEventListener('pointermove', onMove);
      resizer.addEventListener('pointerup', onUp);
      resizer.addEventListener('pointercancel', onUp);
    });

    // 탭 전환
    overlay.querySelectorAll('.spec-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        overlay.querySelectorAll('.spec-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var key = tab.getAttribute('data-pane');
        overlay.querySelectorAll('.spec-pane').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-pane') === key);
        });
        // '수정' 버튼은 페이지 안내 탭에서만 노출(편집 중이면 숨김 유지)
        var editBtn = overlay.querySelector('#specGuideEdit');
        if (editBtn) editBtn.style.display = (key === 'guide' && !overlay.querySelector('#specGuideEditor')) ? '' : 'none';
        // 테스트케이스 탭 최초 진입 시 결과/코멘트 로드
        if (key === 'tests' && !tcLoaded) { tcLoaded = true; loadTestcases().then(renderTestcases); }
      });
    });

    // 테스트케이스 목록 — 결과(Pass/Fail) 변경 / 답글 등록·삭제 (위임)
    if (tcListEl) {
      tcListEl.addEventListener('change', function (e) {
        if (!e.target.classList.contains('tc-result')) return;
        setTcResult(e.target.getAttribute('data-id'), e.target.value);
      });
      tcListEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-act');
        if (act === 'tc-reply') {
          var ri = tcListEl.querySelector('.tc-reply-input[data-id="' + id + '"]');
          var rr = tcListEl.querySelector('.tc-reply-role[data-id="' + id + '"]');
          addTcReply(id, rr ? rr.value : 'd', ri ? ri.value : '');
        } else if (act === 'tc-msg-del') {
          var mi = parseInt(btn.getAttribute('data-mi'), 10);
          if (isNaN(mi)) return;
          if (!window.confirm('이 코멘트를 삭제할까요?')) return;
          delTcReply(id, mi);
        }
      });
      tcListEl.addEventListener('keydown', function (e) {
        if (!((e.ctrlKey || e.metaKey) && e.key === 'Enter')) return;
        if (!e.target.classList.contains('tc-reply-input')) return;
        e.preventDefault();
        var id = e.target.getAttribute('data-id');
        var rr = tcListEl.querySelector('.tc-reply-role[data-id="' + id + '"]');
        addTcReply(id, rr ? rr.value : 'd', e.target.value);
      });
      tcListEl.addEventListener('input', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('cmt-grow')) autogrow(e.target);
      });
    }

    // 코멘트 폼 — 파일 선택(여러 개, 여러 번에 나눠 추가 가능)
    var form = overlay.querySelector('.spec-cmt-form');
    var fileInput = overlay.querySelector('#specCmtFile');
    var fileName = overlay.querySelector('#specCmtFileName');
    var filesBox = overlay.querySelector('#specCmtFiles');

    var mainTextEl = overlay.querySelector('#specCmtText');
    if (mainTextEl) mainTextEl.addEventListener('input', function () { autogrow(mainTextEl); });

    // 선택된 파일 칩 렌더 (개별 제외 가능)
    function renderPendingFiles() {
      fileName.textContent = pendingFiles.length ? (pendingFiles.length + '개 선택됨') : '여러 개 선택 가능';
      if (!filesBox) return;
      filesBox.innerHTML = pendingFiles.map(function (pf, idx) {
        return '<span class="spec-cmt-file-chip">' +
          '<i data-lucide="' + (isImageName(pf.name) ? 'image' : 'file') + '"></i>' +
          '<span class="scfc-name">' + esc(pf.name) + '</span>' +
          '<button type="button" class="scfc-x" data-fi="' + idx + '" title="제외" aria-label="제외">&#10005;</button>' +
        '</span>';
      }).join('');
      filesBox.style.display = pendingFiles.length ? 'flex' : 'none';
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    fileInput.addEventListener('change', function () {
      clearFormError();
      var tooBig = [];
      Array.prototype.forEach.call(fileInput.files, function (f) {
        if (f.size > 20 * 1024 * 1024) { tooBig.push(f.name); return; }
        pendingFiles.push({ file: f, name: f.name });
      });
      fileInput.value = ''; // 같은 파일을 다시 고를 수 있도록 초기화
      if (tooBig.length) showFormError('20MB를 초과한 파일은 제외되었습니다: ' + tooBig.join(', '));
      renderPendingFiles();
    });

    if (filesBox) {
      filesBox.addEventListener('click', function (e) {
        var x = e.target.closest('.scfc-x');
        if (!x) return;
        pendingFiles.splice(parseInt(x.getAttribute('data-fi'), 10), 1);
        renderPendingFiles();
      });
    }

    // 코멘트 등록
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var textEl = overlay.querySelector('#specCmtText');
      var submitBtn = overlay.querySelector('#specCmtSubmit');
      var text = textEl.value.trim();
      if (!text) { showFormError('코멘트 내용을 입력해 주세요.'); textEl.focus(); return; }
      clearFormError();

      function resetForm() {
        textEl.value = '';
        autogrow(textEl);
        fileInput.value = ''; pendingFiles = []; renderPendingFiles();
        submitBtn.disabled = false; submitBtn.textContent = '코멘트 등록';
      }

      if (REMOTE) {
        submitBtn.disabled = true;
        submitBtn.textContent = pendingFiles.length ? ('업로드 중… (0/' + pendingFiles.length + ')') : '등록 중…';
        var total = pendingFiles.length, done = 0;
        var uploads = pendingFiles.map(function (pf) {
          return sbUploadFile(pf.file, pf.name).then(function (url) {
            done += 1; submitBtn.textContent = '업로드 중… (' + done + '/' + total + ')';
            return { u: url, n: pf.name };
          });
        });
        Promise.all(uploads).then(function (arr) {
          var imgUrl = arr.length ? JSON.stringify(arr) : null;
          var imgName = arr.length ? (arr[0].n + (arr.length > 1 ? ' 외 ' + (arr.length - 1) + '건' : '')) : null;
          return sbInsert({
            page_key: scopeKey,
            ref: CURRENT_LABEL,
            text: text,
            img_url: imgUrl,
            img_name: imgName,
            date: today(),
            status: '검토중',
            dev: ''
          });
        }).then(function (row) {
          comments.push(row);
          renderComments();
          resetForm();
        }).catch(function () {
          submitBtn.disabled = false; submitBtn.textContent = '코멘트 등록';
          showFormError('등록에 실패했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.');
        });
      } else {
        comments.push({
          ref: CURRENT_LABEL,
          text: text,
          img: pendingFiles.length ? pendingFiles.map(function (pf) { return pf.name; }) : null,
          date: today(),
          status: '검토중',
          dev: ''
        });
        if (!saveLocal()) {
          comments.pop();
          showFormError('저장 공간이 부족합니다. 첨부 파일 용량을 줄여 주세요.');
          return;
        }
        renderComments();
        resetForm();
      }
    });

    // 코멘트 목록 — 상태 변경 / 본문 편집 / 답글 / 썸네일 (위임)
    cmtListEl.addEventListener('change', function (e) {
      var i = parseInt(e.target.getAttribute('data-i'), 10);
      if (isNaN(i) || !comments[i]) return;
      if (e.target.classList.contains('cmt-status')) {
        comments[i].status = e.target.value;
        persistRow(i, { status: e.target.value });
        renderComments();   // 상태에 따라 카드 강조를 즉시 반영
      }
    });
    cmtListEl.addEventListener('click', function (e) {
      var thumb = e.target.closest('.cmt-thumb');
      if (thumb) {
        var tsrc = thumb.getAttribute('data-src');
        if (tsrc) openImgModal(tsrc, thumb.getAttribute('data-name') || '');
        return;
      }
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var i = parseInt(btn.getAttribute('data-i'), 10);
      if (isNaN(i) || !comments[i]) return;
      var act = btn.getAttribute('data-act');
      if (act === 'del') {
        if (!window.confirm('이 코멘트를 삭제할까요? 삭제하면 되돌릴 수 없습니다.')) return;
        var target = comments[i];
        if (REMOTE && target && target.id != null) {
          btn.disabled = true;
          sbDelete(target.id).then(function () {
            comments.splice(i, 1);
            if (editingMain === i) editingMain = -1;
            renderComments();
          }).catch(function () {
            btn.disabled = false;
            showListError('삭제에 실패했습니다. 네트워크 연결을 확인하고 다시 시도해 주세요.');
          });
        } else {
          comments.splice(i, 1);
          if (editingMain === i) editingMain = -1;
          saveLocal();
          renderComments();
        }
        return;
      }
      if (act === 'main-edit') {            // 고객사 코멘트 수정 시작
        editingMain = i;
        renderComments();
      } else if (act === 'main-cancel') {
        editingMain = -1;
        renderComments();
      } else if (act === 'main-save') {     // 수정 저장
        var ta = cmtListEl.querySelector('.cmt-main-input[data-i="' + i + '"]');
        saveMainEdit(i, ta ? ta.value : comments[i].text);
      } else if (act === 'elog') {          // 수정 로그 펼치기/접기
        var box = cmtListEl.querySelector('.cmt-elog[data-elog="' + i + '"]');
        if (box) {
          box.hidden = !box.hidden;
          btn.textContent = '수정 ' + box.children.length + '회 · 이전 내용 ' + (box.hidden ? '보기' : '숨기기');
        }
      } else if (act === 'reply') {         // 답글 등록
        var ri = cmtListEl.querySelector('.cmt-reply-input[data-i="' + i + '"]');
        var rr = cmtListEl.querySelector('.cmt-reply-role[data-i="' + i + '"]');
        addReply(i, rr ? rr.value : 'd', ri ? ri.value : '');
      } else if (act === 'msg-del') {       // 답글 삭제
        var mi = parseInt(btn.getAttribute('data-mi'), 10);
        if (isNaN(mi)) return;
        if (!window.confirm('이 답글을 삭제할까요?')) return;
        var meta = parseMeta(comments[i]);
        meta.t.splice(mi, 1);
        comments[i].dev = metaStr(meta);
        persistRow(i, { dev: comments[i].dev });
        renderComments();
      }
    });
    // Ctrl/⌘ + Enter = 저장/등록 (Enter 단독은 줄바꿈)
    cmtListEl.addEventListener('keydown', function (e) {
      if (!((e.ctrlKey || e.metaKey) && e.key === 'Enter')) return;
      var i = parseInt(e.target.getAttribute('data-i'), 10);
      if (isNaN(i) || !comments[i]) return;
      if (e.target.classList.contains('cmt-main-input')) {
        e.preventDefault(); saveMainEdit(i, e.target.value);
      } else if (e.target.classList.contains('cmt-reply-input')) {
        e.preventDefault();
        var rr = cmtListEl.querySelector('.cmt-reply-role[data-i="' + i + '"]');
        addReply(i, rr ? rr.value : 'd', e.target.value);
      }
    });
    cmtListEl.addEventListener('input', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('cmt-grow')) autogrow(e.target);
    });

    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  function renderGuide() {
    guideBody.innerHTML = renderMd(specMd);
  }
  function guideError() {
    guideBody.innerHTML =
      '<p class="spec-error">기획서를 불러오지 못했습니다.<br>' +
      '이 문서는 로컬 서버(VS Code Live Server 등) 또는 배포 주소에서 열었을 때 표시됩니다 — ' +
      '파일을 직접(file://) 연 경우 브라우저가 fetch를 차단합니다.<br>' +
      '기획서 파일: <code>' + specUrl + '</code></p>';
  }
  // 로드 우선순위: 드로어에서 수정·저장한 기획서(Supabase) → 없으면 원본 .md 파일
  function loadSpec() {
    mdLoaded = true;
    if (!REMOTE) { loadSpecFile(); return; }
    fetch(SB_TABLE + '?page_key=eq.' + encodeURIComponent(SPEC_KEY) + '&select=id,text&order=id.desc&limit=1', { headers: sbHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (rows && rows[0] && rows[0].text != null) {
          specRowId = rows[0].id; specMd = rows[0].text; renderGuide();
        } else {
          return loadSpecFile();
        }
      })
      .catch(function () { return loadSpecFile(); });
  }
  function loadSpecFile() {
    return fetch(specUrl)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (md) { specMd = md; renderGuide(); })
      .catch(guideError);
  }

  /* ---------- 기획서 브라우저 편집 (Supabase 저장 — 배포본에도 반영) ---------- */
  function enterSpecEdit() {
    var editBtn = overlay.querySelector('#specGuideEdit');
    if (editBtn) editBtn.style.display = 'none';
    guideBody.innerHTML =
      '<textarea class="spec-guide-editor" id="specGuideEditor" spellcheck="false"></textarea>' +
      '<div class="spec-guide-actions">' +
        '<span class="spec-guide-msg" id="specGuideMsg"></span>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="specGuideCancel">취소</button>' +
        '<button type="button" class="btn btn-primary btn-sm" id="specGuideSave"><i data-lucide="save"></i>저장</button>' +
      '</div>';
    var ta = guideBody.querySelector('#specGuideEditor');
    ta.value = specMd;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    ta.focus();
    guideBody.querySelector('#specGuideCancel').addEventListener('click', exitSpecEdit);
    guideBody.querySelector('#specGuideSave').addEventListener('click', saveSpec);
  }
  function exitSpecEdit() {
    var editBtn = overlay.querySelector('#specGuideEdit');
    if (editBtn) editBtn.style.display = '';
    renderGuide();
  }
  function saveSpec() {
    var ta = guideBody.querySelector('#specGuideEditor');
    var msg = guideBody.querySelector('#specGuideMsg');
    var saveBtn = guideBody.querySelector('#specGuideSave');
    var text = ta.value;
    if (!REMOTE) {
      specMd = text;
      exitSpecEdit();
      return;
    }
    saveBtn.disabled = true; saveBtn.textContent = '저장 중…';
    var step = (specRowId != null)
      ? sbPatch(specRowId, { text: text })
      : sbInsert({ page_key: SPEC_KEY, ref: 'spec', text: text, img_url: '', img_name: '', date: today(), status: '완료', dev: '' })
          .then(function (row) { if (row) specRowId = row.id; });
    step.then(function () {
      specMd = text;
      exitSpecEdit();
    }).catch(function () {
      saveBtn.disabled = false; saveBtn.textContent = '저장';
      if (msg) { msg.textContent = '저장에 실패했습니다. 네트워크를 확인해 주세요.'; msg.classList.add('err'); }
    });
  }
  function open() {
    if (!overlay) {
      build();
      loadComments().then(renderComments);
    }
    // 표시 후 다음 프레임에 show → 슬라이드 트랜지션 재생
    overlay.getBoundingClientRect();
    overlay.classList.add('show');
    document.body.classList.add('spec-lock');
    if (!mdLoaded) loadSpec();
  }
  function close() {
    if (!overlay) return;
    closeImgModal();
    overlay.classList.remove('show');
    document.body.classList.remove('spec-lock');
  }
  function toggle() {
    (overlay && overlay.classList.contains('show')) ? close() : open();
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey &&
        (e.key === '/' || e.code === 'Slash')) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape') {
      if (imgModalOpen()) { closeImgModal(); return; } // 라이트박스 먼저 닫기
      close();
    }
  });

  /* ---------- 플로팅 버튼 (기획서 / 시안 허브) ---------- */
  function mountFab() {
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'spec-fab';
    fab.innerHTML = '<i data-lucide="file-text"></i>기획서 <span class="spec-kbd">Ctrl + /</span>';
    fab.addEventListener('click', toggle);
    document.body.appendChild(fab);

    // 화면 시안 허브로 바로 가기 — 전 페이지 좌하단(허브 자신엔 미노출)
    var hub = document.createElement('a');
    hub.className = 'hub-fab';
    hub.href = '../index.html';
    hub.title = '화면 시안 허브로 가기';
    hub.innerHTML = '<i data-lucide="layout-grid"></i><span class="hub-fab-label">시안 허브</span>';
    document.body.appendChild(hub);

    makeDraggable(fab, 'spec');
    makeDraggable(hub, 'hub');

    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  /* ---------- 플로팅 버튼 드래그 이동 ----------
     - 5px 이상 끌면 드래그로 판정하고, 놓을 때의 클릭(허브 이동·기획서 열기)은 막는다
     - 위치는 버튼별로 localStorage에 저장 → 다른 화면에서도 같은 자리
     - 창 크기가 바뀌어도 화면 밖으로 나가지 않게 보정 */
  function makeDraggable(el, key) {
    var STORE = 'sv-fab-pos:' + key;
    var MARGIN = 8, THRESHOLD = 5;
    var start = null, moved = false, suppressClick = false;

    function clamp(x, y) {
      var w = el.offsetWidth, h = el.offsetHeight;
      var maxX = Math.max(MARGIN, window.innerWidth - w - MARGIN);
      var maxY = Math.max(MARGIN, window.innerHeight - h - MARGIN);
      return { x: Math.min(Math.max(MARGIN, x), maxX), y: Math.min(Math.max(MARGIN, y), maxY) };
    }
    function place(x, y) {
      var p = clamp(x, y);
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      return p;
    }
    function restore() {
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) {}
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') place(saved.x, saved.y);
    }

    el.classList.add('sv-draggable');
    el.setAttribute('draggable', 'false'); // 링크(a)의 네이티브 드래그 방지
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });

    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var r = el.getBoundingClientRect();
      start = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, id: e.pointerId };
      moved = false;
    });
    window.addEventListener('pointermove', function (e) {
      if (!start || e.pointerId !== start.id) return;
      var dx = e.clientX - start.px, dy = e.clientY - start.py;
      if (!moved && Math.abs(dx) + Math.abs(dy) < THRESHOLD) return;
      if (!moved) {
        moved = true;
        el.classList.add('is-dragging');
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      }
      place(start.x + dx, start.y + dy);
      e.preventDefault();
    });
    function end(e) {
      if (!start || (e && e.pointerId !== start.id)) return;
      if (moved) {
        var r = el.getBoundingClientRect();
        try { localStorage.setItem(STORE, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch (err) {}
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 0);
      }
      el.classList.remove('is-dragging');
      start = null;
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    // 드래그 직후의 클릭은 캡처 단계에서 차단 (기존 click 핸들러·링크 이동보다 먼저)
    el.addEventListener('click', function (e) {
      if (suppressClick || moved) {
        e.preventDefault();
        e.stopImmediatePropagation();
        moved = false;
      }
    }, true);

    restore();
    window.addEventListener('resize', function () {
      if (!el.style.left) return; // 기본 위치(CSS)면 보정 불필요
      place(parseFloat(el.style.left), parseFloat(el.style.top));
    });
  }
  function init() {
    mountFab();
    if (location.hash === '#spec') open(); // 딥링크: xxx.html#spec 으로 열면 기획서 자동 표시
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
