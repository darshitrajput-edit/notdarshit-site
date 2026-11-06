(() => {
  const API = '/api';
  let token = localStorage.getItem('dp_admin_token') || null;
  let categories = [];
  let projects = [];

  const $ = (sel) => document.querySelector(sel);
  const loginScreen = $('#loginScreen');
  const dashboard = $('#dashboard');

  // ---------- Toast ----------
  let toastTimer;
  function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // ---------- Auth-aware fetch ----------
  async function authFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.status === 401) {
      logout('Your session expired. Please log in again.');
      throw new Error('Session expired.');
    }
    return res;
  }
  async function authJSON(url, options = {}) {
    const res = await authFetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  function logout(message) {
    token = null;
    localStorage.removeItem('dp_admin_token');
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    if (message) showToast(message);
  }

  // ---------- Login ----------
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = $('#loginError');
    errorBox.classList.remove('show');
    const username = $('#loginUsername').value.trim();
    const password = $('#loginPassword').value;

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      token = data.token;
      localStorage.setItem('dp_admin_token', token);
      await boot();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    }
  });

  $('#logoutBtn').addEventListener('click', () => logout());

  // ---------- Tabs ----------
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      $('#tab-projects').style.display = tab.dataset.tab === 'projects' ? 'block' : 'none';
      $('#tab-settings').style.display = tab.dataset.tab === 'settings' ? 'block' : 'none';
    });
  });

  // ---------- Load categories + settings ----------
  async function loadSettings() {
    const res = await fetch(`${API}/settings`);
    const data = await res.json();
    const settings = data.settings || {};
    
    // Support both string array or object array formats for categories
    categories = (data.categories || []).map(c => typeof c === 'string' ? { slug: c.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: c } : c);

    updateCategoryDropdown();
    renderCategoriesUI();

    const form = $('#settingsForm');
    form.name.value = settings.name || '';
    form.tagline.value = settings.tagline || '';
    form.intro.value = settings.intro || '';
    form.aboutText.value = settings.aboutText || '';
    form.yearsExperience.value = settings.yearsExperience || '';
    form.skills.value = (settings.skills || []).join(', ');
    form.gmail.value = settings.gmail || '';
    form.instagram.value = settings.instagram || '';
    form.discord.value = settings.discord || '';
    $('#accentColorText').value = settings.accentColor || '#ff5c39';
    $('#accentColorPicker').value = settings.accentColor || '#ff5c39';
    $('#profilePhotoUrl').value = settings.profilePhoto || '';
    $('#profilePhotoManual').value = settings.profilePhoto || '';
    $('#photoPreview').src = settings.profilePhoto || '';
    document.documentElement.style.setProperty('--accent', settings.accentColor || '#ff5c39');
  }

  function updateCategoryDropdown() {
    const catSelect = $('#pf-category');
    if (!catSelect) return;
    catSelect.innerHTML = categories.map((c) => `<option value="${c.slug}">${c.name}</option>`).join('');
  }

  function renderCategoriesUI() {
    const container = $('#categories-list');
    if (!container) return;
    
    container.innerHTML = categories.map((c, index) => `
      <div style="display: flex; align-items: center; background: #1a1d24; padding: 6px 12px; border-radius: 4px; border: 1px solid #333; gap: 8px; color: #fff;">
        <span>${escapeHtml(c.name)}</span>
        <button type="button" class="remove-cat-btn" data-index="${index}" style="background: none; border: none; color: #ff5c39; cursor: pointer; font-weight: bold; font-size: 16px;">×</button>
      </div>
    `).join('');

    container.querySelectorAll('.remove-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        categories.splice(idx, 1);
        renderCategoriesUI();
        updateCategoryDropdown();
        saveCategoriesToServer();
      });
    });
  }

  $('#add-category-btn')?.addEventListener('click', () => {
    const input = $('#new-category-input');
    const val = input.value.trim();
    if (!val) return;
    const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!categories.some(c => c.slug === slug || c.name.toLowerCase() === val.toLowerCase())) {
      categories.push({ slug, name: val });
      input.value = '';
      renderCategoriesUI();
      updateCategoryDropdown();
      saveCategoriesToServer();
      showToast('Category added.');
    } else {
      showToast('Category already exists.');
    }
  });

  async function saveCategoriesToServer() {
    try {
      const form = $('#settingsForm');
      const payload = {
        name: form.name.value.trim(),
        tagline: form.tagline.value.trim(),
        intro: form.intro.value.trim(),
        aboutText: form.aboutText.value.trim(),
        yearsExperience: form.yearsExperience.value.trim(),
        skills: form.skills.value.split(',').map((s) => s.trim()).filter(Boolean),
        gmail: form.gmail.value.trim(),
        instagram: form.instagram.value.trim(),
        discord: form.discord.value.trim(),
        accentColor: $('#accentColorText').value.trim(),
        profilePhoto: $('#profilePhotoUrl').value.trim(),
        categories: categories.map(c => c.name) // Save as name strings or objects based on schema backend
      };

      await authJSON(`${API}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      showToast('Failed to save categories: ' + err.message);
    }
  }

  $('#accentColorPicker').addEventListener('input', (e) => {
    $('#accentColorText').value = e.target.value;
  });
  $('#accentColorText').addEventListener('input', (e) => {
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) $('#accentColorPicker').value = e.target.value;
  });
  $('#profilePhotoManual').addEventListener('input', (e) => {
    $('#profilePhotoUrl').value = e.target.value;
    $('#photoPreview').src = e.target.value;
  });
  $('#photoFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadFile('thumbnail', file);
      $('#profilePhotoUrl').value = url;
      $('#profilePhotoManual').value = url;
      $('#photoPreview').src = url;
    } catch (err) {
      showToast(err.message);
    }
  });

  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      name: form.name.value.trim(),
      tagline: form.tagline.value.trim(),
      intro: form.intro.value.trim(),
      aboutText: form.aboutText.value.trim(),
      yearsExperience: form.yearsExperience.value.trim(),
      skills: form.skills.value.split(',').map((s) => s.trim()).filter(Boolean),
      gmail: form.gmail.value.trim(),
      instagram: form.instagram.value.trim(),
      discord: form.discord.value.trim(),
      accentColor: $('#accentColorText').value.trim(),
      profilePhoto: $('#profilePhotoUrl').value.trim(),
      categories: categories.map(c => c.name)
    };
    try {
      await authJSON(`${API}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      document.documentElement.style.setProperty('--accent', payload.accentColor);
      const success = $('#settingsSuccess');
      success.classList.add('show');
      setTimeout(() => success.classList.remove('show'), 2500);
      showToast('Settings saved successfully!');
    } catch (err) {
      showToast(err.message);
    }
  });

  // ---------- Upload helper ----------
  async function uploadFile(kind, file) {
    const formData = new FormData();
    formData.append(kind, file);
    const res = await authFetch(`${API}/upload/${kind}`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data.url;
  }

  // ---------- Project list ----------
  async function loadProjects() {
    projects = await authJSON(`${API}/projects/all`);
    renderProjectList();
  }

  function categoryName(slug) {
    const c = categories.find((c) => c.slug === slug);
    return c ? c.name : slug;
  }

  function renderProjectList() {
    const wrap = $('#projectList');
    if (!projects.length) {
      wrap.innerHTML = '<p class="spinner-note">No edits yet. Click "Add New Edit" to upload your first one.</p>';
      return;
    }
    wrap.innerHTML = projects
      .map((p) => {
        const totalReactions = p.reactions.fire + p.reactions.good + p.reactions.bad;
        return `
        <div class="project-row">
          <img src="${p.thumbnail}" alt="" />
          <div>
            <div class="p-title">${escapeHtml(p.title)}</div>
            <div class="p-cat">${escapeHtml(categoryName(p.category))}</div>
          </div>
          <div><span class="badge ${p.published ? 'live' : 'draft'}">${p.published ? 'Live' : 'Draft'}</span></div>
          <div class="p-date">${p.date}</div>
          <div class="p-reactions">🔥${p.reactions.fire} 👍${p.reactions.good} 👎${p.reactions.bad} <br>(${totalReactions} total)</div>
          <div class="row-actions">
            <button class="icon-btn" data-action="toggle" data-id="${p.id}" title="${p.published ? 'Unpublish' : 'Publish'}">
              ${p.published ? eyeOffIcon() : eyeIcon()}
            </button>
            <button class="icon-btn" data-action="edit" data-id="${p.id}" title="Edit">${editIcon()}</button>
            <button class="icon-btn danger" data-action="delete" data-id="${p.id}" title="Delete">${trashIcon()}</button>
          </div>
        </div>`;
      })
      .join('');

    wrap.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'toggle') togglePublish(id);
        if (action === 'edit') openProjectModal(id);
        if (action === 'delete') deleteProject(id);
      });
    });
  }

  function escapeHtml(str = '') {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function togglePublish(id) {
    try {
      await authJSON(`${API}/projects/${id}/publish`, { method: 'PATCH' });
      await loadProjects();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function deleteProject(id) {
    const project = projects.find((p) => p.id === id);
    if (!confirm(`Delete "${project?.title || 'this edit'}"? This can't be undone.`)) return;
    try {
      await authFetch(`${API}/projects/${id}`, { method: 'DELETE' });
      await loadProjects();
      showToast('Edit deleted.');
    } catch (err) {
      showToast(err.message);
    }
  }

  // ---------- Add / edit project modal ----------
  const projectModalOverlay = $('#projectModalOverlay');
  const projectForm = $('#projectForm');
  let editingId = null;
  let pendingThumbUrl = '';
  let pendingVideoFileUrl = '';

  function openProjectModal(id) {
    editingId = id || null;
    pendingThumbUrl = '';
    pendingVideoFileUrl = '';
    $('#projectFormError').classList.remove('show');
    projectForm.reset();
    updateCategoryDropdown(); // Ensure dropdown is up to date
    $('#pf-thumbPreview').src = '';
    $('#pf-videoFileStatus').textContent = 'MP4, WebM, or MOV — up to 500MB.';

    if (id) {
      const p = projects.find((p) => p.id === id);
      $('#projectModalTitle').textContent = 'Edit Project';
      $('#projectId').value = p.id;
      $('#pf-title').value = p.title;
      $('#pf-category').value = p.category;
      $('#pf-date').value = p.date;
      $('#pf-description').value = p.description || '';
      $('#pf-videoType').value = p.videoType || 'youtube';
      $('#pf-videoId').value = p.videoId || '';
      $('#pf-videoUrl').value = p.videoUrl || '';
      $('#pf-thumbUrl').value = p.thumbnail || '';
      $('#pf-thumbPreview').src = p.thumbnail || '';
      $('#pf-published').checked = Boolean(p.published);
      pendingThumbUrl = p.thumbnail || '';
      pendingVideoFileUrl = p.videoType === 'file' ? (p.videoUrl || '') : '';
    } else {
      $('#projectModalTitle').textContent = 'Add New Edit';
      $('#projectId').value = '';
      $('#pf-date').value = new Date().toISOString().slice(0, 10);
      $('#pf-videoType').value = 'youtube';
    }
    updateVideoFieldVisibility();
    projectModalOverlay.classList.add('open');
  }

  function closeProjectModal() {
    projectModalOverlay.classList.remove('open');
  }
  $('#projectCancelBtn').addEventListener('click', closeProjectModal);
  projectModalOverlay.addEventListener('click', (e) => {
    if (e.target === projectModalOverlay) closeProjectModal();
  });
  $('#addProjectBtn').addEventListener('click', () => openProjectModal(null));

  function updateVideoFieldVisibility() {
    const type = $('#pf-videoType').value;
    $('#pf-videoIdWrap').style.display = type === 'youtube' || type === 'vimeo' ? 'block' : 'none';
    $('#pf-videoIdLabel').textContent = type === 'youtube' ? 'YouTube video ID or URL' : 'Vimeo video ID or URL';
    $('#pf-videoFileWrap').style.display = type === 'file' ? 'block' : 'none';
    $('#pf-videoUrlWrap').style.display = type === 'url' ? 'block' : 'none';
  }
  $('#pf-videoType').addEventListener('change', updateVideoFieldVisibility);

  function extractYouTubeId(input) {
    const trimmed = input.trim();
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/,
    ];
    for (const re of patterns) {
      const m = trimmed.match(re);
      if (m) return m[1];
    }
    return trimmed;
  }
  function extractVimeoId(input) {
    const trimmed = input.trim();
    const m = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? m[1] : trimmed;
  }

  $('#pf-thumbFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingThumbUrl = await uploadFile('thumbnail', file);
      $('#pf-thumbPreview').src = pendingThumbUrl;
      $('#pf-thumbUrl').value = pendingThumbUrl;
    } catch (err) {
      showToast(err.message);
    }
  });
  $('#pf-thumbUrl').addEventListener('input', (e) => {
    pendingThumbUrl = e.target.value.trim();
    $('#pf-thumbPreview').src = pendingThumbUrl;
  });

  $('#pf-videoFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $('#pf-videoFileStatus').textContent = 'Uploading…';
    try {
      pendingVideoFileUrl = await uploadFile('video', file);
      $('#pf-videoFileStatus').textContent = 'Uploaded ✓';
    } catch (err) {
      $('#pf-videoFileStatus').textContent = 'MP4, WebM, or MOV — up to 500MB.';
      showToast(err.message);
    }
  });

  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = $('#projectFormError');
    errorBox.classList.remove('show');

    const videoType = $('#pf-videoType').value;
    const thumbnail = ($('#pf-thumbUrl').value.trim()) || pendingThumbUrl;

    const payload = {
      title: $('#pf-title').value.trim(),
      category: $('#pf-category').value,
      date: $('#pf-date').value,
      description: $('#pf-description').value.trim(),
      videoType,
      videoId: null,
      videoUrl: null,
      thumbnail,
      published: $('#pf-published').checked,
    };

    if (videoType === 'youtube') payload.videoId = extractYouTubeId($('#pf-videoId').value);
    if (videoType === 'vimeo') payload.videoId = extractVimeoId($('#pf-videoId').value);
    if (videoType === 'url') payload.videoUrl = $('#pf-videoUrl').value.trim();
    if (videoType === 'file') payload.videoUrl = pendingVideoFileUrl;

    if (!thumbnail) {
      errorBox.textContent = 'Please add a thumbnail (upload a file or paste an image URL).';
      errorBox.classList.add('show');
      return;
    }
    if (videoType === 'file' && !pendingVideoFileUrl) {
      errorBox.textContent = 'Please upload a video file, or switch to another video source.';
      errorBox.classList.add('show');
      return;
    }
    if ((videoType === 'youtube' || videoType === 'vimeo') && !payload.videoId) {
      errorBox.textContent = 'Please paste a video link or ID.';
      errorBox.classList.add('show');
      return;
    }
    if (videoType === 'url' && !payload.videoUrl) {
      errorBox.textContent = 'Please paste a direct video URL.';
      errorBox.classList.add('show');
      return;
    }

    try {
      if (editingId) {
        await authJSON(`${API}/projects/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast('Edit updated.');
      } else {
        await authJSON(`${API}/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        showToast('Edit added.');
      }
      closeProjectModal();
      await loadProjects();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    }
  });

  // ---------- Icons ----------
  function eyeIcon() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
  function eyeOffIcon() {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 3 18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6 0 10 7 10 7a17.7 17.7 0 0 1-3.1 3.9M6.6 6.6C4 8.3 2 12 2 12s4 7 10 7a10 10 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  }
  function editIcon() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  }
  function trashIcon() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>';
  }

  // ---------- Boot ----------
  async function boot() {
    try {
      await loadSettings();
      await loadProjects();
      loginScreen.style.display = 'none';
      dashboard.style.display = 'block';
    } catch (err) {
      logout();
    }
  }

  if (token) {
    boot();
  }
})();
