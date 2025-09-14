// NextClass Content Previewer
// Static SPA for GitHub Pages: lists content by grade/subject, shows Markdown vs HTML, collects feedback to JSON

(function () {
  const els = {
    gradeFilter: document.getElementById('gradeFilter'),
    subjectFilter: document.getElementById('subjectFilter'),
    listBoth: document.getElementById('content-list-both'),
    listHtmlOnly: document.getElementById('content-list-html-only'),
    listsContainer: document.getElementById('listsContainer'),
    legendBar: document.getElementById('legendBar'),
    viewer: document.getElementById('viewer'),
    currentTitle: document.getElementById('currentTitle'),
    currentMeta: document.getElementById('currentMeta'),
    backToLibraryBtn: document.getElementById('backToLibraryBtn'),
    htmlFrame: document.getElementById('htmlFrame'),
    markdownRender: document.getElementById('markdownRender'),
    split: document.getElementById('split'),
    openHtmlNewTab: document.getElementById('openHtmlNewTab'),
    htmlVersionButtons: document.getElementById('htmlVersionButtons'),
    toggleRawPaneBtn: document.getElementById('toggleRawPaneBtn'),
    currentVersionLabel: document.getElementById('currentVersionLabel'),
    preferenceSelect: document.getElementById('preferenceSelect'),
    currentViewNote: document.getElementById('currentViewNote'),
    feedbackTopBtn: document.getElementById('feedbackTopBtn'),
    backToTop: document.getElementById('backToTop'),
    teacherGrade: document.getElementById('teacherGrade'),
    teacherSchool: document.getElementById('teacherSchool'),
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
    const grades = ['K'];
    for (let i=1;i<=12;i++) grades.push(String(i));
    els.teacherGrade.innerHTML = '';
    const first = el('option','', 'Select grade…'); first.value = '';
    els.teacherGrade.appendChild(first);
    grades.forEach(g => {
      const o = el('option','', g);
      o.value = g; els.teacherGrade.appendChild(o);
    });
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
    els.listBoth.innerHTML = '';
    els.listHtmlOnly.innerHTML = '';
    if (!items.length) {
      const empty = el('div', 'card');
      empty.appendChild(el('h3', '', 'No content found'));
      empty.appendChild(el('div', 'badge', 'Try switching grade/subject filters.'));
      els.listBoth.appendChild(empty);
      return;
    }
    // Determine group keys and markdown availability per group
    const groupKey = (it) => (it.id) || baseNameFromPath(it.html || it.markdown || it.file || '');
    const hasMdByGroup = {};
    items.forEach((it) => {
      const key = groupKey(it);
      const hasMd = (Array.isArray(it.markdownVariants) ? it.markdownVariants.length > 0 : !!it.markdown);
      hasMdByGroup[key] = hasMdByGroup[key] || hasMd;
    });
    const both = [];
    const htmlOnly = [];
    items.forEach((it) => {
      const key = groupKey(it);
      if (hasMdByGroup[key]) both.push(it); else htmlOnly.push(it);
    });
    const sortItems = (arr) => arr.slice().sort((a,b)=>{
      const tA = (a.title||'').localeCompare(b.title||'');
      if (tA !== 0) return tA;
      const vA = a.version || parseVersionFromPath(a.html||'');
      const vB = b.version || parseVersionFromPath(b.html||'');
      return vA - vB;
    });
    const renderInto = (arr, container, isBoth) => {
      if (!arr.length) {
        const n = el('div', 'card');
        n.appendChild(el('h3', '', 'No items'));
        n.appendChild(el('div', 'badge', 'Nothing to show here.'));
        container.appendChild(n);
        return;
      }
      // Group by grade
      const groups = {};
      arr.forEach((it)=>{
        const g = (it.grade || '').toString() || 'Unspecified';
        (groups[g] ||= []).push(it);
      });
      const gradeSortVal = (g) => {
        if (g.toLowerCase() === 'k') return -1;
        const n = parseInt(g, 10);
        return isNaN(n) ? 999 : n;
      };
      Object.keys(groups).sort((a,b)=> gradeSortVal(a)-gradeSortVal(b)).forEach((g)=>{
        const wrap = el('div', 'grade-group');
        wrap.appendChild(el('div', 'grade-header', `Grade ${g}`));
        const cards = el('section', 'cards');
        sortItems(groups[g]).forEach((it) => {
          const card = el('article', 'card');
          const v = it.version || parseVersionFromPath(it.html||'');
          const title = el('h3', '', `${it.title} ${v>1?`(v${v})`:''}`);
          const meta = el('div', 'badge', `Grade ${it.grade || '—'} • ${titleCase(it.subject || '')}`);
          const type = el('span', `badge type-badge ${isBoth?'type-mdhtml':'type-htmlonly'}`, isBoth ? 'Raw+Web' : 'Web Only');
          const row = el('div', 'row');
          const file = it.file || it.id || it.title;
          const filename = el('div', 'badge', file);
          const btn = el('button', 'primary', 'Open');
          btn.addEventListener('click', () => openViewer(it));
          row.appendChild(filename); row.appendChild(btn);
          card.appendChild(title);
          const metaRow = el('div'); metaRow.appendChild(meta); metaRow.appendChild(type); card.appendChild(metaRow);
          card.appendChild(row);
          cards.appendChild(card);
        });
        wrap.appendChild(cards);
        container.appendChild(wrap);
      });
    };
    renderInto(both, els.listBoth, true);
    renderInto(htmlOnly, els.listHtmlOnly, false);
  }

  async function openViewer(item) {
    currentContent = item;
    if (els.listsContainer) els.listsContainer.style.display = 'none';
    if (els.legendBar) els.legendBar.style.display = 'none';
    els.viewer.classList.remove('hidden');
    const v = item.version || parseVersionFromPath(item.html||'');
    els.currentTitle.textContent = `${item.title} ${v>1?`(v${v})`:''}`;
    els.currentMeta.textContent = `Grade ${item.grade} • ${titleCase(item.subject)}`;
    // Determine variants and selections
    const { htmlVariants, markdownVariants } = collectVariants(item);
    selectedHtmlPath = item.html || htmlVariants[0] || '';
    selectedMdPath = item.markdown || markdownVariants[0] || '';
    els.openHtmlNewTab.href = selectedHtmlPath || '#';
    buildHtmlVersionButtons(htmlVariants, selectedHtmlPath);
    updateViewLabels();
    buildPreferenceOptions(htmlVariants, !!selectedMdPath);
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
    // Pre-populate email link
    updateEmailHint({ title: item.title });
    // Ensure markdown shown by default if available
    ensureMarkdownVisible(!!hasMd);
    if (els.toggleRawPaneBtn) {
      els.toggleRawPaneBtn.disabled = !hasMd;
      if (!hasMd) els.toggleRawPaneBtn.textContent = 'Raw Text Unavailable';
    }
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function ensureMarkdownVisible(show) {
    if (show) {
      els.split.classList.add('raw-visible');
      if (els.toggleRawPaneBtn) els.toggleRawPaneBtn.textContent = 'Hide Raw Text →';
    } else {
      els.split.classList.remove('raw-visible');
      if (els.toggleRawPaneBtn) els.toggleRawPaneBtn.textContent = 'Show Raw Text ←';
    }
  }

  // Removed split resizing; layout toggles via class only

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
    if (els.toggleRawPaneBtn) {
      els.toggleRawPaneBtn.addEventListener('click', () => {
        const visible = els.split.classList.contains('raw-visible');
        ensureMarkdownVisible(!visible);
      });
    }
    els.feedbackTopBtn.addEventListener('click', () => {
      // Scroll to feedback section in viewer
      const fb = document.getElementById('feedback');
      fb?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (els.backToLibraryBtn) {
      els.backToLibraryBtn.addEventListener('click', () => {
        els.viewer.classList.add('hidden');
        if (els.listsContainer) els.listsContainer.style.display = '';
        if (els.legendBar) els.legendBar.style.display = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
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
      const school = (els.teacherSchool?.value || '').trim();
      const commentText = els.comments.value.trim();
      if (!name || !tGrade) {
        alert('Please enter your name and grade.');
        return;
      }
      if (!commentText) {
        alert('Please leave feedback in the comments.');
        return;
      }
      const preferred = els.preferenceSelect?.value || '';
      const payload = {
        schema: 'nextclass-feedback.v1',
        timestamp: new Date().toISOString(),
        pageUrl: location.href,
        teacher: {
          name,
          grade: tGrade,
          school: school || null,
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
          functionality: Number(els.ratingQuality.value),
          outputQuality: Number(els.ratingOutput.value),
          accuracy: Number(els.ratingAccuracy.value),
        },
        preferred,
        approved: !!els.approve.checked,
        comments: commentText,
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
      setTimeout(() => alert('Feedback JSON downloaded. Please attach it in an email to hello@nextclass.ca. Thank you!'), 120);
      updateEmailHint({ title: payload.content.title, payload });
    });
    // HTML version switching now handled by buttons
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
  initRatings();
  initPersistence();
  initEvents();
  initMarkedOptions();
  loadManifest().catch((e) => {
    console.error(e);
    if (els.listBoth) {
      els.listBoth.innerHTML = '<div class="card"><h3>Failed to load manifest</h3><div class="badge">Ensure content-index.json is present.</div></div>';
    }
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

  function buildHtmlVersionButtons(htmlVariants, selected) {
    els.htmlVersionButtons.innerHTML = '';
    htmlVariants.forEach((h) => {
      const v = parseVersionFromPath(h);
      const btn = document.createElement('button');
      btn.className = 'version-btn' + (h === selected ? ' active' : '');
      btn.type = 'button';
      btn.textContent = `v${v}`;
      btn.addEventListener('click', async () => {
        if (selectedHtmlPath === h) return;
        selectedHtmlPath = h;
        Array.from(els.htmlVersionButtons.children).forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        els.openHtmlNewTab.href = selectedHtmlPath;
        cache.html = await (await fetch(selectedHtmlPath)).text().catch(() => '');
        els.htmlFrame.src = selectedHtmlPath;
        const vNow = parseVersionFromPath(selectedHtmlPath);
        els.currentTitle.textContent = `${currentContent.title} ${vNow>1?`(v${vNow})`:''}`;
        updateViewLabels();
        buildPreferenceOptions(collectVariants(currentContent).htmlVariants, !!selectedMdPath);
      });
      els.htmlVersionButtons.appendChild(btn);
    });
  }

  function updateViewLabels() {
    const vNow = selectedHtmlPath ? parseVersionFromPath(selectedHtmlPath) : 1;
    if (els.currentVersionLabel) els.currentVersionLabel.textContent = `Viewing v${vNow}`;
    if (els.currentViewNote) els.currentViewNote.textContent = `Currently viewing: Web View v${vNow}`;
  }

  function buildPreferenceOptions(htmlVariants, hasMd) {
    if (!els.preferenceSelect) return;
    els.preferenceSelect.innerHTML = '';
    if (hasMd) {
      const optMd = document.createElement('option');
      optMd.value = 'markdown'; optMd.textContent = 'Raw Text';
      els.preferenceSelect.appendChild(optMd);
    } else {
      const optMdDis = document.createElement('option');
      optMdDis.value = ''; optMdDis.textContent = 'Raw Text (not available)'; optMdDis.disabled = true;
      els.preferenceSelect.appendChild(optMdDis);
    }
    htmlVariants.forEach(h => {
      const v = parseVersionFromPath(h);
      const opt = document.createElement('option');
      opt.value = `html_v${v}`; opt.textContent = `Web View v${v}`;
      if (h === selectedHtmlPath) opt.selected = true;
      els.preferenceSelect.appendChild(opt);
    });
  }

  function updateEmailHint({ title, payload }) {
    const to = 'hello@nextclass.ca';
    const subj = encodeURIComponent(`NextClass Feedback: ${title || (currentContent?.title || '')}`);
    let body = 'Please attach the downloaded JSON feedback file to this email. Thank you!\n\n';
    try {
      const p = payload || null;
      if (p) {
        const lines = [
          `Teacher: ${p.teacher.name}`,
          `Grade: ${p.teacher.grade}${p.teacher.school?` (School: ${p.teacher.school})`:''}`,
          `Content: ${p.content.title} (id: ${p.content.id})`,
          `HTML: ${p.content.htmlPath} (v${p.content.htmlVersion})`,
          `Preferred: ${p.preferred || '—'}`,
          `Functionality: ${p.ratings.functionality}/10`,
          `Output: ${p.ratings.outputQuality}/10`,
          `Accuracy: ${p.ratings.accuracy}/10`,
          `Approved: ${p.approved ? 'Yes' : 'No'}`,
          '',
          'Comments:',
          p.comments,
          '',
          '--- Raw JSON (copy/paste below, also attach the file) ---',
        ];
        const jsonStr = JSON.stringify(p, null, 2);
        const trimmed = jsonStr.length > 2000 ? jsonStr.slice(0, 2000) + '\n... (truncated) ...' : jsonStr;
        body += lines.join('\n') + '\n' + trimmed;
      }
    } catch {}
    const href = `mailto:${to}?subject=${subj}&body=${encodeURIComponent(body)}`;
    if (els.emailHint) els.emailHint.href = href;
  }
})();
