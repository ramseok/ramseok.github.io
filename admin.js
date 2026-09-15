// 관리자 페이지 — Supabase Auth 로그인 후 portfolio 테이블의 JSON 을 폼으로 편집·저장한다.
(function () {
  var cfg = window.PORTFOLIO_CONFIG || {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var client = null, state = null, dirty = false, active = 'basic';

  // ── 편집 스키마: 공개 페이지(site.js)가 읽는 데이터 구조와 1:1 ──
  var SCHEMA = [
    { key: 'basic', label: '기본 정보', kind: 'object', fields: [
      { k: 'name', label: '이름' },
      { k: 'jobTitle', label: '직함', hint: '예: SI Project Manager' },
      { k: 'tags', label: '칩', type: 'list', hint: '쉼표로 구분 — 예: 기획, PM' },
      { k: 'photoUrl', label: '프로필 사진', type: 'image' },
      { k: 'email', label: '이메일' },
      { k: 'phone', label: '전화번호' },
      { k: 'links', label: '링크', type: 'array', fields: [{ k: 'label', label: '표시 이름' }, { k: 'url', label: 'URL' }] },
    ] },
    { key: 'intro', label: '소개', kind: 'object', fields: [
      { k: 'brief', label: '한 줄 소개', type: 'textarea', hint: '큰 글씨로 표시됩니다. 줄바꿈 가능' },
      { k: 'bullets', label: '성과 요약', type: 'lines', hint: '한 줄에 하나. **굵게** 표기 가능' },
    ] },
    { key: 'experience', label: '경력', kind: 'array', itemLabel: function (o) { return o.org; }, fields: [
      { k: 'org', label: '회사' }, { k: 'dept', label: '부서' }, { k: 'position', label: '직책' },
      { k: 'start', label: '시작', hint: 'YYYY.MM' }, { k: 'end', label: '종료', hint: 'YYYY.MM' }, { k: 'current', label: '재직 중', type: 'bool' },
      { k: 'period', label: '기간 표기', hint: '예: 2년 2개월' },
      { k: 'summary', label: '요약 (굵게 표시)' }, { k: 'bullets', label: '담당 업무', type: 'lines', hint: '한 줄에 하나' },
    ] },
    { key: 'project', label: '프로젝트', kind: 'array', itemLabel: function (o) { return o.name; }, fields: [
      { k: 'name', label: '프로젝트명' }, { k: 'org', label: '조직 / 고객사' }, { k: 'role', label: '역할' },
      { k: 'start', label: '시작', hint: 'YYYY.MM' }, { k: 'end', label: '종료', hint: 'YYYY.MM' }, { k: 'current', label: '진행 중', type: 'bool' },
      { k: 'problem', label: '문제점', type: 'textarea' }, { k: 'solution', label: '해결', type: 'textarea' },
      { k: 'results', label: '성과', type: 'lines', hint: '한 줄에 하나 — 숫자를 넣을 것' },
      { k: 'url', label: '관련 링크' },
      { k: 'images', label: '이미지', type: 'images', hint: '화면 캡처·산출물 이미지. 여러 장 선택 가능, 최대 3열로 표시' },
    ] },
    { key: 'portfolio', label: '포트폴리오', kind: 'object', fields: [
      { k: 'files', label: '파일', type: 'array', fields: [{ k: 'name', label: '표시 이름' }, { k: 'url', label: '파일', type: 'file' }] },
      { k: 'links', label: '링크', type: 'array', fields: [{ k: 'name', label: '표시 이름' }, { k: 'url', label: 'URL' }] },
    ] },
    { key: 'specialty', label: '전문 분야', kind: 'object', fields: [
      { k: 'major', label: '주요 스킬 (파란 태그)', type: 'list', hint: '쉼표로 구분, 3개 권장' },
      { k: 'general', label: '일반 스킬', type: 'list', hint: '쉼표로 구분' },
      { k: 'domain', label: '도메인', type: 'list', hint: '쉼표로 구분' },
    ] },
    { key: 'education', label: '학력', kind: 'array', itemLabel: function (o) { return o.school; }, fields: [
      { k: 'school', label: '학교' }, { k: 'dept', label: '학과 / 학위' }, { k: 'start', label: '입학', hint: 'YYYY.MM' }, { k: 'end', label: '졸업', hint: 'YYYY.MM' }, { k: 'current', label: '재학 중', type: 'bool' }, { k: 'desc', label: '설명', type: 'textarea' },
    ] },
    { key: 'activity', label: '활동', kind: 'array', itemLabel: function (o) { return o.name; }, fields: [
      { k: 'type', label: '구분', type: 'select', options: [['AWARD', '수상'], ['ACTIVITY', '활동'], ['EDUCATION', '교육']] },
      { k: 'name', label: '활동명' }, { k: 'org', label: '기관' }, { k: 'date', label: '시기' }, { k: 'desc', label: '설명', type: 'textarea' },
    ] },
    { key: 'certificate', label: '자격증', kind: 'array', itemLabel: function (o) { return o.name; }, fields: [
      { k: 'name', label: '자격증명' }, { k: 'org', label: '발급 기관' }, { k: 'date', label: '취득 시기' },
    ] },
    { key: 'language', label: '언어', kind: 'array', itemLabel: function (o) { return o.name; }, fields: [
      { k: 'name', label: '언어' }, { k: 'level', label: '수준', hint: '일상 회화 / 비즈니스 회화 / 원어민 수준' },
    ] },
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function getPath(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function setPath(obj, path, v) {
    var ks = path.split('.'), o = obj;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }
  function emptyItem(fields) { var o = {}; fields.forEach(function (f) { o[f.k] = f.type === 'bool' ? false : (f.type === 'lines' || f.type === 'list' || f.type === 'array' || f.type === 'images') ? [] : ''; }); return o; }
  function setStatus(msg, kind) { var el = $('#status'); el.textContent = msg || ''; el.className = 'status ' + (kind || ''); }
  function markDirty() { dirty = true; $('#btn-save').disabled = false; setStatus('저장되지 않은 변경 사항이 있습니다', 'warn'); }

  // ── 폼 생성 ──
  function fieldHtml(f, path, val) {
    var id = 'f_' + path.replace(/\./g, '_');
    var label = '<label for="' + id + '">' + esc(f.label || f.k) + '</label>' + (f.hint ? '<small>' + esc(f.hint) + '</small>' : '');
    switch (f.type) {
      case 'textarea':
        return '<div class="field wide">' + label + '<textarea id="' + id + '" data-path="' + path + '" rows="4">' + esc(val) + '</textarea></div>';
      case 'lines':
        return '<div class="field wide">' + label + '<textarea id="' + id + '" data-path="' + path + '" data-type="lines" rows="5">' + esc((val || []).join('\n')) + '</textarea></div>';
      case 'list':
        return '<div class="field wide">' + label + '<input id="' + id + '" data-path="' + path + '" data-type="list" value="' + esc((val || []).join(', ')) + '"></div>';
      case 'bool':
        return '<div class="field check"><label><input type="checkbox" id="' + id + '" data-path="' + path + '" data-type="bool"' + (val ? ' checked' : '') + '> ' + esc(f.label) + '</label></div>';
      case 'select':
        return '<div class="field">' + label + '<select id="' + id + '" data-path="' + path + '">' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
      case 'image':
        return '<div class="field wide">' + label + '<div class="upload">' +
          (val ? '<img class="thumb" src="' + esc(val) + '" alt="">' : '<div class="thumb empty">없음</div>') +
          '<div><input type="file" accept="image/*" data-upload="image" data-path="' + path + '"> ' +
          (val ? '<button type="button" class="btn sm ghost" data-clear="' + path + '">제거</button>' : '') +
          '<input class="url" data-path="' + path + '" placeholder="또는 이미지 URL 직접 입력" value="' + esc(val) + '"></div></div></div>';
      case 'file':
        return '<div class="field">' + label + '<div class="upload row"><input type="file" data-upload="file" data-path="' + path + '">' +
          '<input class="url" data-path="' + path + '" placeholder="업로드 또는 URL 입력" value="' + esc(val) + '"></div></div>';
      case 'images':
        var imgs = val || [];
        return '<div class="field wide">' + label + '<div class="img-list">' + imgs.map(function (im, i) {
          var p = path + '.' + i;
          return '<div class="img-item"><img src="' + esc(im.url) + '" alt="">' +
            '<input data-path="' + p + '.caption" placeholder="캡션 (선택)" value="' + esc(im.caption || '') + '">' +
            '<div class="row-btns"><button type="button" class="btn sm ghost" data-move="' + path + '|' + i + '|-1">◀</button><button type="button" class="btn sm ghost" data-move="' + path + '|' + i + '|1">▶</button><button type="button" class="btn sm danger" data-remove="' + path + '|' + i + '">삭제</button></div></div>';
        }).join('') + '</div><input type="file" accept="image/*" multiple data-upload="images" data-path="' + path + '"></div>';
      case 'array':
        return '<div class="field wide"><div class="sub-head">' + label + '<button type="button" class="btn sm" data-add="' + path + '">+ 추가</button></div>' +
          '<div class="sub-items">' + (val || []).map(function (item, i) { return itemHtml(f.fields, path + '.' + i, item, i, (val || []).length, path, null, true); }).join('') + '</div></div>';
      default:
        return '<div class="field">' + label + '<input id="' + id + '" data-path="' + path + '" value="' + esc(val) + '"></div>';
    }
  }

  function itemHtml(fields, path, item, i, n, arrPath, labelFn, compact) {
    var title = (labelFn && labelFn(item)) || '';
    return '<div class="item' + (compact ? ' compact' : '') + '"><div class="item-head"><span class="idx">' + (i + 1) + '</span><span class="item-title">' + esc(title) + '</span>' +
      '<span class="row-btns"><button type="button" class="btn sm ghost" data-move="' + arrPath + '|' + i + '|-1"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
      '<button type="button" class="btn sm ghost" data-move="' + arrPath + '|' + i + '|1"' + (i === n - 1 ? ' disabled' : '') + '>▼</button>' +
      '<button type="button" class="btn sm danger" data-remove="' + arrPath + '|' + i + '">삭제</button></span></div>' +
      '<div class="grid">' + fields.map(function (f) { return fieldHtml(f, path + '.' + f.k, item[f.k]); }).join('') + '</div></div>';
  }

  function renderSection(key) {
    active = key;
    var sec = SCHEMA.filter(function (s) { return s.key === key; })[0];
    document.querySelectorAll('#sec-nav a').forEach(function (a) { a.classList.toggle('on', a.dataset.key === key); });
    var html = '<h2>' + esc(sec.label) + '</h2>';
    if (sec.kind === 'object') {
      if (!state[key]) state[key] = {};
      html += '<div class="grid">' + sec.fields.map(function (f) { return fieldHtml(f, key + '.' + f.k, state[key][f.k]); }).join('') + '</div>';
    } else {
      if (!Array.isArray(state[key])) state[key] = [];
      var arr = state[key];
      html += '<div class="items">' + arr.map(function (item, i) { return itemHtml(sec.fields, key + '.' + i, item, i, arr.length, key, sec.itemLabel); }).join('') + '</div>' +
        '<button type="button" class="btn" data-add="' + key + '">+ ' + esc(sec.label) + ' 추가</button>';
    }
    $('#form').innerHTML = html;
  }

  function fieldsAt(path) {
    // path 의 배열이 어느 스키마 fields 를 쓰는지 찾는다 (최상위 배열 또는 object 안의 array 필드)
    var ks = path.split('.'); var sec = SCHEMA.filter(function (s) { return s.key === ks[0]; })[0];
    if (ks.length === 1) return sec.fields;
    var f = sec.fields.filter(function (x) { return x.k === ks[1]; })[0];
    return f && f.fields ? f.fields : [];
  }

  // ── 이벤트: 입력 바인딩 ──
  $('#form').addEventListener('input', function (e) {
    var el = e.target, path = el.dataset.path; if (!path) return;
    var v;
    if (el.dataset.type === 'lines') v = el.value.split('\n');
    else if (el.dataset.type === 'list') v = el.value.split(',').map(function (s) { return s.trim(); });
    else if (el.dataset.type === 'bool') v = el.checked;
    else v = el.value;
    setPath(state, path, v); markDirty();
  });
  $('#form').addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset.type === 'bool' && el.dataset.path) { setPath(state, el.dataset.path, el.checked); markDirty(); }
    if (el.tagName === 'SELECT' && el.dataset.path) { setPath(state, el.dataset.path, el.value); markDirty(); }
    if (el.dataset.upload) handleUpload(el);
  });
  $('#form').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var p;
    if (b.dataset.add) { p = b.dataset.add; var arr = getPath(state, p) || []; arr.push(emptyItem(fieldsAt(p))); setPath(state, p, arr); markDirty(); renderSection(active); }
    if (b.dataset.remove) { p = b.dataset.remove.split('|'); if (!confirm('이 항목을 삭제할까요?')) return; getPath(state, p[0]).splice(+p[1], 1); markDirty(); renderSection(active); }
    if (b.dataset.move) { p = b.dataset.move.split('|'); var a = getPath(state, p[0]), i = +p[1], j = i + (+p[2]); if (j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; markDirty(); renderSection(active); }
    if (b.dataset.clear) { setPath(state, b.dataset.clear, ''); markDirty(); renderSection(active); }
  });

  // ── 업로드 ──
  function slug(name) { return name.replace(/[^\w.\-가-힣]+/g, '_').slice(-80); }
  function upload(file, folder) {
    var path = folder + '/' + Date.now() + '-' + slug(file.name);
    return client.storage.from(cfg.BUCKET || 'portfolio').upload(path, file, { upsert: true, contentType: file.type || undefined }).then(function (r) {
      if (r.error) throw r.error;
      return client.storage.from(cfg.BUCKET || 'portfolio').getPublicUrl(path).data.publicUrl;
    });
  }
  function handleUpload(el) {
    var files = [].slice.call(el.files || []); if (!files.length) return;
    var kind = el.dataset.upload, path = el.dataset.path;
    setStatus('업로드 중… (' + files.length + '개)', '');
    var folder = kind === 'file' ? 'files' : (path.indexOf('basic.') === 0 ? 'profile' : 'projects');
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () { return upload(f, folder); }).then(function (url) {
        if (kind === 'images') { var arr = getPath(state, path) || []; arr.push({ url: url, caption: '' }); setPath(state, path, arr); }
        else setPath(state, path, url);
      });
    });
    chain.then(function () { markDirty(); renderSection(active); setStatus('업로드 완료 — 저장 버튼을 눌러 반영하세요', 'warn'); })
      .catch(function (err) { setStatus('업로드 실패: ' + (err.message || err), 'err'); });
  }

  // ── 저장 / 불러오기 ──
  function clean(d) {
    // 빈 줄·빈 항목 제거
    d = JSON.parse(JSON.stringify(d));
    (function walk(o) {
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (Array.isArray(v)) {
          o[k] = v.filter(function (x) { return typeof x === 'string' ? x.trim() : x != null; }).map(function (x) { return typeof x === 'string' ? x.trim() : x; });
          o[k].forEach(function (x) { if (x && typeof x === 'object') walk(x); });
        } else if (v && typeof v === 'object') walk(v);
      });
    })(d);
    return d;
  }
  function save() {
    var data = clean(state); data.updatedAt = new Date().toISOString();
    $('#btn-save').disabled = true; setStatus('저장 중…', '');
    client.from('portfolio').upsert({ id: cfg.ROW_ID || 'main', data: data, updated_at: data.updatedAt }).then(function (r) {
      if (r.error) { $('#btn-save').disabled = false; setStatus('저장 실패: ' + r.error.message, 'err'); return; }
      state = data; dirty = false; setStatus('저장됨 ' + data.updatedAt.slice(11, 16), 'ok');
    });
  }
  function load() {
    setStatus('불러오는 중…', '');
    return client.from('portfolio').select('data').eq('id', cfg.ROW_ID || 'main').maybeSingle().then(function (r) {
      if (r.error) { setStatus('불러오기 실패: ' + r.error.message, 'err'); }
      state = (r.data && r.data.data) ? r.data.data : JSON.parse(JSON.stringify(window.PORTFOLIO_DEFAULT || {}));
      if (!r.data) setStatus('저장된 내용이 없어 기본 내용을 불러왔습니다. 수정 후 저장하세요', 'warn'); else setStatus('', '');
      renderSection(active);
    });
  }

  $('#btn-save').addEventListener('click', save);
  $('#btn-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(clean(state), null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'portfolio-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
  });
  $('#import-file').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader(); rd.onload = function () { try { state = JSON.parse(rd.result); markDirty(); renderSection(active); } catch (err) { setStatus('JSON 파싱 실패', 'err'); } }; rd.readAsText(f);
  });
  $('#btn-logout').addEventListener('click', function () { client.auth.signOut().then(function () { location.reload(); }); });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // 섹션 내비
  $('#sec-nav').innerHTML = SCHEMA.map(function (s) { return '<a href="#" data-key="' + s.key + '">' + esc(s.label) + '</a>'; }).join('');
  $('#sec-nav').addEventListener('click', function (e) { var a = e.target.closest('a'); if (!a) return; e.preventDefault(); renderSection(a.dataset.key); });

  // ── 인증 ──
  function show(id) { ['setup', 'login', 'editor'].forEach(function (k) { $('#' + k).hidden = k !== id; }); }
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase) { show('setup'); return; }
  client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#login-form button'); btn.disabled = true; $('#login-err').textContent = '';
    client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value }).then(function (r) {
      btn.disabled = false;
      if (r.error) { $('#login-err').textContent = '로그인 실패: ' + r.error.message; return; }
      enter(r.data.session);
    });
  });
  function enter(session) {
    show('editor'); $('#who').textContent = session.user.email;
    load();
  }
  client.auth.getSession().then(function (r) { if (r.data.session) enter(r.data.session); else show('login'); });
})();
