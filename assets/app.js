// NextClass Content Previewer
// Static SPA for GitHub Pages: lists content by grade/subject, shows Markdown vs HTML, collects feedback to JSON

(function () {
  const els = {
    gradeFilter: document.getElementById('gradeFilter'),
    subjectFilter: document.getElementById('subjectFilter'),
    list: document.getElementById('content-list'),
    viewer: document.getElementById('viewer'),
    currentTitle: document.getElementById('currentTitle'),
    currentMeta: document.getElementById('currentMeta'),
    toggleMarkdown: document.getElementById('toggleMarkdown'),
    htmlFrame: document.getElementById('htmlFrame'),
    markdownRender: document.getElementById('markdownRender'),
    divider: document.getElementById('divider'),
    split: document.getElementById('split'),
    openHtmlNewTab: document.getElementById('openHtmlNewTab'),
    mdVersionSelect: document.getElementById('mdVersionSelect'),
    htmlVersionSelect: document.getElementById('htmlVersionSelect'),
    feedbackTopBtn: document.getElementById('feedbackTopBtn'),
    backToTop: document.getElementById('backToTop'),
    teacherGrade: document.getElementById('teacherGrade'),
    feedbackForm: document.getElementById('feedbackForm'),
    emailHint: document.getElementById('emailHint'),
    // Ratings
    ratingQuality: document.getElementById('ratingQuality'),
    ratingOutput: document.getElementById('ratingOutput'),
    ratingAccuracy: document.getElementById('ratingAccuracy'),
    qualityVal: document.getElementById('qualityVal'),
    outputVal: document.getElementById('outputVal'),
    accuracyVal: document.getElementById('accuracyVal'),
    teacherName: document.getElementById('teacherName'),
    preferredVersion: document.getElementById('preferredVersion'),
    comments: document.getElementById('comments'),
    approve: document.getElementById('approve'),
  };

  let manifest = [];
  let currentContent = null;
  let cache = { md: null, html: null };
  let selectedMdPath = null;
  let selectedHtmlPath = null;

  // Utilities
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const unique = (arr) => [...new Set(arr)];
  const parseVersionFromPath = (p) => {
    try {
      const name = p.split('/').pop() || '';
      const m = name.match(/_(\d+)\.[a-zA-Z]+$/);
      return m ? Number(m[1]) : 1;
    } catch { return 1; }
  };
  const baseNameFromPath = (p) => {
    const name = (p.split('/').pop() || '').replace(/\.[^.]+$/, '');
    return name.replace(/_\d+$/, '');
  };

  async function loadManifest() {
    const res = await fetch('content-index.json');
    if (!res.ok) throw new Error('Failed to load content-index.json');
    const data = await res.json();
    manifest = data.items || [];
    populateFilters();
    populateTeacherGradeOptions();
    renderList();
  }

  function populateFilters() {
    const grades = unique(manifest.map((i) => i.grade));
    const subjects = unique(manifest.map((i) => i.subject));
    // Grade filter
    els.gradeFilter.innerHTML = '';
    const optAllG = el('option', '', 'All grades'); optAllG.value = '';
    els.gradeFilter.appendChild(optAllG);
    grades.sort((a,b)=> (''+a).localeCompare(''+b)).forEach((g) => {
      const o = el('option', '', `Grade ${g}`);
      o.value = g; els.gradeFilter.appendChild(o);
    });
    // Subject filter
    els.subjectFilter.innerHTML = '';
    const optAllS = el('option', '', 'All subjects'); optAllS.value = '';
    els.subjectFilter.appendChild(optAllS);
    subjects.sort().forEach((s) => {
      const o = el('option', '', titleCase(s));
      o.value = s; els.subjectFilter.appendChild(o);
    });
  }

  function populateTeacherGradeOptions() {
    els.teacherGrade.innerHTML = els.gradeFilter.innerHTML;
    // Ensure first option reads clearly
    const first = els.teacherGrade.querySelector('option');
    if (first) first.textContent = 'Select grade…';
  }

  function applyFilters() {
    const g = els.gradeFilter.value;
    const s = els.subjectFilter.value;
    return manifest.filter((item) => {
      return (g ? item.grade == g : true) && (s ? item.subject === s : true);
    });
  }

  function renderList() {
    const items = applyFilters();
    els.list.innerHTML = '';
    if (!items.length) {
      const empty = el('div', 'card');
      empty.appendChild(el('h3', '', 'No content found'));
      empty.appendChild(el('div', 'badge', 'Try switching grade/subject filters.'));
      els.list.appendChild(empty);
      return;
    }
    // Sort by title then version
    const sorted = items.slice().sort((a,b)=>{
      const tA = (a.title||'').localeCompare(b.title||'');
      if (tA !== 0) return tA;
      const vA = a.version || parseVersionFromPath(a.html||'');
      const vB = b.version || parseVersionFromPath(b.html||'');
      return vA - vB;
    });

    sorted.forEach((it) => {
      const card = el('article', 'card');
      const v = it.version || parseVersionFromPath(it.html||'');
      const title = el('h3', '', `${it.title} ${v>1?`(v${v})`:''}`);
      const meta = el('div', 'badge', `Grade ${it.grade} • ${titleCase(it.subject)}`);
      const row = el('div', 'row');
      const file = it.file || it.id || it.title;
      const filename = el('div', 'badge', file);
      const btn = el('button', 'primary', 'Open');
      btn.addEventListener('click', () => openViewer(it));
      row.appendChild(filename); row.appendChild(btn);
      card.appendChild(title); card.appendChild(meta); card.appendChild(row);
      els.list.appendChild(card);
    });
  }

  async function openViewer(item) {
    currentContent = item;
    els.viewer.classList.remove('hidden');
    const v = item.version || parseVersionFromPath(item.html||'');
    els.currentTitle.textContent = `${item.title} ${v>1?`(v${v})`:''}`;
    els.currentMeta.textContent = `Grade ${item.grade} • ${titleCase(item.subject)}`;
    // Determine variants and selections
    const { htmlVariants, markdownVariants } = collectVariants(item);
    selectedHtmlPath = item.html || htmlVariants[0] || '';
    selectedMdPath = item.markdown || markdownVariants[0] || '';
    els.openHtmlNewTab.href = selectedHtmlPath || '#';
    populateHtmlSelector(htmlVariants, selectedHtmlPath);
    populateMdSelector(markdownVariants, selectedMdPath);
    // Set teacher grade default to the item grade if empty
    if (!els.teacherGrade.value) {
      els.teacherGrade.value = String(item.grade);
    }
    // Load Markdown (optional)
    let hasMd = false;
    cache.md = '';
    if (selectedMdPath) {
      try {
        const mdRes = await fetch(selectedMdPath);
        if (mdRes.ok) {
          const mdText = await mdRes.text();
          cache.md = mdText;
          hasMd = true;
          try {
            const rendered = marked.parse(mdText);
            els.markdownRender.innerHTML = rendered;
          } catch (e) {
            els.markdownRender.textContent = mdText;
          }
        } else {
          els.markdownRender.innerHTML = `<em>Markdown not available.</em>`;
        }
      } catch (e) {
        els.markdownRender.innerHTML = `<em>Markdown not available.</em>`;
      }
    } else {
      els.markdownRender.innerHTML = `<em>Markdown not available.</em>`;
    }
    // Load HTML content for including in feedback JSON (iframe handles display)
    cache.html = await (await fetch(selectedHtmlPath)).text().catch(() => '');
    els.htmlFrame.src = selectedHtmlPath;
    // Update email hint subject for convenience
    const subj = encodeURIComponent(`NextClass Feedback: ${item.title}`);
    const body = encodeURIComponent('Attach your downloaded JSON feedback file. Thank you!');
    els.emailHint.href = `mailto:rishaal@nextclass.ca?subject=${subj}&body=${body}`;
    // Ensure markdown shown by default (hide if not available)
    ensureMarkdownVisible(!!hasMd);
    // Scroll to viewer
    els.viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ensureMarkdownVisible(show) {
    if (show) {
      els.split.classList.remove('markdown-hidden');
      els.toggleMarkdown.textContent = 'Hide Markdown';
    } else {
      els.split.classList.add('markdown-hidden');
      els.toggleMarkdown.textContent = 'Show Markdown';
    }
  }

  function initSplitResize() {
    let isDragging = false;
    let orientation = 'horizontal'; // or 'vertical' under narrow view

    const updateOrientation = () => {
      const style = window.getComputedStyle(els.split);
      // If using grid-template-rows (mobile), treat as vertical
      orientation = style.gridTemplateColumns && style.gridTemplateColumns.split(' ').length === 3 ? 'horizontal' : 'vertical';
      // Heuristic: when 3 columns present -> horizontal
    };

    const onDown = (e) => {
      updateOrientation();
      isDragging = true;
      document.body.style.userSelect = 'none';
    };
    const onMove = (e) => {
      if (!isDragging) return;
      const rect = els.split.getBoundingClientRect();
      if (orientation === 'horizontal') {
        const x = e.clientX - rect.left;
        const clamped = Math.max(160, Math.min(x, rect.width - 200));
        els.split.style.gridTemplateColumns = `${clamped}px 6px 1fr`;
      } else {
        const y = e.clientY - rect.top;
        const clamped = Math.max(160, Math.min(y, rect.height - 200));
        els.split.style.gridTemplateRows = `${clamped}px 6px 1fr`;
      }
    };
    const onUp = () => {
      isDragging = false;
      document.body.style.userSelect = '';
    };

    els.divider.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    // Touch support
    els.divider.addEventListener('touchstart', (e) => { onDown(e.touches[0]); e.preventDefault(); }, { passive: false });
    window.addEventListener('touchmove', (e) => onMove(e.touches[0]));
    window.addEventListener('touchend', onUp);
  }

  function initRatings() {
    const bind = (range, label) => {
      const update = () => label.textContent = range.value;
      range.addEventListener('input', update); update();
    };
    bind(els.ratingQuality, els.qualityVal);
    bind(els.ratingOutput, els.outputVal);
    bind(els.ratingAccuracy, els.accuracyVal);
  }

  function initPersistence() {
    // Prefill name/grade from localStorage
    const savedName = localStorage.getItem('nc_teacherName');
    const savedGrade = localStorage.getItem('nc_teacherGrade');
    if (savedName) els.teacherName.value = savedName;
    if (savedGrade) els.teacherGrade.value = savedGrade;

    els.teacherName.addEventListener('change', () => localStorage.setItem('nc_teacherName', els.teacherName.value));
    els.teacherGrade.addEventListener('change', () => localStorage.setItem('nc_teacherGrade', els.teacherGrade.value));
  }

  function initEvents() {
    els.gradeFilter.addEventListener('change', renderList);
    els.subjectFilter.addEventListener('change', renderList);
    els.toggleMarkdown.addEventListener('click', () => {
      const hidden = els.split.classList.contains('markdown-hidden');
      ensureMarkdownVisible(hidden);
    });
    els.feedbackTopBtn.addEventListener('click', () => {
      // Scroll to feedback section in viewer
      const fb = document.getElementById('feedback');
      fb?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    els.backToTop.addEventListener('click', (e) => {
      e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    els.feedbackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentContent) {
        alert('Please open a content item first.');
        return;
      }
      const name = els.teacherName.value.trim();
      const tGrade = els.teacherGrade.value.trim();
      if (!name || !tGrade) {
        alert('Please enter your name and grade.');
        return;
      }
      const payload = {
        schema: 'nextclass-feedback.v1',
        timestamp: new Date().toISOString(),
        pageUrl: location.href,
        teacher: {
          name,
          grade: tGrade,
        },
        content: {
          id: currentContent.id,
          title: currentContent.title,
          grade: currentContent.grade,
          subject: currentContent.subject,
          markdownPath: selectedMdPath || null,
          htmlPath: selectedHtmlPath || currentContent.html,
          markdownVersion: selectedMdPath ? parseVersionFromPath(selectedMdPath) : null,
          htmlVersion: selectedHtmlPath ? parseVersionFromPath(selectedHtmlPath) : (currentContent.version || parseVersionFromPath(currentContent.html || '')),
          fileName: currentContent.file || currentContent.id || currentContent.title,
        },
        ratings: {
          overallQuality: Number(els.ratingQuality.value),
          outputQuality: Number(els.ratingOutput.value),
          accuracy: Number(els.ratingAccuracy.value),
        },
        preferredVersion: els.preferredVersion.value,
        approved: !!els.approve.checked,
        comments: els.comments.value,
        markdownContent: cache.md,
        htmlContent: cache.html,
      };

      const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const safeId = (currentContent.id || currentContent.title).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const ts = new Date().toISOString().replace(/[:.]/g, '').replace('T','_').slice(0, 15);
      const filename = `feedback_${safeId}_${safeName}_${ts}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
      // Helpful reminder
      setTimeout(() => alert('Feedback JSON downloaded. Please attach it in an email to rishaal@nextclass.ca. Thank you!'), 100);
    });
    // HTML version switching
    els.htmlVersionSelect.addEventListener('change', async () => {
      const newHtml = els.htmlVersionSelect.value;
      if (!newHtml) return;
      selectedHtmlPath = newHtml;
      els.openHtmlNewTab.href = selectedHtmlPath;
      cache.html = await (await fetch(selectedHtmlPath)).text().catch(() => '');
      els.htmlFrame.src = selectedHtmlPath;
      // Update title version tag
      const v = parseVersionFromPath(selectedHtmlPath);
      els.currentTitle.textContent = `${currentContent.title} ${v>1?`(v${v})`:''}`;
    });
    // Markdown version switching
    els.mdVersionSelect.addEventListener('change', async () => {
      const newMd = els.mdVersionSelect.value;
      selectedMdPath = newMd || '';
      if (!newMd) {
        els.markdownRender.innerHTML = `<em>Markdown not available.</em>`;
        ensureMarkdownVisible(false);
        return;
      }
      try {
        const mdRes = await fetch(newMd);
        if (mdRes.ok) {
          const mdText = await mdRes.text();
          cache.md = mdText;
          try {
            const rendered = marked.parse(mdText);
            els.markdownRender.innerHTML = rendered;
          } catch (e) {
            els.markdownRender.textContent = mdText;
          }
          ensureMarkdownVisible(true);
        } else {
          els.markdownRender.innerHTML = `<em>Markdown not available.</em>`;
          ensureMarkdownVisible(false);
        }
      } catch (e) {
        els.markdownRender.innerHTML = `<em>Markdown not available.</em>`;
        ensureMarkdownVisible(false);
      }
    });
  }

  function initMarkedOptions() {
    if (window.marked) {
      marked.setOptions({
        breaks: true,
        gfm: true,
      });
    }
  }

  // Boot
  initSplitResize();
  initRatings();
  initPersistence();
  initEvents();
  initMarkedOptions();
  loadManifest().catch((e) => {
    console.error(e);
    els.list.innerHTML = '<div class="card"><h3>Failed to load manifest</h3><div class="badge">Ensure content-index.json is present.</div></div>';
  });

  // Variant helpers
  function collectVariants(item) {
    const group = manifest.filter(x => {
      if (item.id && x.id) return x.id === item.id;
      const itemBase = baseNameFromPath(item.html || item.markdown || '');
      const xBase = baseNameFromPath(x.html || x.markdown || '');
      return itemBase && xBase && itemBase === xBase;
    });
    let htmlVariants = [];
    if (Array.isArray(item.htmlVariants) && item.htmlVariants.length) {
      htmlVariants = item.htmlVariants.slice();
    } else {
      htmlVariants = unique(group.map(g => g.html).filter(Boolean));
    }
    htmlVariants.sort((a,b)=> (parseVersionFromPath(a) - parseVersionFromPath(b)));
    let markdownVariants = [];
    if (Array.isArray(item.markdownVariants) && item.markdownVariants.length) {
      markdownVariants = item.markdownVariants.slice();
    } else {
      markdownVariants = unique(group.map(g => g.markdown).filter(Boolean));
    }
    markdownVariants.sort((a,b)=> (parseVersionFromPath(a) - parseVersionFromPath(b)));
    return { htmlVariants, markdownVariants };
  }

  function populateHtmlSelector(htmlVariants, selected) {
    els.htmlVersionSelect.innerHTML = '';
    htmlVariants.forEach(h => {
      const v = parseVersionFromPath(h);
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = `v${v}`;
      if (h === selected) opt.selected = true;
      els.htmlVersionSelect.appendChild(opt);
    });
    els.htmlVersionSelect.disabled = htmlVariants.length <= 1;
  }

  function populateMdSelector(mdVariants, selected) {
    els.mdVersionSelect.innerHTML = '';
    if (!mdVariants.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'N/A';
      els.mdVersionSelect.appendChild(opt);
      els.mdVersionSelect.disabled = true;
      return;
    }
    mdVariants.forEach(m => {
      const v = parseVersionFromPath(m);
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `v${v}`;
      if (m === selected) opt.selected = true;
      els.mdVersionSelect.appendChild(opt);
    });
    els.mdVersionSelect.disabled = mdVariants.length <= 1;
  }
})();
