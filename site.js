// 공개 페이지 렌더러 — data.default.js 를 먼저 그리고, Supabase 에 저장된 내용이 있으면 덮어 그린다.
(function () {
  var cfg = window.PORTFOLIO_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // 인라인 서식: **굵게**, [자리표시자], 줄바꿈
  function fmt(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]/g, '<span class="todo">[$1]</span>')
      .replace(/\n/g, '<br>');
  }
  function has(v) { return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()); }
  function list(arr) { return (arr || []).filter(has); }
  function dateRange(o) {
    var s = fmt(o.start || '');
    var e = o.current ? '<em class="current">' + (o.currentLabel || '재직 중') + '</em>' : fmt(o.end || '');
    return s + (s || e ? ' ~ ' : '') + e;
  }
  function safeUrl(u) { u = String(u || '').trim(); return /^(https?:|mailto:|tel:|#|\/|\.)/i.test(u) ? u : '#'; }

  var ICON_FILE = '<svg class="ico" viewBox="0 0 16 16"><path d="M4 1h5l4 4v10H4V1zm5 1v3h3L9 2zM5 7h6v1H5V7zm0 2h6v1H5V9zm0 2h6v1H5v-1z"/></svg>';
  var ICON_LINK = '<svg class="ico" viewBox="0 0 16 16"><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1 1 1 1-1a1.6 1.6 0 0 1 2.2 2.2l-2 2a1.6 1.6 0 0 1-2.2 0l-1 1zm3-3a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1-1-1-1 1a1.6 1.6 0 0 1-2.2-2.2l2-2a1.6 1.6 0 0 1 2.2 0l1-1z"/></svg>';

  function bullets(arr, cls) {
    arr = list(arr); if (!arr.length) return '';
    return '<ul' + (cls ? ' class="' + cls + '"' : '') + '>' + arr.map(function (b) { return '<li>' + fmt(b) + '</li>'; }).join('') + '</ul>';
  }

  // 연락처 아이콘 — currentColor 상속
  var SVG = function (d) { return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var ICON = {
    mail: SVG('<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 7l9 6 9-6"/>'),
    phone: SVG('<path d="M7.5 3.5h-3A1.5 1.5 0 0 0 3 5.2c.3 3.6 1.9 7 4.4 9.5s5.9 4.1 9.5 4.4A1.5 1.5 0 0 0 18.5 17.6v-3a1.5 1.5 0 0 0-1.2-1.5l-2.4-.5a1.5 1.5 0 0 0-1.5.6l-.8 1a12 12 0 0 1-4.6-4.6l1-.8a1.5 1.5 0 0 0 .6-1.5l-.5-2.4A1.5 1.5 0 0 0 7.5 3.5z"/>'),
    link: SVG('<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.8 6.5"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>')
  };

  // ── 지원서별 디자인 토큰 ──
  var BG = { white: "#ffffff", warm: "#fbfaf8", cool: "#f7f8fa" };
  var WIDTH = { narrow: 960, normal: 1100, wide: 1240 };
  var RADIUS = { square: "2px", soft: "9px", round: "16px" };
  var DENSITY = {
    tight:  { item: "24px", top: "30px", bottom: "44px" },
    normal: { item: "32px", top: "40px", bottom: "60px" },
    airy:   { item: "40px", top: "52px", bottom: "76px" }
  };
  function applyTheme(t) {
    t = t || {};
    var r = document.documentElement.style;
    if (/^#[0-9a-fA-F]{3,8}$/.test(t.point || "")) r.setProperty("--point", t.point);
    if (BG[t.bg]) r.setProperty("--bg", BG[t.bg]);
    if (WIDTH[t.width]) r.setProperty("--content-max", WIDTH[t.width] + "px");
    if (RADIUS[t.radius]) r.setProperty("--radius", RADIUS[t.radius]);
    var d = DENSITY[t.density];
    if (d) {
      r.setProperty("--padding-item", d.item);
      r.setProperty("--padding-section-top", d.top);
      r.setProperty("--padding-section-bottom", d.bottom);
    }
  }
  function renderBasic(b) {
    b = b || {};
    var tags = list(b.tags).map(function (t) { return '<em class="tag">' + fmt(t) + '</em>'; }).join('');
    var contact = [];
    if (has(b.email)) contact.push('<span>' + ICON.mail + '<a href="mailto:' + esc(b.email) + '">' + fmt(b.email) + '</a></span>');
    if (has(b.phone)) contact.push('<span>' + ICON.phone + '<a href="tel:' + esc(String(b.phone).replace(/[^0-9+]/g, '')) + '">' + fmt(b.phone) + '</a></span>');
    (b.links || []).forEach(function (l) { if (l && has(l.url)) contact.push('<span>' + ICON.link + '<a href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' + fmt(l.label || l.url) + '</a></span>'); });
    var i = (window.__introData) || {};
    var headline = has(i.brief) ? '<p class="headline">' + fmt(i.brief) + '</p>' : '';
    var pts = list(i.bullets);
    var points = pts.length ? '<ul class="head-points">' + pts.map(function (t) {
      return '<li>' + hl(fmt(String(t).replace(/^(\*\*[^*]+\*\*)\s*[—–-]\s*/, '$1 '))) + '</li>';
    }).join('') + '</ul>' : '';
    $('#basic').innerHTML =
      '<div class="photo">' + (has(b.photoUrl) ? '<img src="' + esc(b.photoUrl) + '" alt="">' : '<span class="todo">[사진]</span>') + '</div>' +
      '<div class="name"><span>' + fmt(b.name) + '</span>' + tags + '</div>' +
      '<div class="job-title">' + fmt(b.jobTitle) + '</div>' +
      '<div class="contact">' + contact.join('') + '</div>' +
      headline + points;
    $('#side-name').innerHTML = fmt(b.name);
    $('#side-job').textContent = b.jobTitle || '';
    document.title = (b.name || '') + ' | ' + (b.jobTitle || '');
  }

  function renderIntro(i) {
    i = i || {};
    var html = '';
    if (has(i.brief)) html += '<p class="brief">' + fmt(i.brief) + '</p>';
    var bs = list(i.bullets);
    if (bs.length) html += '<div class="text">' + bs.map(function (b) { return '<p>' + (/^\*\*/.test(b) ? '' : '- ') + fmt(b) + '</p>'; }).join('') + '</div>';
    return html;
  }

  function renderExperience(arr) {
    arr = (arr || []).filter(function (e) { return e && has(e.org); });
    if (!arr.length) return '';
    return '<ul class="item-text">' + arr.map(function (e) {
      var sub = [e.dept, e.position].filter(has).map(function (s) { return '<span>' + fmt(s) + '</span>'; }).join('');
      var date = '<span>' + dateRange(e) + '</span>' + (has(e.period) ? '<span>' + fmt(e.period) + '</span>' : '');
      var text = (has(e.summary) ? '<p><b>' + fmt(e.summary) + '</b></p>' : '') + bullets(e.bullets);
      return '<li><div class="title">' + fmt(e.org) + '</div><div class="subtitle">' + sub + '</div><div class="date">' + date + '</div>' +
        (text ? '<div class="text">' + text + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  // 성과 문장의 수치를 포인트 컬러로 강조 (연도·버전 표기는 제외)
  function hl(html) {
    return html.replace(/(\d[\d,]*(?:\.\d+)?)\s*(개사|개월|건|개|명|종|곳|회|차례|차|%|억|만|천|주|일|년|배|위|시간|분)(?![가-힣])/g,
      function (m) { return '<b class="num">' + m + '</b>'; });
  }

  // 티어별 그룹 렌더 — 대표(main) / 그 외(sub · 묶음)
  function renderProject(arr) {
    arr = (arr || []).filter(function (p) { return p && has(p.name); });
    if (!arr.length) return '';
    var main = [], self = [], sub = [];
    arr.forEach(function (p, i) {
      var bucket = p.tier === 'self' ? self : (p.tier === 'sub' || p.grouped ? sub : main);
      bucket.push({ p: p, i: i });
    });
    // 티어를 아무것도 지정하지 않았으면 예전처럼 한 덩어리로
    if (!self.length && (!main.length || !sub.length)) {
      return '<ul class="item-text pcards">' + arr.map(function (p, i) { return projectCard(p, i); }).join('') + '</ul>';
    }
    function group(label, note, items, cls) {
      if (!items.length) return '';
      return '<div class="pgroup ' + cls + '">' +
          '<div class="pgroup-head"><span class="pg-label">' + esc(label) + '</span>' +
          '<span class="pg-count">' + items.length + '건</span>' +
          (note ? '<span class="pg-note">' + esc(note) + '</span>' : '') +
        '</div>' +
        '<ul class="item-text pcards">' + items.map(function (x) { return projectCard(x.p, x.i); }).join('') + '</ul>' +
      '</div>';
    }
    return group('고객사 프로젝트 — 대표', '문제 · 해결 · 성과를 자세히 적었습니다', main, 'tier-main') +
      group('직접 만든 업무 자동화', '고객사 발주가 아니라, 반복 업무를 줄이려고 직접 기획하고 만들었습니다', self, 'tier-self') +
      group('고객사 프로젝트 — 그 외', '요약과 묶음으로 정리했습니다', sub, 'tier-sub');
  }

  function projectCard(p, idx) {
    {
      var sub = [p.org, p.role].filter(has).map(function (s) { return '<span>' + fmt(s) + '</span>'; }).join('');
      var res = list(p.results);
      var body = '';
      if (has(p.problem)) body += '<p><b>문제점</b><br>' + fmt(p.problem) + '</p>';
      if (has(p.solution)) body += '<p><b>해결</b><br>' + fmt(p.solution) + '</p>';
      if (res.length) body += '<p><b>성과</b></p><ul>' + res.map(function (b) { return '<li>' + hl(fmt(b)) + '</li>'; }).join('') + '</ul>';
      var imgs = (p.images || []).filter(function (im) { return im && has(im.url); });
      if (imgs.length) {
        body += '<div class="img-grid col-' + Math.min(imgs.length, 3) + '">' + imgs.map(function (im) {
          return '<figure><a href="' + esc(im.url) + '" class="lightbox" data-caption="' + esc(im.caption || '') + '"><img src="' + esc(im.url) + '" alt="' + esc(im.caption || '') + '" loading="lazy"></a>' +
            (has(im.caption) ? '<figcaption>' + fmt(im.caption) + '</figcaption>' : '') + '</figure>';
        }).join('') + '</div>';
      }
      if (has(p.url)) body += '<a class="link" href="' + esc(safeUrl(p.url)) + '" target="_blank" rel="noopener">' + ICON_LINK + '<span>' + esc(p.url) + '</span></a>';

      var badge = p.current ? '<em class="badge live">진행 중</em>' : (has(p.end) ? '<em class="badge done">완료</em>' : '');
      var tagsHtml = list(p.tags).length ? '<ul class="item-tag tags">' + list(p.tags).map(function (t) { return '<li>' + fmt(t) + '</li>'; }).join('') + '</ul>' : '';
      var lead = res.length ? '<div class="lead">' + hl(fmt(res[0])) + '</div>' : '';
      var scale = has(p.scale) ? '<ul class="scale">' + String(p.scale).split('·').map(function (t) { return t.trim(); }).filter(Boolean)
        .map(function (t) { return '<li>' + hl(fmt(t)) + '</li>'; }).join('') + '</ul>' : '';
      var id = 'pc' + idx;
      return '<li class="pcard' + (p.grouped ? ' grouped' : '') + (p.tier === 'sub' ? ' sub' : '') + '">' +
        '<div class="pcard-head" role="button" tabindex="0" aria-expanded="false" aria-controls="' + id + '">' +
          '<div class="pcard-main">' +
            '<div class="title">' + fmt(p.name) + badge + '</div>' +
            '<div class="subtitle">' + sub + '</div>' + scale + lead + tagsHtml +
          '</div>' +
          '<div class="date"><span>' + dateRange({ start: p.start, end: p.end, current: p.current, currentLabel: '진행 중' }) + '</span></div>' +
          '<span class="chev" aria-hidden="true"></span>' +
        '</div>' +
        (body ? '<div class="pcard-body text" id="' + id + '" hidden>' + body + '</div>' : '') +
      '</li>';
    }
  }

  function renderStats(arr) {
    arr = (arr || []).filter(function (s) { return s && (has(s.value) || has(s.label)); });
    var el = $('#stats');
    el.innerHTML = arr.map(function (s) {
      return '<div class="stat"><b>' + fmt(s.value) + '</b><span>' + fmt(s.label) + '</span></div>';
    }).join('');
    el.hidden = !arr.length;
  }

  function renderPortfolio(pf) {
    pf = pf || {};
    var files = (pf.files || []).filter(function (f) { return f && (has(f.name) || has(f.url)); });
    var links = (pf.links || []).filter(function (f) { return f && (has(f.name) || has(f.url)); });
    var html = '';
    if (files.length) html += '<div class="section-sub"><h3 class="section-subtitle">파일</h3><ul class="item-link">' + files.map(function (f) {
      return '<li><a href="' + esc(safeUrl(f.url)) + '" target="_blank" rel="noopener">' + ICON_FILE + '<span>' + fmt(f.name || f.url) + '</span></a></li>';
    }).join('') + '</ul></div>';
    if (links.length) html += '<div class="section-sub"><h3 class="section-subtitle">링크</h3><ul class="item-link">' + links.map(function (f) {
      return '<li><a href="' + esc(safeUrl(f.url)) + '" target="_blank" rel="noopener">' + ICON_LINK + '<span>' + fmt(f.name || f.url) + '</span></a></li>';
    }).join('') + '</ul></div>';
    return html;
  }

  function renderSpecialty(sp) {
    sp = sp || {};
    // 주요 스킬로 올라간 항목은 전체 목록(일반·도메인)에서 중복 표시하지 않는다
    var major = list(sp.major);
    var notMajor = function (t) { return major.indexOf(t) < 0; };
    var general = list(sp.general).filter(notMajor), domain = list(sp.domain).filter(notMajor);
    var html = '';
    if (major.length || general.length) {
      html += '<div class="section-sub"><h3 class="section-subtitle">스킬</h3>';
      if (major.length) html += '<ul class="item-tag tag-primary">' + major.map(function (t) { return '<li>' + fmt(t) + '</li>'; }).join('') + '</ul>';
      if (general.length) html += '<ul class="item-tag">' + general.map(function (t) { return '<li>' + fmt(t) + '</li>'; }).join('') + '</ul>';
      html += '</div>';
    }
    if (domain.length) html += '<div class="section-sub"><h3 class="section-subtitle">도메인</h3><ul class="item-tag">' + domain.map(function (t) { return '<li>' + fmt(t) + '</li>'; }).join('') + '</ul></div>';
    return html;
  }

  function simpleList(arr, titleKey, subKeys, dateFn, descKey) {
    arr = (arr || []).filter(function (o) { return o && has(o[titleKey]); });
    if (!arr.length) return '';
    return '<ul class="item-text">' + arr.map(function (o) {
      var sub = subKeys.map(function (k) { return o[k]; }).filter(has).map(function (s) { return '<span>' + fmt(s) + '</span>'; }).join('');
      var d = dateFn ? dateFn(o) : '';
      return '<li><div class="title">' + fmt(o[titleKey]) + '</div>' + (sub ? '<div class="subtitle">' + sub + '</div>' : '') +
        (d ? '<div class="date"><span>' + d + '</span></div>' : '') +
        (descKey && has(o[descKey]) ? '<div class="text"><p>' + fmt(o[descKey]) + '</p></div>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  var TYPE_LABEL = { AWARD: '수상', ACTIVITY: '활동', EDUCATION: '교육' };

  function setSection(id, html) {
    var sec = document.getElementById(id);
    var nav = document.querySelector('.side nav a[href="#' + id + '"]');
    sec.querySelector('.section-content').innerHTML = html;
    sec.hidden = !html; if (nav) nav.hidden = !html;
  }

  function render(d) {
    // 소개(한 줄 소개 · 요약)는 프로필 헤더 영역에 표시한다
    window.__introData = d.intro || {};
    applyTheme(d.theme);
    renderBasic(d.basic);
    renderStats((d.intro && d.intro.stats) || d.stats);
    setSection('intro', '');
    setSection('experience', renderExperience(d.experience));
    setSection('project', renderProject(d.project));
    setSection('portfolio', renderPortfolio(d.portfolio));
    setSection('specialty', renderSpecialty(d.specialty));
    setSection('education', simpleList(d.education, 'school', ['dept'], function (o) { return dateRange(o); }, 'desc'));
    setSection('activity', simpleList(d.activity, 'name', ['org'], function (o) { return (TYPE_LABEL[o.type] ? '<span>' + TYPE_LABEL[o.type] + '</span>' : '') + fmt(o.date || ''); }, 'desc'));
    setSection('certificate', simpleList(d.certificate, 'name', ['org'], function (o) { return fmt(o.date || ''); }));
    setSection('language', simpleList(d.language, 'name', ['level']));
    $('#updated').innerHTML = has(d.updatedAt) ? '최종 수정&nbsp;' + esc(String(d.updatedAt).slice(0, 10).replace(/-/g, '.')) : '';
    var anyTodo = !!document.querySelector('main .todo');
    $('.draft-note').hidden = !anyTodo;
    initNav();
  }

  // 사이드 내비 활성 상태
  var io, lockUntil = 0, navBound = false;
  function initNav() {
    var links = [].slice.call(document.querySelectorAll('.side nav a')), map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    function set(id) { links.forEach(function (a) { a.classList.remove('on'); }); if (map[id]) map[id].classList.add('on'); }
    set('intro');
    if (!navBound) {
      navBound = true;
      document.querySelector('.side nav').addEventListener('click', function (e) {
        var a = e.target.closest('a'); if (!a) return;
        var id = a.getAttribute('href').slice(1), sec = document.getElementById(id); if (!sec) return;
        e.preventDefault();
        set(id); lockUntil = Date.now() + 900;
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + id);
      });
    }
    if (!('IntersectionObserver' in window)) return;
    if (io) io.disconnect();
    io = new IntersectionObserver(function (es) { if (Date.now() < lockUntil) return; es.forEach(function (e) { if (e.isIntersecting) set(e.target.id); }); }, { rootMargin: '-15% 0px -70% 0px' });
    document.querySelectorAll('main section[id]:not([hidden])').forEach(function (s) { io.observe(s); });
  }

  // 프로젝트 카드 펼치기 / 접기
  function togglePcard(head) {
    var li = head.parentNode, body = li.querySelector('.pcard-body');
    if (!body) return;
    var open = li.classList.toggle('open');
    body.hidden = !open;
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var head = e.target.closest && e.target.closest('.pcard-head');
    if (head) togglePcard(head);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var head = e.target.closest && e.target.closest('.pcard-head');
    if (head) { e.preventDefault(); togglePcard(head); }
  });
  // 인쇄 시에는 전부 펼침
  window.addEventListener('beforeprint', function () {
    document.querySelectorAll('.pcard-body').forEach(function (b) { b.hidden = false; });
  });
  window.addEventListener('afterprint', function () {
    document.querySelectorAll('.pcard:not(.open) .pcard-body').forEach(function (b) { b.hidden = true; });
  });

  // 라이트박스
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.lightbox');
    if (!a) return;
    e.preventDefault();
    var box = document.createElement('div'); box.className = 'lb';
    box.innerHTML = '<img src="' + esc(a.getAttribute('href')) + '" alt="">' + (a.dataset.caption ? '<p>' + esc(a.dataset.caption) + '</p>' : '');
    box.addEventListener('click', function () { box.remove(); });
    document.body.appendChild(box);
  });

  // 초기 렌더 + Supabase 동기화
  render(window.PORTFOLIO_DEFAULT || {});
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
    var client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    // 버전 슬러그: 폴더 페이지가 심어 준 값 > ?v= 파라미터 > 기본값
    var slug = window.PORTFOLIO_VARIANT ||
      (new URLSearchParams(location.search).get('v') || '').trim() || cfg.ROW_ID || 'main';
    // get_portfolio: 기본 문서에 해당 버전이 덮어쓴 항목만 적용해 1건만 반환 (목록 열거 불가)
    client.rpc('get_portfolio', { slug: slug }).then(function (r) {
      if (!r.error && r.data) { render(r.data); return; }
      // 아직 함수가 없는 환경(초기 설정 전)에서는 기존 방식으로 조회
      client.from('portfolio').select('data,updated_at').eq('id', slug).maybeSingle().then(function (q) {
        if (q.error || !q.data || !q.data.data) return;
        var d = q.data.data; d.updatedAt = d.updatedAt || q.data.updated_at || "";
        render(d);
      });
    });
  }
})();
