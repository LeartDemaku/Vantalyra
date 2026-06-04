const CLOUDINARY_CLOUD = 'ddoagbtbx';
const CLOUDINARY_UPLOAD_PRESET = 'vantalyra_docs';

const Dashboard = (() => {
  let documents = [];
  let activityLog = [];
  let currentView = 'grid';
  let currentFilter = 'all';
  let sidebarOpen = false;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function init() {
    if (!isDashboard()) return;
    if (!checkAuth()) return;

    loadUser();
    bindNavigation();
    bindSidebar();
    bindUpload();
    bindSearch();
    bindFilter();
    bindViewToggle();
    bindQuickActions();
    bindThemeToggle();
    bindNotifications();
    loadDocuments();
    loadActivity();
    updateStats();
  }

  function isDashboard() {
    return $('#section-overview') !== null;
  }

  function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  function getToken() {
    return localStorage.getItem('token');
  }

  function loadUser() {
    const name = localStorage.getItem('fullName') || 'Përdoruesi';
    const initial = name.charAt(0).toUpperCase();

    const els = [
      $('#sidebar-avatar'),
      $('#topbar-avatar'),
    ];
    els.forEach(el => { if (el) el.textContent = initial; });

    const nameEls = [
      $('#sidebar-user-name'),
      $('#topbar-name'),
      $('#welcome-name'),
    ];
    nameEls.forEach(el => { if (el) el.textContent = name; });

    $('#sidebar-logout')?.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });

    const userDropdown = $('#topbar-user-dropdown');
    $('#topbar-user')?.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown?.classList.toggle('show');
    });

    $('#topbar-profile-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchSection('overview');
      userDropdown?.classList.remove('show');
    });

    $('#topbar-logout-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logout();
    });

    document.addEventListener('click', (e) => {
      const topbarUser = $('#topbar-user');
      if (topbarUser && !topbarUser.contains(e.target)) {
        userDropdown?.classList.remove('show');
      }
    });
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('fullName');
    window.location.href = 'login.html';
  }

  function bindNavigation() {
    $$('.nav-item[data-section]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        switchSection(section);
        if (window.innerWidth < 1024) closeSidebar();
      });
    });
  }

  function switchSection(name) {
    $$('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
    const navItem = $(`.nav-item[data-section="${name}"]`);
    if (navItem) navItem.classList.add('active');

    $$('.section-panel').forEach(s => s.classList.remove('active'));
    const section = $(`#section-${name}`);
    if (section) section.classList.add('active');
  }

  function bindSidebar() {
    $('#menu-toggle')?.addEventListener('click', openSidebar);
    $('#sidebar-close')?.addEventListener('click', closeSidebar);

    document.addEventListener('click', (e) => {
      if (sidebarOpen && window.innerWidth < 1024) {
        const sidebar = $('#sidebar');
        if (sidebar && !sidebar.contains(e.target) && e.target.id !== 'menu-toggle') {
          closeSidebar();
        }
      }
    });
  }

  function openSidebar() {
    $('#sidebar')?.classList.add('open');
    sidebarOpen = true;
  }

  function closeSidebar() {
    $('#sidebar')?.classList.remove('open');
    sidebarOpen = false;
  }

  function bindUpload() {
    const zone = $('#upload-zone');
    const input = $('#file-input');
    const browseBtn = $('#browse-btn');
    const closeProgress = $('#close-progress');

    if (!zone || !input) return;

    ['dragenter', 'dragover'].forEach(evt => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.remove('drag-active');
      });
    });

    zone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length) handleFiles(files);
    });

    zone.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        input.click();
      }
    });

    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      input.click();
    });

    input.addEventListener('change', function () {
      if (this.files.length) handleFiles(this.files);
      this.value = '';
    });

    closeProgress?.addEventListener('click', () => {
      $('#upload-progress-container')?.style.setProperty('display', 'none', 'important');
    });
  }

  async function handleFiles(files) {
    $('#upload-progress-container')?.style.removeProperty('display');
    const queue = $('#upload-queue');
    if (queue) queue.innerHTML = '';

    const uploadPromises = [...files].map(file => uploadFile(file, queue));
    await Promise.all(uploadPromises);

    setTimeout(() => {
      loadDocuments();
      updateStats();
    }, 500);
  }

  function uploadFile(file, queue) {
    return new Promise((resolve) => {
      const itemId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      if (queue) {
        queue.insertAdjacentHTML('afterbegin', `
          <div class="upload-item" id="${itemId}">
            <div class="upload-item-header">
              <span class="upload-item-name">${file.name}</span>
              <span class="upload-item-status" id="${itemId}-status">0%</span>
            </div>
            <div class="upload-progress-bar">
              <div class="upload-progress-fill" id="${itemId}-bar" style="width: 0%"></div>
            </div>
          </div>
        `);
      }

      const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/upload`;
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('resource_type', 'auto');

      xhr.open('POST', url, true);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          const statusEl = document.getElementById(`${itemId}-status`);
          const barEl = document.getElementById(`${itemId}-bar`);
          if (statusEl) statusEl.textContent = `${pct}%`;
          if (barEl) barEl.style.width = `${pct}%`;
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          const statusEl = document.getElementById(`${itemId}-status`);
          const barEl = document.getElementById(`${itemId}-bar`);
          if (statusEl) { statusEl.textContent = 'Complete'; statusEl.classList.add('complete'); }
          if (barEl) barEl.style.width = '100%';

          try {
            const token = getToken();
            const docData = {
              filename: res.original_filename,
              format: res.format,
              resource_type: res.resource_type,
              url: res.secure_url,
            };

            const saveRes = await fetch('/api/documents', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(docData),
            });

            if (saveRes.ok) {
              const saved = await saveRes.json();
              addActivity('upload', saved.filename);
              showToast('Dokumenti u ngarkua me sukses!', 'success');
            } else {
              showToast('Gabim gjatë ruajtjes së dokumentit.', 'error');
            }
          } catch (err) {
            console.error('Save error:', err);
            showToast('Gabim në rrjet.', 'error');
          }
        } else {
          const statusEl = document.getElementById(`${itemId}-status`);
          if (statusEl) { statusEl.textContent = 'Error'; statusEl.classList.add('error'); }
          showToast('Ngarkimi dështoi.', 'error');
        }
        resolve();
      });

      xhr.addEventListener('error', () => {
        const statusEl = document.getElementById(`${itemId}-status`);
        if (statusEl) { statusEl.textContent = 'Error'; statusEl.classList.add('error'); }
        showToast('Gabim në rrjet gjatë ngarkimit.', 'error');
        resolve();
      });

      xhr.send(formData);
    });
  }

  async function loadDocuments() {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        documents = await res.json();
        renderDocuments();
        updateStats();
      }
    } catch (err) {
      console.error('Load documents error:', err);
    }
  }

  function renderDocuments() {
    const container = $('#documents-container');
    if (!container) return;

    let filtered = documents;
    if (currentFilter !== 'all') {
      if (currentFilter === 'image') {
        filtered = documents.filter(d => d.resource_type === 'image');
      } else if (currentFilter === 'document') {
        filtered = documents.filter(d => d.resource_type !== 'image');
      }
    }

    if (!filtered.length) {
      container.className = 'documents-grid';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          </div>
          <h3>Nuk ka dokumente ende</h3>
          <p>Ngarkoni dokumentin tuaj të parë për ta parë këtu</p>
          <button class="btn-primary" onclick="document.querySelector('[data-section=upload]').click()">Ngarko Tani</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(doc => {
      const isImage = doc.resource_type === 'image';
      const preview = isImage
        ? `<img src="${doc.url}" alt="${doc.filename}" loading="lazy">`
        : `<svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;

      const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('sq-AL') : '';

      return `
        <div class="doc-card ${currentView === 'list' ? 'list-item' : ''}" data-id="${doc.id}">
          <a href="${doc.url}" target="_blank" rel="noopener" class="doc-preview-link">
            <div class="doc-preview">${preview}</div>
          </a>
          <div class="doc-info">
            <div class="doc-name" title="${doc.filename}.${doc.format}">${doc.filename}.${doc.format}</div>
            <div class="doc-meta">
              <span class="doc-type">${doc.resource_type} / ${doc.format}</span>
              ${date ? `<span class="doc-date">${date}</span>` : ''}
            </div>
          </div>
          <div class="doc-actions">
            <a href="${doc.url}" target="_blank" rel="noopener" class="doc-btn doc-btn-view" title="Shiko">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </a>
            <button class="doc-btn doc-btn-delete" onclick="Dashboard.deleteDoc('${doc.id}')" title="Fshi">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    const countEl = $('#doc-count');
    if (countEl) countEl.textContent = `${filtered.length} dokumente`;
  }

  async function deleteDoc(id) {
    if (!id) {
      showToast('Gabim: ID e dokumentit nuk u gjet.', 'error');
      return;
    }

    if (!confirm('A jeni të sigurt që dëshironi ta fshini këtë dokument?')) return;

    try {
      const token = getToken();
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const doc = documents.find(d => d.id == id);
        if (doc) addActivity('delete', doc.filename);

        documents = documents.filter(d => d.id != id);
        renderDocuments();
        updateStats();
        showToast('Dokumenti u fshi me sukses!', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Gabim gjatë fshirjes.', 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Gabim në rrjet.', 'error');
    }
  }

  function bindSearch() {
    const searchInput = $('#global-search');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = searchInput.value.toLowerCase().trim();
        if (!query) {
          renderDocuments();
          return;
        }

        const container = $('#documents-container');
        if (!container) return;

        const results = documents.filter(d =>
          d.filename.toLowerCase().includes(query) ||
          d.format.toLowerCase().includes(query) ||
          d.resource_type.toLowerCase().includes(query)
        );

        if (!results.length) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <h3>Asnjë rezultat</h3>
              <p>Provoni me një kërkim tjetër</p>
            </div>
          `;
          return;
        }

        const savedDocs = documents;
        documents = results;
        renderDocuments();
        documents = savedDocs;

        if (!$('#section-documents').classList.contains('active')) {
          switchSection('documents');
        }
      }, 300);
    });
  }

  function bindFilter() {
    $('#filter-type')?.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      renderDocuments();
    });
  }

  function bindViewToggle() {
    $('#view-grid')?.addEventListener('click', () => setView('grid'));
    $('#view-list')?.addEventListener('click', () => setView('list'));
  }

  function setView(view) {
    currentView = view;
    const container = $('#documents-container');
    if (container) {
      container.classList.toggle('list-view', view === 'list');
    }
    $('#view-grid')?.classList.toggle('active', view === 'grid');
    $('#view-list')?.classList.toggle('active', view === 'list');
    renderDocuments();
  }

  function bindQuickActions() {
    $$('.action-btn[data-action], .view-all[data-action], .btn-primary[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'upload' || action === 'documents' || action === 'activity') {
          switchSection(action);
        } else if (action === 'settings') {
          showToast('Cilësimet vijnë së shpejti!', 'info');
        }
      });
    });
  }

  function bindThemeToggle() {
    $('#theme-toggle')?.addEventListener('click', () => {
      showToast('Temat vijnë së shpejti!', 'info');
    });
  }

  function bindNotifications() {
    const btn = $('#notification-btn');
    const dropdown = $('#notification-dropdown');
    const clearBtn = $('#clear-notifications');
    const dot = $('#notification-dot');

    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
      if (dropdown.classList.contains('show')) {
        dot?.style.setProperty('display', 'none');
        renderNotifications();
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.classList.remove('show');
      }
    });

    clearBtn?.addEventListener('click', () => {
      localStorage.removeItem('vantalyra_notifications');
      renderNotifications();
      dot?.style.setProperty('display', 'none');
    });
  }

  function renderNotifications() {
    const list = $('#notifications-list');
    if (!list) return;

    let notifications = [];
    try {
      const stored = localStorage.getItem('vantalyra_notifications');
      if (stored) notifications = JSON.parse(stored);
    } catch (e) { /* ignore */ }

    if (!notifications.length) {
      list.innerHTML = '<div class="notification-empty">Nuk ka njoftime të reja</div>';
      return;
    }

    list.innerHTML = notifications.slice(0, 10).map(n => {
      const isUpload = n.type === 'upload';
      const iconBg = isUpload ? 'activity-icon-upload' : 'activity-icon-delete';
      const iconSvg = isUpload
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

      return `
        <div class="notification-item">
          <div class="notification-item-icon ${iconBg}">${iconSvg}</div>
          <div class="notification-item-content">
            <div class="notification-item-text">${n.message}</div>
            <div class="notification-item-time">${getTimeAgo(n.time)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function addNotification(type, message) {
    let notifications = [];
    try {
      const stored = localStorage.getItem('vantalyra_notifications');
      if (stored) notifications = JSON.parse(stored);
    } catch (e) { /* ignore */ }

    notifications.unshift({ type, message, time: new Date().toISOString() });
    notifications = notifications.slice(0, 20);
    localStorage.setItem('vantalyra_notifications', JSON.stringify(notifications));

    const dot = $('#notification-dot');
    if (dot) dot.style.removeProperty('display');
  }

  function updateStats() {
    const total = documents.length;
    const images = documents.filter(d => d.resource_type === 'image').length;
    const other = total - images;

    const today = new Date().toDateString();
    const todayUploads = documents.filter(d => {
      if (!d.created_at) return false;
      return new Date(d.created_at).toDateString() === today;
    }).length;

    animateValue($('#stat-documents'), total);
    animateValue($('#stat-images'), images);
    animateValue($('#stat-uploads'), todayUploads);

    const storagePercent = Math.min(total * 5, 100);
    const circumference = 2 * Math.PI * 50;
    const fill = $('#storage-fill');
    const percentText = $('#storage-percent');

    if (fill) {
      const offset = circumference - (storagePercent / 100) * circumference;
      fill.style.strokeDashoffset = offset;
    }
    if (percentText) percentText.textContent = `${storagePercent}%`;

    const storageDocs = $('#storage-docs');
    const storageImgs = $('#storage-imgs');
    const storageOther = $('#storage-other');

    if (storageDocs) storageDocs.textContent = documents.filter(d => d.resource_type !== 'image').length;
    if (storageImgs) storageImgs.textContent = images;
    if (storageOther) storageOther.textContent = other;
  }

  function animateValue(el, target) {
    if (!el) return;
    const duration = 800;
    const start = parseInt(el.textContent) || 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  function addActivity(type, filename) {
    const entry = {
      type,
      filename,
      time: new Date().toISOString(),
    };
    activityLog.unshift(entry);
    saveActivity();
    renderActivity();

    const message = type === 'upload'
      ? `Dokumenti <strong>${filename}</strong> u ngarkua me sukses`
      : `Dokumenti <strong>${filename}</strong> u fshi`;
    addNotification(type, message);
  }

  function loadActivity() {
    try {
      const stored = localStorage.getItem('vantalyra_activity');
      if (stored) activityLog = JSON.parse(stored);
    } catch (e) {
      activityLog = [];
    }
    renderActivity();
  }

  function saveActivity() {
    try {
      localStorage.setItem('vantalyra_activity', JSON.stringify(activityLog.slice(0, 50)));
    } catch (e) {
      // Storage full, trim older entries
      activityLog = activityLog.slice(0, 20);
      localStorage.setItem('vantalyra_activity', JSON.stringify(activityLog));
    }
  }

  function renderActivity() {
    const recentList = $('#activity-list');
    const fullList = $('#activity-full-list');

    if (!recentList && !fullList) return;

    if (!activityLog.length) {
      const emptyHTML = `
        <div class="activity-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          <p>Asnjë aktivitet ende</p>
        </div>
      `;
      if (recentList) recentList.innerHTML = emptyHTML;
      if (fullList) {
        fullList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </div>
            <h3>Asnjë aktivitet ende</h3>
            <p>Aktiviteti juaj do të shfaqet këtu</p>
          </div>
        `;
      }
      return;
    }

    const renderItems = (items, limit) => {
      const list = limit ? items.slice(0, limit) : items;
      return list.map(entry => {
        const isUpload = entry.type === 'upload';
        const iconClass = isUpload ? 'activity-icon-upload' : 'activity-icon-delete';
        const iconSvg = isUpload
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';

        const actionText = isUpload ? 'Ngarkoi' : 'Fshi';
        const timeAgo = getTimeAgo(entry.time);

        return `
          <div class="activity-item">
            <div class="activity-icon ${iconClass}">${iconSvg}</div>
            <div class="activity-content">
              <div class="activity-text"><strong>${actionText}</strong> <strong>${entry.filename}</strong></div>
              <div class="activity-time">${timeAgo}</div>
            </div>
          </div>
        `;
      }).join('');
    };

    if (recentList) recentList.innerHTML = renderItems(activityLog, 5);
    if (fullList) fullList.innerHTML = renderItems(activityLog);
  }

  function getTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Tani';
    if (diffMin < 60) return `${diffMin} min më parë`;
    if (diffHr < 24) return `${diffHr} orë më parë`;
    if (diffDay < 7) return `${diffDay} ditë më parë`;
    return date.toLocaleDateString('sq-AL');
  }

  function showToast(message, type = 'info') {
    const container = $('#toast-container');
    if (!container) return;

    const icons = {
      success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  return {
    init,
    deleteDoc,
    showToast,
    switchSection,
    addActivity,
  };
})();

document.addEventListener('DOMContentLoaded', () => Dashboard.init());

const vëzhguesiReveal = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[class*="reveal-"]').forEach(el => vëzhguesiReveal.observe(el));
});

const formaKontaktit = document.querySelector('.forma-kontaktit');
if (formaKontaktit) {
  formaKontaktit.addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      const response = await fetch(e.target.action, {
        method: e.target.method,
        body: new FormData(e.target),
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        window.alert('Mesazhi u dërgua me sukses! Faleminderit që na kontaktuat.');
        e.target.reset();
      } else {
        window.alert('Ndodhi një problem gjatë dërgimit.');
      }
    } catch {
      window.alert('Ndodhi një gabim në rrjet.');
    }
  });
}

const menyToggle = document.getElementById('meny-toggle');
const lidhjetNav = document.getElementById('lidhjet-navigimit');
if (menyToggle && lidhjetNav) {
  menyToggle.addEventListener('click', () => {
    menyToggle.classList.toggle('aktiv');
    lidhjetNav.classList.toggle('aktiv');
  });
  document.querySelectorAll('.lidhja-kthyese, .butoni-kycje').forEach(link => {
    link.addEventListener('click', () => {
      menyToggle.classList.remove('aktiv');
      lidhjetNav.classList.remove('aktiv');
    });
  });
}

document.addEventListener('mousemove', (e) => {
  const karta = document.getElementById('karta-interaktive');
  if (!karta) return;
  const { clientX, clientY } = e;
  const { innerWidth, innerHeight } = window;
  const xRotation = ((clientY / innerHeight) - 0.5) * 20;
  const yRotation = ((clientX / innerWidth) - 0.5) * -20;
  karta.style.transform = `perspective(1000px) rotateX(${xRotation}deg) rotateY(${yRotation}deg) scale3d(1.02, 1.02, 1.02)`;
  const shkelqimi = karta.querySelector('.shkelqimi-karti');
  if (shkelqimi) {
    const xPercent = (clientX / innerWidth) * 100;
    const yPercent = (clientY / innerHeight) * 100;
    shkelqimi.style.background = `radial-gradient(circle at ${xPercent}% ${yPercent}%, rgba(255,255,255,0.15) 0%, transparent 60%)`;
  }
});

document.addEventListener('mouseleave', () => {
  const karta = document.getElementById('karta-interaktive');
  if (karta) karta.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
});
