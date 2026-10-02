/**
 * Chronicles &bull; Minimalist Leather Journal (Moleskine Edition)
 * Application Logic: Calendar Engine, Ruled Notebook Persistence, Audio & Navigation
 */

(function () {
  'use strict';

  // Storage Keys & State
  const STORAGE_KEY_ENTRIES = 'skeuomorphic_diary_entries_v1';

  let currentDate = new Date();
  let calendarViewingMonth = new Date();
  let soundEnabled = true;
  let activeInk = 'ink-blue';
  let activeFont = 'font-kalam';
  let activeStamp = { symbol: '☀️', caption: 'Radiant', id: 'stamp-joy' };
  let saveTimer = null;
  let audioCtx = null;
  let currentView = 'calendar'; // 'calendar' or 'notes'

  // DOM Elements - Top Header
  const navBtnCalendar = document.getElementById('nav-btn-calendar');
  const navBtnNotes = document.getElementById('nav-btn-notes');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const soundIconSymbol = document.getElementById('sound-icon-symbol');
  const btnTodayQuick = document.getElementById('btn-today-quick');
  const btnExportEntry = document.getElementById('btn-export-entry');
  const ribbonBookmark = document.getElementById('ribbon-bookmark');

  // DOM Elements - Cards
  const calendarCard = document.getElementById('calendar-card');
  const notebookCard = document.getElementById('notebook-card');

  // DOM Elements - Calendar
  const calPrevMonth = document.getElementById('cal-prev-month');
  const calNextMonth = document.getElementById('cal-next-month');
  const calMonthTitle = document.getElementById('cal-month-title');
  const calTodayBtn = document.getElementById('cal-today-btn');
  const calendarDaysGrid = document.getElementById('calendar-days-grid');
  const monthlyEntriesList = document.getElementById('monthly-entries-list');
  const monthlyCountBadge = document.getElementById('monthly-count-badge');

  // DOM Elements - Notebook
  const btnBackToCalendar = document.getElementById('btn-back-to-calendar');
  const btnPrevDay = document.getElementById('btn-prev-day');
  const btnNextDay = document.getElementById('btn-next-day');
  const entryWeekdayTitle = document.getElementById('entry-weekday-title');
  const entryDateSubtitle = document.getElementById('entry-date-subtitle');
  const moodBadgeSymbol = document.getElementById('mood-badge-symbol');
  const moodBadgeLabel = document.getElementById('mood-badge-label');
  const inkDotsPicker = document.getElementById('ink-dots-picker');
  const selectFontStyle = document.getElementById('select-font-style');
  const stampPillDock = document.getElementById('stamp-pill-dock');
  const noteTitleInput = document.getElementById('note-title-input');
  const noteBodyTextarea = document.getElementById('note-body-textarea');
  const saveDot = document.getElementById('save-dot');
  const saveStatusLabel = document.getElementById('save-status-label');
  const wordCountDisplay = document.getElementById('word-count-display');
  const btnErasePage = document.getElementById('btn-erase-page');

  // DOM Elements - Export Modal
  const exportModal = document.getElementById('export-modal');
  const modalXBtn = document.getElementById('modal-x-btn');
  const modalDateText = document.getElementById('modal-date-text');
  const modalTranscriptPreview = document.getElementById('modal-transcript-preview');
  const btnCopyClip = document.getElementById('btn-copy-clip');
  const btnPrintEntry = document.getElementById('btn-print-entry');
  const btnDownloadTxt = document.getElementById('btn-download-txt');

  // Load Entries from LocalStorage
  let entries = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENTRIES);
    if (raw) entries = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse entries', e);
  }

  // Pre-seed welcoming entry for today if new
  const todayKey = formatDateKey(new Date());
  if (!entries[todayKey]) {
    entries[todayKey] = {
      title: "Golden Hour Thoughts",
      body: "Welcome to your personal journal.\n\nSoft cream paper, ruled in subtle blue. Here you can record your memories, thoughts, and reflections with the calm tactile feel of an authentic Moleskine.\n\nTap the 'Calendar' button at the top to explore other days, switch your ink color, or choose a mood stamp anytime.",
      stamp: { symbol: '☀️', caption: 'Radiant', id: 'stamp-joy' },
      ink: 'ink-blue',
      font: 'font-kalam',
      updatedAt: new Date().toISOString()
    };
    saveAllEntries();
  }

  // -------------------------------------------------------------
  // AUDIO ENGINE (Web Audio API)
  // -------------------------------------------------------------
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playPageTurnSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const duration = 0.16;
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.sin((i / bufferSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * envelope * 0.22;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(850, audioCtx.currentTime);
      filter.Q.setValueAtTime(1.2, audioCtx.currentTime);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.28, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
    } catch (e) {}
  }

  let lastPenTime = 0;
  function playPenSound() {
    if (!soundEnabled) return;
    const now = performance.now();
    if (now - lastPenTime < 90) return;
    lastPenTime = now;

    initAudio();
    if (!audioCtx) return;

    try {
      const duration = 0.04;
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.12;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2400, audioCtx.currentTime);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.07, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
    } catch (e) {}
  }

  function playClickSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.07);
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // DATE FORMATTING HELPERS
  // -------------------------------------------------------------
  function formatDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getMonthName(monthIndex) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }

  function getWeekdayName(dayIndex) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex];
  }

  // -------------------------------------------------------------
  // NAVIGATION BETWEEN CALENDAR & NOTEBOOK
  // -------------------------------------------------------------
  function switchView(viewName) {
    currentView = viewName;

    if (viewName === 'calendar') {
      calendarCard.classList.remove('hidden');
      notebookCard.classList.add('hidden');
      navBtnCalendar.classList.add('active');
      navBtnNotes.classList.remove('active');
      navBtnCalendar.setAttribute('aria-selected', 'true');
      navBtnNotes.setAttribute('aria-selected', 'false');
      renderCalendar();
    } else {
      calendarCard.classList.add('hidden');
      notebookCard.classList.remove('hidden');
      navBtnCalendar.classList.remove('active');
      navBtnNotes.classList.add('active');
      navBtnCalendar.setAttribute('aria-selected', 'false');
      navBtnNotes.setAttribute('aria-selected', 'true');
      loadActiveDateEntry();
    }
    playPageTurnSound();
  }

  // -------------------------------------------------------------
  // CALENDAR ENGINE
  // -------------------------------------------------------------
  function renderCalendar() {
    calendarDaysGrid.innerHTML = '';

    const year = calendarViewingMonth.getFullYear();
    const month = calendarViewingMonth.getMonth();

    calMonthTitle.textContent = `${getMonthName(month).toUpperCase()} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    const isCurrentRealMonth = today.getFullYear() === year && today.getMonth() === month;
    const isSelectedMonth = currentDate.getFullYear() === year && currentDate.getMonth() === month;

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'day-cell other-month';
      cell.textContent = dayNum;
      calendarDaysGrid.appendChild(cell);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('button');
      cell.className = 'day-cell';
      cell.textContent = day;
      cell.setAttribute('aria-label', `${getMonthName(month)} ${day}, ${year}`);

      const cellDateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Check if day has an existing diary entry
      if (entries[cellDateKey] && (entries[cellDateKey].title || entries[cellDateKey].body)) {
        cell.classList.add('has-note');
      }

      // Check if Today
      if (isCurrentRealMonth && today.getDate() === day) {
        cell.classList.add('is-today');
      }

      // Check if Selected Date
      if (isSelectedMonth && currentDate.getDate() === day) {
        cell.classList.add('is-selected');
      }

      // Clicking any day opens the notebook for that date!
      cell.addEventListener('click', () => {
        selectDate(new Date(year, month, day));
        switchView('notes');
      });

      calendarDaysGrid.appendChild(cell);
    }

    // Trailing days
    const totalCells = firstDayIndex + daysInMonth;
    const trailing = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= trailing; day++) {
      const cell = document.createElement('div');
      cell.className = 'day-cell other-month';
      cell.textContent = day;
      calendarDaysGrid.appendChild(cell);
    }

    renderMonthlyDrawer();
  }

  function renderMonthlyDrawer() {
    monthlyEntriesList.innerHTML = '';
    const year = calendarViewingMonth.getFullYear();
    const month = calendarViewingMonth.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    const matchingKeys = Object.keys(entries)
      .filter(k => k.startsWith(prefix) && (entries[k].title || entries[k].body))
      .sort();

    monthlyCountBadge.textContent = `${matchingKeys.length} entry${matchingKeys.length === 1 ? '' : 's'}`;

    if (matchingKeys.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-month-msg';
      li.textContent = 'No recorded entries this month yet. Tap any day above to start writing.';
      monthlyEntriesList.appendChild(li);
      return;
    }

    matchingKeys.forEach(dateKey => {
      const item = entries[dateKey];
      const [y, m, d] = dateKey.split('-').map(Number);
      const li = document.createElement('li');
      li.className = 'month-entry-item';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'entry-item-date';
      dateSpan.textContent = `${getMonthName(m - 1).slice(0, 3)} ${d}`;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'entry-item-title';
      titleSpan.textContent = item.title || (item.body ? item.body.slice(0, 24) + '...' : 'Journal Entry');

      li.appendChild(dateSpan);
      li.appendChild(titleSpan);

      li.addEventListener('click', () => {
        selectDate(new Date(y, m - 1, d));
        switchView('notes');
      });

      monthlyEntriesList.appendChild(li);
    });
  }

  // -------------------------------------------------------------
  // NOTEBOOK ENGINE & PERSISTENCE
  // -------------------------------------------------------------
  function selectDate(newDate) {
    saveCurrentEntryImmediate();
    currentDate = new Date(newDate);
    calendarViewingMonth = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
    loadActiveDateEntry();
  }

  function loadActiveDateEntry() {
    const key = formatDateKey(currentDate);

    entryWeekdayTitle.textContent = getWeekdayName(currentDate.getDay());
    entryDateSubtitle.textContent = `${getMonthName(currentDate.getMonth())} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;

    const entry = entries[key] || {
      title: '',
      body: '',
      stamp: activeStamp,
      ink: activeInk,
      font: activeFont
    };

    noteTitleInput.value = entry.title || '';
    noteBodyTextarea.value = entry.body || '';

    if (entry.ink) setInk(entry.ink, false);
    if (entry.font) setFont(entry.font, false);
    if (entry.stamp) setStamp(entry.stamp, false);

    updateWordCount();
    setSaveStatus(true);
  }

  function saveCurrentEntryImmediate() {
    const key = formatDateKey(currentDate);
    const title = noteTitleInput.value.trim();
    const body = noteBodyTextarea.value.trim();

    if (!title && !body) {
      if (entries[key]) {
        delete entries[key];
        saveAllEntries();
      }
      return;
    }

    entries[key] = {
      title: noteTitleInput.value,
      body: noteBodyTextarea.value,
      stamp: activeStamp,
      ink: activeInk,
      font: activeFont,
      updatedAt: new Date().toISOString()
    };

    saveAllEntries();
    setSaveStatus(true);
  }

  function scheduleAutoSave() {
    setSaveStatus(false);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveCurrentEntryImmediate();
      renderCalendar();
    }, 450);
  }

  function saveAllEntries() {
    try {
      localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
    } catch (e) {
      console.warn('LocalStorage limit reached', e);
    }
  }

  function setSaveStatus(isSaved) {
    if (isSaved) {
      saveStatusLabel.textContent = 'Saved • Ink Dried';
      saveDot.classList.remove('saving');
    } else {
      saveStatusLabel.textContent = 'Writing • Saving...';
      saveDot.classList.add('saving');
    }
  }

  function updateWordCount() {
    const text = noteBodyTextarea.value.trim();
    const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
    wordCountDisplay.textContent = `${count} word${count === 1 ? '' : 's'}`;
  }

  // -------------------------------------------------------------
  // INK, FONT, AND MOOD STAMPS
  // -------------------------------------------------------------
  function setInk(inkClass, triggerSave = true) {
    activeInk = inkClass;

    const allInks = ['ink-blue', 'ink-black', 'ink-sepia', 'ink-crimson', 'ink-sage', 'ink-pencil'];
    allInks.forEach(cls => {
      noteTitleInput.classList.remove(cls);
      noteBodyTextarea.classList.remove(cls);
    });
    noteTitleInput.classList.add(inkClass);
    noteBodyTextarea.classList.add(inkClass);

    document.querySelectorAll('.ink-dot').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ink === inkClass);
    });

    if (triggerSave) scheduleAutoSave();
  }

  function setFont(fontClass, triggerSave = true) {
    activeFont = fontClass;

    const allFonts = ['font-kalam', 'font-caveat', 'font-cormorant', 'font-inter'];
    allFonts.forEach(cls => {
      noteTitleInput.classList.remove(cls);
      noteBodyTextarea.classList.remove(cls);
    });
    noteTitleInput.classList.add(fontClass);
    noteBodyTextarea.classList.add(fontClass);

    if (selectFontStyle) selectFontStyle.value = fontClass;
    if (triggerSave) scheduleAutoSave();
  }

  function setStamp(stampObj, triggerSave = true) {
    activeStamp = stampObj;
    moodBadgeSymbol.textContent = stampObj.symbol;
    moodBadgeLabel.textContent = stampObj.caption;

    document.querySelectorAll('.stamp-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stamp === stampObj.id);
    });

    if (triggerSave) scheduleAutoSave();
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS
  // -------------------------------------------------------------
  // Header Tabs
  navBtnCalendar.addEventListener('click', () => switchView('calendar'));
  navBtnNotes.addEventListener('click', () => switchView('notes'));

  // Prominent Back to Calendar button inside note!
  btnBackToCalendar.addEventListener('click', () => {
    saveCurrentEntryImmediate();
    switchView('calendar');
  });

  // Calendar Steppers
  calPrevMonth.addEventListener('click', () => {
    playClickSound();
    calendarViewingMonth.setMonth(calendarViewingMonth.getMonth() - 1);
    renderCalendar();
  });

  calNextMonth.addEventListener('click', () => {
    playClickSound();
    calendarViewingMonth.setMonth(calendarViewingMonth.getMonth() + 1);
    renderCalendar();
  });

  // Sound Toggle
  btnSoundToggle.addEventListener('click', () => {
    initAudio();
    soundEnabled = !soundEnabled;
    soundIconSymbol.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) playClickSound();
  });

  // Jump to Today
  function jumpToToday() {
    playClickSound();
    selectDate(new Date());
    switchView('notes');
  }
  btnTodayQuick.addEventListener('click', jumpToToday);
  calTodayBtn.addEventListener('click', jumpToToday);
  ribbonBookmark.addEventListener('click', jumpToToday);

  // Day Steppers inside note
  function stepDay(offset) {
    playPageTurnSound();
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset);
    selectDate(d);
  }
  btnPrevDay.addEventListener('click', () => stepDay(-1));
  btnNextDay.addEventListener('click', () => stepDay(1));

  // Typing & Autosave
  noteBodyTextarea.addEventListener('input', () => {
    playPenSound();
    updateWordCount();
    scheduleAutoSave();
  });

  noteTitleInput.addEventListener('input', () => {
    playPenSound();
    scheduleAutoSave();
  });

  // Ink Dot Click
  if (inkDotsPicker) {
    inkDotsPicker.addEventListener('click', (e) => {
      const dot = e.target.closest('.ink-dot');
      if (!dot) return;
      playClickSound();
      setInk(dot.dataset.ink);
    });
  }

  // Font Style Select
  if (selectFontStyle) {
    selectFontStyle.addEventListener('change', () => {
      playClickSound();
      setFont(selectFontStyle.value);
    });
  }

  // Mood Stamps
  const stampMap = {
    'stamp-joy': { symbol: '☀️', caption: 'Radiant', id: 'stamp-joy' },
    'stamp-coffee': { symbol: '☕', caption: 'Peaceful', id: 'stamp-coffee' },
    'stamp-rain': { symbol: '🌧️', caption: 'Reflective', id: 'stamp-rain' },
    'stamp-star': { symbol: '⭐', caption: 'Inspired', id: 'stamp-star' },
    'stamp-heart': { symbol: '❤️', caption: 'Beloved', id: 'stamp-heart' },
    'stamp-leaf': { symbol: '🌿', caption: 'Grounded', id: 'stamp-leaf' }
  };

  if (stampPillDock) {
    stampPillDock.addEventListener('click', (e) => {
      const btn = e.target.closest('.stamp-pill-btn');
      if (!btn) return;
      playClickSound();
      const obj = stampMap[btn.dataset.stamp];
      if (obj) setStamp(obj);
    });
  }

  // Erase Page
  btnErasePage.addEventListener('click', () => {
    if (confirm('Erase this manuscript page? The ink cannot be recovered once removed.')) {
      playPageTurnSound();
      noteTitleInput.value = '';
      noteBodyTextarea.value = '';
      updateWordCount();
      saveCurrentEntryImmediate();
      renderCalendar();
    }
  });

  // Export Modal
  btnExportEntry.addEventListener('click', () => {
    playClickSound();
    const dateStr = `${getMonthName(currentDate.getMonth())} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    modalDateText.textContent = dateStr;

    const title = noteTitleInput.value.trim() || 'Untitled Manuscript';
    const body = noteBodyTextarea.value.trim() || '(Blank page)';
    const stamp = `${activeStamp.symbol} ${activeStamp.caption}`;

    modalTranscriptPreview.textContent = `${title.toUpperCase()}\n${dateStr} • Mood: ${stamp}\n\n${body}`;
    exportModal.style.display = 'flex';
  });

  modalXBtn.addEventListener('click', () => {
    playClickSound();
    exportModal.style.display = 'none';
  });

  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) exportModal.style.display = 'none';
  });

  btnCopyClip.addEventListener('click', () => {
    navigator.clipboard.writeText(modalTranscriptPreview.textContent).then(() => {
      playClickSound();
      alert('Manuscript copied to your clipboard!');
    });
  });

  btnPrintEntry.addEventListener('click', () => window.print());

  btnDownloadTxt.addEventListener('click', () => {
    playClickSound();
    const key = formatDateKey(currentDate);
    const content = modalTranscriptPreview.textContent;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diary_entry_${key}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Initial Load
  selectDate(currentDate);
  switchView('calendar');

})();
