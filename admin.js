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
      { k: 'stats', label: '숫자 요약 (프로필 아래 타일)', type: 'array', fields: [{ k: 'value', label: '숫자' }, { k: 'label', label: '설명' }] },
      { k: 'bullets', label: '성과 요약', type: 'lines', hint: '한 줄에 하나. **굵게** 표기 가능 — 맨 앞에 "**규모** — " 처럼 쓰면 스캔하기 좋습니다' },
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
      { k: 'grouped', label: '묶음 카드 (여러 건을 하나로)', type: 'bool' },
      { k: 'tags', label: '태그', type: 'chips', hint: '카드 접힌 상태에서 보입니다 · 클릭하면 한 칸 앞으로 이동' },
      { k: 'problem', label: '문제점', type: 'textarea' }, { k: 'solution', label: '해결', type: 'textarea' },
      { k: 'results', label: '성과', type: 'lines', hint: '한 줄에 하나 — 숫자를 넣을 것. 첫 줄이 접힌 카드의 요약으로 표시됩니다' },
      { k: 'url', label: '관련 링크' },
      { k: 'images', label: '이미지', type: 'images', hint: '화면 캡처·산출물 이미지. 여러 장 선택 가능, 최대 3열로 표시' },
    ] },
    { key: 'portfolio', label: '포트폴리오', kind: 'object', fields: [
      { k: 'files', label: '파일', type: 'array', fields: [{ k: 'name', label: '표시 이름' }, { k: 'url', label: '파일', type: 'file' }] },
      { k: 'links', label: '링크', type: 'array', fields: [{ k: 'name', label: '표시 이름' }, { k: 'url', label: 'URL' }] },
    ] },
    { key: 'specialty', label: '전문 분야', kind: 'object', fields: [
      { k: 'major', label: '주요 스킬 — 포트폴리오에 강조 표시', type: 'major', hint: '아래 전체 스킬에서 클릭하면 여기로 올라옵니다 · 마우스를 올리면 나타나는 × 로 내리기 · 클릭하면 한 칸 앞으로' },
      { k: 'general', label: '일반 스킬 (전체)', type: 'chips', pool: true, majorPath: 'specialty.major', hint: '클릭하면 주요 스킬로 올라갑니다 · 이름 수정·추가·삭제는 [수정]' },
      { k: 'domain', label: '도메인 (전체)', type: 'chips', pool: true, majorPath: 'specialty.major', hint: '클릭하면 주요 스킬로 올라갑니다 · 이름 수정·추가·삭제는 [수정]' },
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
      case 'major':
        // 선택된 주요 스킬 — 파란 칩, hover 시 × 로 내리기, 클릭으로 한 칸 앞으로
        var mItems = val || [];
        var mChips = mItems.length ? mItems.map(function (t, i) {
          return '<span class="chip major-chip' + (i === 0 ? ' first' : '') + '" data-chip-up="' + path + '|' + i + '" title="' + (i === 0 ? '맨 앞 항목입니다' : '클릭하면 한 칸 앞으로') + '">' +
            '<span class="mtxt">' + esc(t) + '</span>' +
            '<button type="button" class="chip-demote" data-chip-demote="' + path + '|' + i + '" title="주요 스킬에서 내리기" aria-label="내리기">×</button></span>';
        }).join('') : '<span class="chips-empty">아래 전체 스킬에서 클릭하면 여기로 올라옵니다</span>';
        return '<div class="field wide chip-field">' +
          '<div class="chip-head"><label>' + esc(f.label || f.k) + '</label><small>' + esc(f.hint || '') + '</small></div>' +
          '<div class="chips primary major-box" data-chips="' + path + '">' + mChips + '</div></div>';
      case 'chips':
        var editing = !!chipMode[path], items = val || [];
        var majorArr = f.pool ? (getPath(state, f.majorPath) || []) : null;
        var chips = items.map(function (t, i) {
          if (editing) {
            return '<span class="chip" draggable="true" data-chip="' + path + '|' + i + '" title="클릭하여 이름 수정 · 드래그하여 이동">' +
              '<span class="chip-txt">' + esc(t) + '</span>' +
              '<button type="button" class="chip-del" data-chip-del="' + path + '|' + i + '" aria-label="삭제">×</button></span>';
          }
          if (f.pool) {
            var sel = majorArr.indexOf(t) >= 0;
            return '<button type="button" class="chip pool' + (sel ? ' selected' : '') + '" data-chip-toggle="' + path + '|' + i + '" data-major="' + f.majorPath + '" title="' + (sel ? '주요 스킬에 올라가 있습니다 — 클릭하면 내립니다' : '클릭하면 주요 스킬로 올라갑니다') + '">' + esc(t) + (sel ? '<i class="chk">✓</i>' : '') + '</button>';
          }
          return '<button type="button" class="chip' + (i === 0 ? ' first' : '') + '" data-chip-up="' + path + '|' + i + '"' +
            (i === 0 ? ' title="맨 앞 항목입니다"' : ' title="클릭하면 한 칸 앞으로 이동"') + '>' + esc(t) + '</button>';
        }).join('');
        var addBox = editing ? '<span class="chip-add"><input data-chip-add="' + path + '" placeholder="스킬 입력 후 Enter"><button type="button" class="btn sm" data-chip-add-btn="' + path + '">+ 추가</button></span>' : '';
        var hint = editing ? '이름 수정 · 삭제 · 추가 · 드래그 이동이 가능합니다' : (f.hint || '칩을 클릭하면 순서가 한 칸 앞으로 이동합니다');
        return '<div class="field wide chip-field">' +
          '<div class="chip-head"><label>' + esc(f.label || f.k) + '</label><small>' + esc(hint) + '</small>' +
          '<button type="button" class="btn sm ' + (editing ? '' : 'ghost') + '" data-chip-mode="' + path + '">' + (editing ? '완료' : '수정') + '</button></div>' +
          '<div class="chips' + (f.primary ? ' primary' : '') + (editing ? ' editing' : '') + (f.pool ? ' pool-box' : '') + '" data-chips="' + path + '"' + (f.pool ? ' data-major="' + f.majorPath + '"' : '') + '>' + chips + addBox + '</div></div>';
      case 'bool':
        return '<div class="field check"><label><input type="checkbox" id="' + id + '" data-path="' + path + '" data-type="bool"' + (val ? ' checked' : '') + '> ' + esc(f.label) + '</label></div>';
      case 'select':
        return '<div class="field">' + label + '<select id="' + id + '" data-path="' + path + '">' + f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
      case 'image':
        return '<div class="field wide">' + label + '<div class="upload">' +
          '<div class="thumb' + (val ? '' : ' empty') + '">' + (val ? '<img src="' + esc(val) + '" alt="">' : '없음') + '</div>' +
          '<div class="ctl"><input type="file" accept="image/*" data-upload="image" data-path="' + path + '"> ' +
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
  // ── 칩(스킬): 평소엔 클릭으로 순서 올리기, [수정] 모드에서만 이름 변경·삭제·추가 ──
  var chipMode = {};
  function chipArr(path) { var a = getPath(state, path); if (!Array.isArray(a)) { a = []; setPath(state, path, a); } return a; }
  function chipAdd(path, input) {
    var v = (input.value || '').trim(); if (!v) return;
    v.split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (s) { chipArr(path).push(s); });
    markDirty(); renderSection(active);
    var again = document.querySelector('[data-chip-add="' + path + '"]'); if (again) again.focus();
  }
  function chipEdit(chipEl) {
    if (chipEl.classList.contains('editing')) return;
    var ref = chipEl.dataset.chip.split('|'), path = ref[0], i = +ref[1];
    var txt = chipEl.querySelector('.chip-txt'), old = txt.textContent;
    chipEl.classList.add('editing'); chipEl.draggable = false;
    var inp = document.createElement('input'); inp.className = 'chip-edit'; inp.value = old; inp.style.width = Math.max(60, old.length * 13) + 'px';
    txt.replaceWith(inp); inp.focus(); inp.select();
    var done = false;
    function commit(save) {
      if (done) return; done = true;
      var v = inp.value.trim();
      var box = chipEl.closest('.chips'), mj = (box && box.dataset.major) ? chipArr(box.dataset.major) : null;
      if (save && v && v !== old) { chipArr(path)[i] = v; if (mj && mj.indexOf(old) >= 0) mj[mj.indexOf(old)] = v; markDirty(); }
      else if (save && !v) { chipArr(path).splice(i, 1); if (mj && mj.indexOf(old) >= 0) mj.splice(mj.indexOf(old), 1); markDirty(); }
      renderSection(active);
    }
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); commit(true); } if (ev.key === 'Escape') commit(false); });
    inp.addEventListener('blur', function () { commit(true); });
  }
  $('#form').addEventListener('keydown', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.chipAdd && e.key === 'Enter') { e.preventDefault(); chipAdd(el.dataset.chipAdd, el); }
  });
  var dragSrc = null;
  $('#form').addEventListener('dragstart', function (e) { var c = e.target.closest && e.target.closest('.chip[data-chip]'); if (!c) return; dragSrc = c.dataset.chip; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  $('#form').addEventListener('dragend', function (e) { var c = e.target.closest && e.target.closest('.chip'); if (c) c.classList.remove('dragging'); document.querySelectorAll('.chip.over').forEach(function (x) { x.classList.remove('over'); }); });
  $('#form').addEventListener('dragover', function (e) { var c = e.target.closest && e.target.closest('.chip[data-chip]'); if (!c || !dragSrc || c.dataset.chip.split('|')[0] !== dragSrc.split('|')[0]) return; e.preventDefault(); c.classList.add('over'); });
  $('#form').addEventListener('dragleave', function (e) { var c = e.target.closest && e.target.closest('.chip'); if (c) c.classList.remove('over'); });
  $('#form').addEventListener('drop', function (e) {
    var c = e.target.closest && e.target.closest('.chip[data-chip]'); if (!c || !dragSrc) return;
    e.preventDefault();
    var s = dragSrc.split('|'), t = c.dataset.chip.split('|'); if (s[0] !== t[0] || s[1] === t[1]) return;
    var a = chipArr(s[0]), item = a.splice(+s[1], 1)[0]; a.splice(+t[1], 0, item);
    dragSrc = null; markDirty(); renderSection(active);
  });

  $('#form').addEventListener('click', function (e) {
    var modeBtn = e.target.closest('[data-chip-mode]');
    if (modeBtn) { var mp = modeBtn.dataset.chipMode; chipMode[mp] = !chipMode[mp]; renderSection(active); return; }
    // 전체 풀 → 주요 스킬로 올리기 / 다시 내리기 (토글)
    var tog = e.target.closest('[data-chip-toggle]');
    if (tog) {
      var tp = tog.dataset.chipToggle.split('|'), name = chipArr(tp[0])[+tp[1]], major = chipArr(tog.dataset.major), at = major.indexOf(name);
      if (at >= 0) major.splice(at, 1); else major.push(name);
      markDirty(); renderSection(active); return;
    }
    // 주요 스킬에서 내리기 — 풀에 없던 항목이면 일반 스킬로 돌려보내 잃어버리지 않게
    var dem = e.target.closest('[data-chip-demote]');
    if (dem) {
      var dp = dem.dataset.chipDemote.split('|'), mArr = chipArr(dp[0]), nm = mArr[+dp[1]];
      mArr.splice(+dp[1], 1);
      var gen = chipArr('specialty.general'), dom = chipArr('specialty.domain');
      if (gen.indexOf(nm) < 0 && dom.indexOf(nm) < 0) gen.push(nm);
      markDirty(); renderSection(active); return;
    }
    var up = e.target.closest('[data-chip-up]');
    if (up) {
      var u = up.dataset.chipUp.split('|'), arr = chipArr(u[0]), i = +u[1];
      if (i > 0) { var t = arr[i - 1]; arr[i - 1] = arr[i]; arr[i] = t; markDirty(); renderSection(active); }
      return;
    }
    var chipDel = e.target.closest('[data-chip-del]');
    if (chipDel) {
      var r = chipDel.dataset.chipDel.split('|'), delName = chipArr(r[0])[+r[1]]; chipArr(r[0]).splice(+r[1], 1);
      var dbox = chipDel.closest('.chips'); if (dbox && dbox.dataset.major) { var mm = chipArr(dbox.dataset.major); if (mm.indexOf(delName) >= 0) mm.splice(mm.indexOf(delName), 1); }
      markDirty(); renderSection(active); return;
    }
    var addBtn = e.target.closest('[data-chip-add-btn]');
    if (addBtn) { chipAdd(addBtn.dataset.chipAddBtn, document.querySelector('[data-chip-add="' + addBtn.dataset.chipAddBtn + '"]')); return; }
    var chipTxt = e.target.closest('.chip-txt');
    if (chipTxt) { chipEdit(chipTxt.closest('.chip')); return; }
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

  // 배포된 최신 기본 내용을 편집기로 — 이름·사진·연락처와 업로드한 이미지는 유지
  $('#btn-load-default').addEventListener('click', function () {
    var def = window.PORTFOLIO_DEFAULT;
    if (!def) { setStatus('기본 내용을 찾을 수 없습니다', 'err'); return; }
    if (!confirm('배포된 최신 내용(소개 · 경력 · 프로젝트 · 전문 분야 등)을 불러옵니다.\n이름 · 사진 · 연락처와 업로드한 프로젝트 이미지는 그대로 유지됩니다.\n\n계속할까요?')) return;
    var next = JSON.parse(JSON.stringify(def));
    next.basic = state.basic || next.basic;                       // 내 정보 유지
    var imgs = {}; (state.project || []).forEach(function (p) { if (p.images && p.images.length) imgs[p.name] = p.images; });
    (next.project || []).forEach(function (p) { if (imgs[p.name]) p.images = imgs[p.name]; });
    var files = (state.portfolio && state.portfolio.files || []).filter(function (f) { return f && f.url; });
    var links = (state.portfolio && state.portfolio.links || []).filter(function (f) { return f && f.url; });
    if (files.length) next.portfolio.files = files;
    if (links.length) next.portfolio.links = links;
    // 전문 분야: 내가 고른 주요 스킬은 유지, 전체 풀은 최신 목록 + 내가 추가한 항목의 합집합
    if (state.specialty) {
      // 예전 기본값(사내 용어)은 버리고, 사용자가 직접 추가한 항목만 합친다
      var LEGACY = ['화면설계서 · IA', '와이어프레임 · 스토리보드', '정책 설계', '기능 명세서 · PRD', '우선순위 · 백로그 관리', '로드맵 관리', '데이터 분석', 'QA · 테스트 케이스', 'UX/UI 이해', '릴리즈 · 앱 스토어 심사', '결제 · PG 연동 기획', 'API 연동 기획', '데이터 마이그레이션', 'LLM API (OpenAI · Anthropic · Gemini)', 'ChatGPT · Claude 활용', 'Jira', 'Confluence', 'Slack', 'Microsoft Teams', 'Excel', 'PowerPoint', 'Google Analytics', 'SQL', '요구사항 분석 · 정의(주요)', '의료미용', '헬스케어 · 의료기기', '유통', '이커머스', '콘텐츠', '엔터테인먼트', 'IT 서비스', '기능 정의서', '페이지 맵 · 화면 설계', '화면 기획 · 디자인 시안', '화면 기획 · 스토리보드', '테스트케이스 · QA', 'AI 서비스 기획(챗봇 · STT/TTS · 아바타)', 'AI 서비스 기획(챗봇 · STT/TTS · 아바타 · 실시간 음성)', 'OpenAI · Anthropic · Gemini API 이해', 'Supabase · PostgreSQL', 'Claude Code', '검수 확인서 · 변경 동의서', '앱 심사 · 인앱 결제 · PG 심사', '요구사항 정의서', '사용자 시나리오 · 테스트 시나리오', 'API 명세 검토', '프로젝트 관리', 'WBS · 일정 관리', '이해관계자 관리', '우선순위 · 리스크 관리', '이슈 트래킹 · 회의록', '견적 · 계약 변경 관리', '커뮤니케이션', 'SQL 기초', '고객 요구사항 정의·협의', '다중 프로젝트 일정·범위 관리', '개발팀·타부서·다자 조율', '고객 요구사항 정의·협의', '다중 프로젝트 일정 관리', '개발팀·타부서 조율'];
      var isLegacy = function (x) { return LEGACY.indexOf(x) >= 0; };
      var union = function (base, extra) { var out = (base || []).slice(); (extra || []).forEach(function (x) { if (out.indexOf(x) < 0 && !isLegacy(x)) out.push(x); }); return out; };
      var keptMajor = (state.specialty.major || []).filter(function (x) { return !isLegacy(x); });
      if (keptMajor.length) next.specialty.major = keptMajor;
      next.specialty.general = union(next.specialty.general, state.specialty.general);
      next.specialty.domain = union(next.specialty.domain, state.specialty.domain);
    }
    ['education', 'activity', 'certificate', 'language'].forEach(function (k) {   // 직접 채운 항목은 보존
      var cur = (state[k] || []).filter(function (o) { return JSON.stringify(o).indexOf('[') < 0; });
      if (cur.length) next[k] = cur;
    });
    state = next; markDirty(); renderSection(active);
    setStatus('최신 내용을 불러왔습니다 — 저장을 눌러야 반영됩니다', 'warn');
  });

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
