/**
 * Skeuomorphic Leatherbound Journal & Calendar Diary
 * Audio Synthesizer, Calendar Engine, Ruled Notebook Persistence & Mobile Drawer
 */

(function () {
  'use strict';

  // State Management
  const STORAGE_KEY_ENTRIES = 'skeuomorphic_diary_entries_v1';

  let currentDate = new Date(); // Currently selected date in diary
  let calendarViewingMonth = new Date(); // Currently displayed month in calendar
  let soundEnabled = true;
  let activeInk = 'ink-blue';
  let activeFont = 'font-kalam';
  let activeStamp = { symbol: '☀️', caption: 'Radiant', id: 'stamp-joy' };
  let saveDebounceTimer = null;
  let audioCtx = null;
  let activeMobileTab = 'calendar'; // 'calendar' or 'notes'

  // Cached DOM Elements
  const calendarGrid = document.getElementById('calendar-days-grid');
  const currentMonthDisplay = document.getElementById('current-month-display');
  const prevMonthBtn = document.getElementById('prev-month-btn');
  const nextMonthBtn = document.getElementById('next-month-btn');

  const entryWeekday = document.getElementById('entry-weekday');
  const entryFullDate = document.getElementById('entry-full-date');
  const entryTitleInput = document.getElementById('entry-title-input');
  const entryBodyTextarea = document.getElementById('entry-body-textarea');
  const wordCounter = document.getElementById('word-counter');
  const saveStatusText = document.getElementById('save-status-text');
  const saveBlot = document.getElementById('save-blot');
  const clearEntryBtn = document.getElementById('clear-entry-btn');

  const entriesMiniList = document.getElementById('entries-mini-list');
  const recentTagsList = document.getElementById('recent-tags-list');
  
  // Desktop Sidebar Elements
  const penDock = document.getElementById('pen-dock');
  const fontSelect = document.getElementById('font-select');
  const stampButtons = document.getElementById('stamp-buttons');
  const activeStampSymbol = document.getElementById('active-stamp-symbol');
  const stampInkCaption = document.getElementById('stamp-ink-caption');

  // Mobile Bottom Drawer Elements
  const mobileDrawerContainer = document.getElementById('mobile-drawer-container');
  const mobileToolsPanel = document.getElementById('mobile-tools-panel');
  const mobileToolsToggleBtn = document.getElementById('mobile-tools-toggle-btn');
  const drawerDragHandle = document.getElementById('drawer-drag-handle');
  const mobilePensDock = document.getElementById('mobile-pens-dock');
  const mobileFontSelect = document.getElementById('mobile-font-select');
  const mobileStampsDock = document.getElementById('mobile-stamps-dock');
  const mobileTabCalendar = document.getElementById('mobile-tab-calendar');
  const mobileTabNotes = document.getElementById('mobile-tab-notes');
  const mobilePrevDayBtn = document.getElementById('mobile-prev-day-btn');
  const mobileTodayBtn = document.getElementById('mobile-today-btn');
  const mobileNextDayBtn = document.getElementById('mobile-next-day-btn');

  // Header and Navigation Controls
  const toggleSoundBtn = document.getElementById('toggle-sound-btn');
  const soundStatus = document.getElementById('sound-status');
  const soundIcon = document.getElementById('sound-icon');
  const todayBtn = document.getElementById('today-btn');
  const prevDayBtn = document.getElementById('prev-day-btn');
  const nextDayBtn = document.getElementById('next-day-btn');
  const satinRibbon = document.getElementById('satin-ribbon');

  const leftPgNum = document.getElementById('left-pg-num');
  const rightPgNum = document.getElementById('right-pg-num');

  // Export Modal Elements
  const exportBtn = document.getElementById('export-btn');
  const exportModal = document.getElementById('export-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalEntryDate = document.getElementById('modal-entry-date');
  const modalPreviewText = document.getElementById('modal-preview-text');
  const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
  const printEntryBtn = document.getElementById('print-entry-btn');
  const downloadTxtBtn = document.getElementById('download-txt-btn');

  const leftPage = document.getElementById('left-page');
  const rightPage = document.getElementById('right-page');

  // Load Saved Entries from LocalStorage
  let entries = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENTRIES);
    if (raw) entries = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse entries from storage', e);
  }

  // Pre-seed a welcoming entry for today if empty
  const todayKey = formatDateKey(new Date());
  if (!entries[todayKey]) {
    entries[todayKey] = {
      title: "Autumn Reflections & Musings",
      body: "October brings the golden afternoon light across the wooden desk.\n\nHere lies my personal sanctuary—bound in rich saddle leather, with pages ruled in gentle blue. The calendar whispers of days gone by and hours yet to unfold.\n\nEvery stroke of the pen preserves a transient thought before it fades like autumn mist. Click any date on the left to begin your own chronicle.",
      stamp: { symbol: '☀️', caption: 'Radiant', id: 'stamp-joy' },
      ink: 'ink-blue',
      font: 'font-kalam',
      updatedAt: new Date().toISOString()
    };
    saveAllEntries();
  }

  // -------------------------------------------------------------
  // AUDIO SYNTHESIZER (Web Audio API - Vintage Tactile Sound)
  // -------------------------------------------------------------
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
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
      const bufferSize = audioCtx.sampleRate * 0.18;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const envelope = Math.sin((i / bufferSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * envelope * 0.25;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, audioCtx.currentTime);
      filter.Q.setValueAtTime(1.2, audioCtx.currentTime);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
    } catch (e) {}
  }

  let lastPenSoundTime = 0;
  function playPenScratchSound() {
    if (!soundEnabled) return;
    const now = performance.now();
    if (now - lastPenSoundTime < 85) return;
    lastPenSoundTime = now;

    initAudio();
    if (!audioCtx) return;

    try {
      const duration = 0.045;
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2200, audioCtx.currentTime);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
    } catch (e) {}
  }

  function playBrassClickSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);
    } catch (e) {}
  }

  function playStampThudSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, audioCtx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.13);
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // HELPER FORMATTING & DATE CALCULATIONS
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

  function toRomanNumeral(num) {
    const lookup = {
      M: 1000, CM: 900, D: 500, CD: 400,
      C: 100, XC: 90, L: 50, XL: 40,
      X: 10, IX: 9, V: 5, IV: 4, I: 1
    };
    let roman = '';
    for (let i in lookup) {
      while (num >= lookup[i]) {
        roman += i;
        num -= lookup[i];
      }
    }
    return roman || 'I';
  }

  function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  // -------------------------------------------------------------
  // CALENDAR LOGIC
  // -------------------------------------------------------------
  function renderCalendar() {
    calendarGrid.innerHTML = '';

    const year = calendarViewingMonth.getFullYear();
    const month = calendarViewingMonth.getMonth();

    currentMonthDisplay.textContent = `${getMonthName(month).toUpperCase()} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    const isThisCurrentRealMonth = today.getFullYear() === year && today.getMonth() === month;
    const isSelectedMonth = currentDate.getFullYear() === year && currentDate.getMonth() === month;

    // Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.textContent = dayNum;
      calendarGrid.appendChild(cell);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('button');
      cell.className = 'cal-day-cell';
      cell.textContent = day;
      cell.setAttribute('aria-label', `${getMonthName(month)} ${day}, ${year}`);

      const thisCellDateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      if (entries[thisCellDateKey] && (entries[thisCellDateKey].body || entries[thisCellDateKey].title)) {
        cell.classList.add('has-entry');
      }

      if (isThisCurrentRealMonth && today.getDate() === day) {
        cell.classList.add('today');
      }

      if (isSelectedMonth && currentDate.getDate() === day) {
        cell.classList.add('selected');
      }

      cell.addEventListener('click', () => {
        selectDate(new Date(year, month, day));
      });

      calendarGrid.appendChild(cell);
    }

    // Trailing days of next month
    const totalCells = (firstDayIndex + daysInMonth);
    const trailingCount = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= trailingCount; day++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.textContent = day;
      calendarGrid.appendChild(cell);
    }

    renderMonthlyMemoriesList();
  }

  function renderMonthlyMemoriesList() {
    entriesMiniList.innerHTML = '';
    const year = calendarViewingMonth.getFullYear();
    const month = calendarViewingMonth.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    const matchingKeys = Object.keys(entries)
      .filter(k => k.startsWith(prefix) && (entries[k].title || entries[k].body))
      .sort();

    if (matchingKeys.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'empty-entries';
      emptyLi.textContent = 'No recorded entries this month yet. Click any day above to start writing.';
      entriesMiniList.appendChild(emptyLi);
      return;
    }

    matchingKeys.forEach(dateKey => {
      const item = entries[dateKey];
      const [y, m, d] = dateKey.split('-').map(Number);
      const li = document.createElement('li');
      li.className = 'entry-mini-item';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'entry-mini-date';
      dateSpan.textContent = `${getMonthName(m - 1).slice(0, 3)} ${d}`;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'entry-mini-title';
      titleSpan.textContent = item.title || (item.body ? item.body.slice(0, 20) + '...' : 'Journal Entry');

      li.appendChild(dateSpan);
      li.appendChild(titleSpan);

      li.addEventListener('click', () => {
        selectDate(new Date(y, m - 1, d));
      });

      entriesMiniList.appendChild(li);
    });
  }

  // -------------------------------------------------------------
  // SELECT DATE & LOAD RULED NOTEBOOK PAGE
  // -------------------------------------------------------------
  function selectDate(newDate) {
    saveCurrentEntryImmediate();

    currentDate = new Date(newDate);
    calendarViewingMonth = new Date(newDate.getFullYear(), newDate.getMonth(), 1);

    playPageTurnSound();
    renderCalendar();
    loadActiveDateEntry();
    updatePageNumbers();
    updateRecentTags();

    // On mobile screens, automatically transition to the Lined Notebook!
    if (window.innerWidth <= 880) {
      setMobileTab('notes');
    }
  }

  function loadActiveDateEntry() {
    const key = formatDateKey(currentDate);

    entryWeekday.textContent = getWeekdayName(currentDate.getDay());
    entryFullDate.textContent = `${getMonthName(currentDate.getMonth())} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;

    const entry = entries[key] || {
      title: '',
      body: '',
      stamp: activeStamp,
      ink: activeInk,
      font: activeFont
    };

    entryTitleInput.value = entry.title || '';
    entryBodyTextarea.value = entry.body || '';

    if (entry.ink) setInk(entry.ink, false);
    if (entry.font) setFont(entry.font, false);
    if (entry.stamp) setStamp(entry.stamp, false);

    updateWordCount();
    setSaveStatus(true);
  }

  function updatePageNumbers() {
    const dayOfYear = getDayOfYear(currentDate);
    const leftPg = dayOfYear * 2 - 1;
    const rightPg = dayOfYear * 2;
    leftPgNum.textContent = `Page ${toRomanNumeral(leftPg)}`;
    rightPgNum.textContent = `Page ${toRomanNumeral(rightPg)}`;
  }

  // -------------------------------------------------------------
  // PERSISTENCE & AUTO-SAVE
  // -------------------------------------------------------------
  function saveCurrentEntryImmediate() {
    const key = formatDateKey(currentDate);
    const title = entryTitleInput.value.trim();
    const body = entryBodyTextarea.value.trim();

    if (!title && !body) {
      if (entries[key]) {
        delete entries[key];
        saveAllEntries();
      }
      return;
    }

    entries[key] = {
      title: entryTitleInput.value,
      body: entryBodyTextarea.value,
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
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveCurrentEntryImmediate();
      renderCalendar();
      renderMonthlyMemoriesList();
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
      saveStatusText.textContent = 'Ink Dried • Saved';
      saveBlot.classList.remove('saving');
    } else {
      saveStatusText.textContent = 'Wet Ink • Writing...';
      saveBlot.classList.add('saving');
    }
  }

  function updateWordCount() {
    const text = entryBodyTextarea.value.trim();
    const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
    wordCounter.textContent = `${count} word${count === 1 ? '' : 's'}`;
  }

  function updateRecentTags() {
    if (!recentTagsList) return;
    recentTagsList.innerHTML = '';
    const sortedKeys = Object.keys(entries)
      .filter(k => entries[k] && (entries[k].title || entries[k].body))
      .sort((a, b) => (entries[b].updatedAt || '').localeCompare(entries[a].updatedAt || ''))
      .slice(0, 4);

    if (sortedKeys.length === 0) {
      const p = document.createElement('div');
      p.className = 'empty-entries';
      p.textContent = 'Recent memories will appear here.';
      recentTagsList.appendChild(p);
      return;
    }

    sortedKeys.forEach(k => {
      const [y, m, d] = k.split('-').map(Number);
      const tag = document.createElement('div');
      tag.className = 'recent-tag';

      const tagDate = document.createElement('strong');
      tagDate.textContent = `${getMonthName(m - 1).slice(0, 3)} ${d}`;

      const tagTitle = document.createElement('span');
      tagTitle.textContent = entries[k].title ? entries[k].title.slice(0, 14) + '...' : 'Entry';

      tag.appendChild(tagDate);
      tag.appendChild(tagTitle);

      tag.addEventListener('click', () => {
        selectDate(new Date(y, m - 1, d));
      });

      recentTagsList.appendChild(tag);
    });
  }

  // -------------------------------------------------------------
  // SYNCHRONIZED INK, FONT, AND MOOD STAMPS (DESKTOP & MOBILE)
  // -------------------------------------------------------------
  function setInk(inkClass, triggerSave = true) {
    activeInk = inkClass;

    const allInks = ['ink-blue', 'ink-black', 'ink-sepia', 'ink-crimson', 'ink-pencil'];
    allInks.forEach(cls => {
      entryTitleInput.classList.remove(cls);
      entryBodyTextarea.classList.remove(cls);
    });
    entryTitleInput.classList.add(inkClass);
    entryBodyTextarea.classList.add(inkClass);

    // Sync Desktop tray buttons
    document.querySelectorAll('.pen-tool').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ink === inkClass);
    });

    // Sync Mobile drawer dots
    document.querySelectorAll('.mobile-pen-dot').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ink === inkClass);
    });

    if (triggerSave) scheduleAutoSave();
  }

  function setFont(fontClass, triggerSave = true) {
    activeFont = fontClass;

    const allFonts = ['font-kalam', 'font-caveat', 'font-spectral', 'font-courier'];
    allFonts.forEach(cls => {
      entryTitleInput.classList.remove(cls);
      entryBodyTextarea.classList.remove(cls);
    });
    entryTitleInput.classList.add(fontClass);
    entryBodyTextarea.classList.add(fontClass);

    if (fontSelect) fontSelect.value = fontClass;
    if (mobileFontSelect) mobileFontSelect.value = fontClass;

    if (triggerSave) scheduleAutoSave();
  }

  function setStamp(stampObj, triggerSave = true) {
    activeStamp = stampObj;
    activeStampSymbol.textContent = stampObj.symbol;
    stampInkCaption.textContent = stampObj.caption;

    // Sync Desktop stamp buttons
    document.querySelectorAll('.stamp-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stamp === stampObj.id);
    });

    // Sync Mobile stamp buttons
    document.querySelectorAll('.mobile-stamp-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stamp === stampObj.id);
    });

    if (triggerSave) scheduleAutoSave();
  }

  // -------------------------------------------------------------
  // MOBILE TABBED JOURNAL NAVIGATION & DRAWER
  // -------------------------------------------------------------
  function setMobileTab(tab) {
    activeMobileTab = tab;

    if (mobileTabCalendar && mobileTabNotes) {
      mobileTabCalendar.classList.toggle('active', tab === 'calendar');
      mobileTabNotes.classList.toggle('active', tab === 'notes');
    }

    if (window.innerWidth <= 880) {
      if (tab === 'calendar') {
        leftPage.classList.remove('mobile-hidden');
        rightPage.classList.add('mobile-hidden');
      } else {
        leftPage.classList.add('mobile-hidden');
        rightPage.classList.remove('mobile-hidden');
      }
    } else {
      // On wide desktop/laptops, always show both pages
      leftPage.classList.remove('mobile-hidden');
      rightPage.classList.remove('mobile-hidden');
    }
  }

  function toggleMobileToolsDrawer(forceClose = false) {
    if (!mobileToolsPanel) return;
    if (forceClose) {
      mobileToolsPanel.classList.remove('open');
    } else {
      playBrassClickSound();
      mobileToolsPanel.classList.toggle('open');
    }
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS
  // -------------------------------------------------------------
  // Calendar Navigation
  prevMonthBtn.addEventListener('click', () => {
    playBrassClickSound();
    calendarViewingMonth.setMonth(calendarViewingMonth.getMonth() - 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener('click', () => {
    playBrassClickSound();
    calendarViewingMonth.setMonth(calendarViewingMonth.getMonth() + 1);
    renderCalendar();
  });

  // Sound Toggle
  toggleSoundBtn.addEventListener('click', () => {
    initAudio();
    soundEnabled = !soundEnabled;
    soundStatus.textContent = soundEnabled ? 'ON' : 'OFF';
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) playBrassClickSound();
  });

  // Jump to Today
  function jumpToToday() {
    playBrassClickSound();
    selectDate(new Date());
  }
  todayBtn.addEventListener('click', jumpToToday);
  satinRibbon.addEventListener('click', jumpToToday);
  if (mobileTodayBtn) mobileTodayBtn.addEventListener('click', jumpToToday);

  // Steppers (Yesterday / Tomorrow)
  function stepDay(offset) {
    playBrassClickSound();
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset);
    selectDate(d);
  }

  prevDayBtn.addEventListener('click', () => stepDay(-1));
  nextDayBtn.addEventListener('click', () => stepDay(1));
  if (mobilePrevDayBtn) mobilePrevDayBtn.addEventListener('click', () => stepDay(-1));
  if (mobileNextDayBtn) mobileNextDayBtn.addEventListener('click', () => stepDay(1));

  // Ruled Notebook Typing
  entryBodyTextarea.addEventListener('input', () => {
    playPenScratchSound();
    updateWordCount();
    scheduleAutoSave();
  });

  entryTitleInput.addEventListener('input', () => {
    playPenScratchSound();
    scheduleAutoSave();
  });

  // Pen Selection (Desktop & Mobile)
  if (penDock) {
    penDock.addEventListener('click', (e) => {
      const btn = e.target.closest('.pen-tool');
      if (!btn) return;
      playBrassClickSound();
      setInk(btn.dataset.ink);
    });
  }

  if (mobilePensDock) {
    mobilePensDock.addEventListener('click', (e) => {
      const btn = e.target.closest('.mobile-pen-dot');
      if (!btn) return;
      playBrassClickSound();
      setInk(btn.dataset.ink);
    });
  }

  // Font Selection (Desktop & Mobile)
  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      playBrassClickSound();
      setFont(fontSelect.value);
    });
  }
  if (mobileFontSelect) {
    mobileFontSelect.addEventListener('change', () => {
      playBrassClickSound();
      setFont(mobileFontSelect.value);
    });
  }

  // Mood Stamps (Desktop & Mobile)
  const stampDataMap = {
    'stamp-joy': { symbol: '☀️', caption: 'Radiant', id: 'stamp-joy' },
    'stamp-peace': { symbol: '☕', caption: 'Serene', id: 'stamp-peace' },
    'stamp-rain': { symbol: '🌧️', caption: 'Pensive', id: 'stamp-rain' },
    'stamp-star': { symbol: '⭐', caption: 'Inspired', id: 'stamp-star' },
    'stamp-heart': { symbol: '❤️', caption: 'Beloved', id: 'stamp-heart' },
    'stamp-leaf': { symbol: '🌿', caption: 'Grounded', id: 'stamp-leaf' }
  };

  function handleStampClick(e, selector) {
    const btn = e.target.closest(selector);
    if (!btn) return;
    playStampThudSound();
    const stampObj = stampDataMap[btn.dataset.stamp];
    if (stampObj) setStamp(stampObj);
  }

  if (stampButtons) {
    stampButtons.addEventListener('click', (e) => handleStampClick(e, '.stamp-btn'));
  }
  if (mobileStampsDock) {
    mobileStampsDock.addEventListener('click', (e) => handleStampClick(e, '.mobile-stamp-btn'));
  }

  // Mobile Bottom Bar Tabs & Drawer Toggle
  if (mobileTabCalendar) {
    mobileTabCalendar.addEventListener('click', () => {
      playBrassClickSound();
      toggleMobileToolsDrawer(true);
      setMobileTab('calendar');
    });
  }

  if (mobileTabNotes) {
    mobileTabNotes.addEventListener('click', () => {
      playBrassClickSound();
      toggleMobileToolsDrawer(true);
      setMobileTab('notes');
    });
  }

  if (mobileToolsToggleBtn) {
    mobileToolsToggleBtn.addEventListener('click', () => {
      toggleMobileToolsDrawer();
    });
  }

  if (drawerDragHandle) {
    drawerDragHandle.addEventListener('click', () => {
      toggleMobileToolsDrawer(true);
    });
  }

  // Erase Page Button
  clearEntryBtn.addEventListener('click', () => {
    if (confirm('Erase this manuscript page? The ink cannot be recovered once removed.')) {
      playPageTurnSound();
      entryTitleInput.value = '';
      entryBodyTextarea.value = '';
      updateWordCount();
      saveCurrentEntryImmediate();
      renderCalendar();
      renderMonthlyMemoriesList();
      updateRecentTags();
    }
  });

  // Export Modal
  exportBtn.addEventListener('click', () => {
    playBrassClickSound();
    const dateStr = `${getMonthName(currentDate.getMonth())} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    modalEntryDate.textContent = dateStr;

    const title = entryTitleInput.value.trim() || 'Untitled Manuscript';
    const body = entryBodyTextarea.value.trim() || '(Blank page)';
    const stamp = `${activeStamp.symbol} ${activeStamp.caption}`;

    modalPreviewText.textContent = `${title.toUpperCase()}\n${dateStr} • Mood: ${stamp}\n\n${body}`;
    exportModal.style.display = 'flex';
  });

  modalCloseBtn.addEventListener('click', () => {
    playBrassClickSound();
    exportModal.style.display = 'none';
  });

  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) {
      exportModal.style.display = 'none';
    }
  });

  copyClipboardBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(modalPreviewText.textContent).then(() => {
      playBrassClickSound();
      alert('Manuscript copied to your clipboard!');
    });
  });

  printEntryBtn.addEventListener('click', () => {
    window.print();
  });

  downloadTxtBtn.addEventListener('click', () => {
    playBrassClickSound();
    const key = formatDateKey(currentDate);
    const content = modalPreviewText.textContent;
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

  // Rotate quotes on Polaroid click
  const quotes = [
    '"Write what should not be forgotten."',
    '"A silent witness to fleeting days."',
    '"Thoughts carved in ink endure forever."',
    '"Quiet moments make the richest memories."'
  ];
  const photoQuote = document.getElementById('photo-quote');
  const polaroidFrame = document.getElementById('polaroid-frame');
  let quoteIdx = 0;
  if (polaroidFrame && photoQuote) {
    polaroidFrame.addEventListener('click', () => {
      playBrassClickSound();
      quoteIdx = (quoteIdx + 1) % quotes.length;
      photoQuote.textContent = quotes[quoteIdx];
    });
  }

  // Handle Window Resize (switch between dual-spread and tabbed view seamlessly)
  window.addEventListener('resize', () => {
    if (window.innerWidth > 880) {
      leftPage.classList.remove('mobile-hidden');
      rightPage.classList.remove('mobile-hidden');
      if (mobileToolsPanel) mobileToolsPanel.classList.remove('open');
    } else {
      setMobileTab(activeMobileTab);
    }
  });

  // Initialization
  selectDate(currentDate);
  updateRecentTags();
  if (window.innerWidth <= 880) {
    setMobileTab('calendar');
  }

})();
