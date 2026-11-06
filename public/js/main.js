(() => {
  const API = '/api';
  const state = {
    settings: null,
    categories: [],
    projects: [],
    activeCategory: 'all',
  };

  // ---------- Visitor identity (for the reaction system) ----------
  function getVisitorId() {
    let id = localStorage.getItem('dp_visitor_id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `v_${Date.now()}_${Math.random().toString(16).slice(2)}`);
      localStorage.setItem('dp_visitor_id', id);
    }
    return id;
  }
  const visitorId = getVisitorId();

  function getLocalReaction(projectId) {
    try {
      const map = JSON.parse(localStorage.getItem('dp_reactions') || '{}');
      return map[projectId] || null;
    } catch { return null; }
  }
  function setLocalReaction(projectId, reaction) {
    try {
      const map = JSON.parse(localStorage.getItem('dp_reactions') || '{}');
      if (reaction) map[projectId] = reaction; else delete map[projectId];
      localStorage.setItem('dp_reactions', JSON.stringify(map));
    } catch { /* ignore storage errors */ }
  }

  // ---------- Toast ----------
  let toastTimer;
  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  // ---------- Fetch helpers ----------
  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
    return res.json();
  }
  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
    return res.json();
  }

  // ---------- Render: settings-driven content ----------
  function renderSettings(settings, categories) {
    document.documentElement.style.setProperty('--accent', settings.accentColor || '#ff5c39');
    document.title = `${settings.name} — ${settings.tagline}`;

    document.getElementById('brandName').textContent = settings.name;
    document.getElementById('heroName').textContent = settings.name;
    document.getElementById('heroRole').textContent = settings.tagline;
    document.getElementById('heroIntro').textContent = settings.intro;
    document.getElementById('heroYears').textContent = settings.yearsExperience;
    document.getElementById('heroPhoto').src = settings.profilePhoto;
    document.getElementById('heroPhoto').alt = settings.name;
    document.getElementById('aboutText').innerHTML = `<p>${escapeHtml(settings.aboutText).replace(/\n\n/g, '</p><p>')}</p>`;
    document.getElementById('footerText').textContent = `© ${new Date().getFullYear()} ${settings.name}. All rights reserved.`;
    document.getElementById('heroCategoryCount').textContent = categories.length;

    const chipsWrap = document.getElementById('skillChips');
    chipsWrap.innerHTML = (settings.skills || []).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join('');

    // Contact links
    const gmail = document.getElementById('contactGmail');
    gmail.href = `mailto:${settings.gmail}`;
    gmail.removeAttribute('target');
    document.getElementById('contactGmailValue').textContent = settings.gmail;

    document.getElementById('contactInstagram').href = settings.instagram;
    document.getElementById('contactDiscord').href = settings.discord;
  }

  function escapeHtml(str = '') {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Render: filter tabs ----------
  function renderTabs(categories) {
    const wrap = document.getElementById('filterTabs');
    const tabsHtml = categories
      .map((c) => `<button class="filter-tab" data-category="${c.slug}">${escapeHtml(c.name)}</button>`)
      .join('');
    wrap.innerHTML = `<button class="filter-tab active" data-category="all">All</button>${tabsHtml}`;

    wrap.querySelectorAll('.filter-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.filter-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeCategory = btn.dataset.category;
        renderGrid();
      });
    });
  }

  // ---------- Reactions UI ----------
  const REACTION_META = {
    fire: { emoji: '🔥', label: 'Best' },
    good: { emoji: '👍', label: 'Good' },
    bad: { emoji: '👎', label: 'Bad' },
  };

  function reactionsMarkup(project) {
    const localReaction = getLocalReaction(project.id);
    return Object.keys(REACTION_META)
      .map((key) => {
        const meta = REACTION_META[key];
        const active = localReaction === key ? 'active' : '';
        return `<button class="reaction-btn ${active}" data-reaction="${key}" data-project="${project.id}" aria-label="React ${meta.label}">
          <span>${meta.emoji}</span><span class="count">${project.reactions[key]}</span>
        </button>`;
      })
      .join('');
  }

  async function handleReactionClick(btn) {
    const projectId = btn.dataset.project;
    const reaction = btn.dataset.reaction;
    try {
      const result = await postJSON(`${API}/projects/${projectId}/react`, { reaction, visitorId });
      const project = state.projects.find((p) => p.id === projectId);
      if (project) project.reactions = result.reactions;
      setLocalReaction(projectId, result.yourReaction);

      document.querySelectorAll(`[data-project="${projectId}"]`).forEach((el) => {
        const key = el.dataset.reaction;
        el.querySelector('.count').textContent = result.reactions[key];
        el.classList.toggle('active', result.yourReaction === key);
      });
    } catch (err) {
      showToast(err.message || 'Could not save your reaction.');
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.reaction-btn');
    if (btn) handleReactionClick(btn);
  });

  // ---------- Portfolio grid ----------
  function cardMarkup(project) {
    const category = state.categories.find((c) => c.slug === project.category || c.name.toLowerCase() === project.category.toLowerCase());
    return `
      <article class="card" data-id="${project.id}">
        <button class="card-thumb" data-open="${project.id}" aria-label="Watch ${escapeHtml(project.title)}">
          <img src="${project.thumbnail}" alt="${escapeHtml(project.title)}" loading="lazy" />
          <div class="card-thumb-scrub"></div>
          <div class="card-play">
            <svg viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="11" fill="rgba(10,11,14,0.55)"/><path d="M10 8l6 4-6 4V8z" fill="white"/></svg>
          </div>
        </button>
        <div class="card-body">
          <div class="card-top-row">
            <span class="card-tag">${escapeHtml(category ? category.name : project.category)}</span>
            <span class="card-date mono">${project.date}</span>
          </div>
          <h3 class="card-title">${escapeHtml(project.title)}</h3>
          <p class="card-desc">${escapeHtml(project.description)}</p>
          <div class="card-footer">
            <div class="reactions">${reactionsMarkup(project)}</div>
            <button class="watch-btn" data-open="${project.id}">Watch</button>
          </div>
        </div>
      </article>`;
  }

  function renderGrid() {
    const grid = document.getElementById('projectGrid');
    const empty = document.getElementById('emptyState');
    const list = state.projects.filter((p) => {
      if (state.activeCategory === 'all') return true;
      const catObj = state.categories.find((c) => c.slug === state.activeCategory);
      return p.category === state.activeCategory || (catObj && p.category.toLowerCase() === catObj.name.toLowerCase());
    });

    grid.innerHTML = list.map(cardMarkup).join('');
    empty.style.display = list.length ? 'none' : 'block';

    grid.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => openModal(el.dataset.open));
    });
  }

  // ---------- Video modal ----------
  function videoEmbedMarkup(project) {
    if (project.videoType === 'youtube' && project.videoId) {
      return `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(project.videoId)}?rel=0" title="${escapeHtml(project.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
    if (project.videoType === 'vimeo' && project.videoId) {
      return `<iframe src="https://player.vimeo.com/video/${encodeURIComponent(project.videoId)}" title="${escapeHtml(project.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }
    if (project.videoUrl) {
      return `<video src="${project.videoUrl}" controls playsinline poster="${project.thumbnail}"></video>`;
    }
    return `<div style="color:#888;display:flex;align-items:center;justify-content:center;height:100%;font-family:var(--font-mono);font-size:13px;">Video not available yet</div>`;
  }

  function openModal(projectId) {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const category = state.categories.find((c) => c.slug === project.category || c.name.toLowerCase() === project.category.toLowerCase());

    document.getElementById('modalVideoWrap').innerHTML = videoEmbedMarkup(project);
    document.getElementById('modalCategory').textContent = category ? category.name : project.category;
    document.getElementById('modalTitle').textContent = project.title;
    document.getElementById('modalDesc').textContent = project.description;
    document.getElementById('modalDate').textContent = project.date;
    document.getElementById('modalReactions').innerHTML = reactionsMarkup(project);

    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    document.getElementById('modalVideoWrap').innerHTML = '';
    document.body.style.overflow = '';
  }

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ---------- Mobile menu ----------
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const menuBackdrop = document.getElementById('menuBackdrop');
  function toggleMenu(open) {
    mobileMenu.classList.toggle('open', open);
    menuBackdrop.classList.toggle('open', open);
    hamburgerBtn.setAttribute('aria-expanded', String(open));
  }
  hamburgerBtn.addEventListener('click', () => toggleMenu(!mobileMenu.classList.contains('open')));
  menuBackdrop.addEventListener('click', () => toggleMenu(false));
  mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggleMenu(false)));

  // ---------- Timeline scrubber ----------
  const scrubTicks = Array.from(document.querySelectorAll('.scrub-tick'));
  const playhead = document.getElementById('scrubPlayhead');
  const sectionIds = scrubTicks.map((t) => t.dataset.target);
  const navLinks = Array.from(document.querySelectorAll('.nav-links a'));

  scrubTicks.forEach((tick) => {
    tick.addEventListener('click', () => {
      document.getElementById(tick.dataset.target)?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  function updateScrub() {
    const doc = document.documentElement;
    const scrollTop = window.scrollY;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0;
    playhead.style.left = `${pct}%`;

    let current = sectionIds[0];
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 140) current = id;
    }
    scrubTicks.forEach((t) => t.classList.toggle('active', t.dataset.target === current));
    navLinks.forEach((a) => a.classList.toggle('active', a.dataset.nav === current));
  }
  window.addEventListener('scroll', updateScrub, { passive: true });
  window.addEventListener('resize', updateScrub);

  // ---------- Reveal on scroll ----------
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
  }

  // ---------- Boot ----------
  async function init() {
    try {
      const [{ settings, categories: rawCategories }, projects] = await Promise.all([
        getJSON(`${API}/settings`),
        getJSON(`${API}/projects`),
      ]);
      
      state.settings = settings;
      state.categories = (rawCategories || []).map(c => 
        typeof c === 'string' 
          ? { slug: c.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: c } 
          : c
      );
      state.projects = projects;

      renderSettings(settings, state.categories);
      renderTabs(state.categories);
      renderGrid();
      document.getElementById('heroProjectCount').textContent = projects.length;

      initReveal();
      updateScrub();
    } catch (err) {
      showToast('Could not load portfolio data. Is the server running?');
      console.error(err);
    }
  }

  init();
})();
