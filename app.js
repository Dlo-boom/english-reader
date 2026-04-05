// English Reader - Main Application Logic

// State
let currentDoc = {
  title: 'Pasted Note',
  source: '—',
  type: 'TEXT',
  wordCount: 0,
  content: ''
};

let history = [];
let favorites = [];
let selectedText = '';
let toolbarPosition = { x: 0, y: 0 };
let isTranslationMode = false;
let deleteTargetId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  loadFavorites();
  checkDarkMode();
  loadCurrentDoc();

  // Pre-load voices for iOS (must be done after user interaction)
  if ('speechSynthesis' in window) {
    // Try to load voices early
    window.speechSynthesis.getVoices();
    // Also add a click listener to initialize on first tap
    document.body.addEventListener('click', function initVoices() {
      window.speechSynthesis.getVoices();
      document.body.removeEventListener('click', initVoices);
    }, { once: true });
  }
});

// Dark mode based on system preference
function checkDarkMode() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
  }
}

// Date/time helpers
function getNow() {
  const now = new Date();
  return now.toLocaleString('zh-HK', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace('/', '-').replace('/', '-');
}

function getDateOnly() {
  const now = new Date();
  return now.toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace('/', '-').replace('/', '-');
}

// Title generation
function generateTitle(text, filename = null) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean) {
    return clean.split(' ').slice(0, 4).join(' ');
  }
  return filename || 'Pasted Note';
}

// Word count
function countWords(text) {
  const clean = text.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).length;
}

// Storage
function loadHistory() {
  const raw = localStorage.getItem('reader-history');
  history = raw ? JSON.parse(raw) : [];
}

function saveHistory() {
  localStorage.setItem('reader-history', JSON.stringify(history.slice(0, 100)));
}

function loadFavorites() {
  const raw = localStorage.getItem('reader-favorites');
  favorites = raw ? JSON.parse(raw) : [];
}

function saveFavorites() {
  localStorage.setItem('reader-favorites', JSON.stringify(favorites));
}

function loadCurrentDoc() {
  const raw = localStorage.getItem('reader-current');
  if (raw) {
    const doc = JSON.parse(raw);
    currentDoc = {
      title: doc.title,
      source: doc.createdAt,
      type: doc.sourceType,
      wordCount: doc.wordCount,
      content: doc.content
    };
    updateUI();
  }
}

// File handling
function triggerFileUpload() {
  document.getElementById('fileInput').click();
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const ext = file.name.split('.').pop()?.toLowerCase();
  const now = getNow();

  let text = '';
  let type = 'TEXT';
  let title = file.name.replace(/\.[^/.]+$/, '');

  if (ext === 'txt') {
    text = await file.text();
    type = 'TXT';
  } else if (ext === 'pdf') {
    text = await extractPDFText(file);
    type = 'PDF';
  } else {
    showToast('Unsupported file type');
    return;
  }

  currentDoc = {
    title: generateTitle(text, title),
    source: now,
    type: type,
    wordCount: countWords(text),
    content: text
  };

  // Save to history
  const item = {
    id: crypto.randomUUID(),
    title: currentDoc.title,
    createdAt: currentDoc.source,
    sourceType: currentDoc.type,
    wordCount: currentDoc.wordCount,
    content: currentDoc.content
  };

  history.unshift(item);
  saveHistory();
  localStorage.setItem('reader-current', JSON.stringify(item));

  updateUI();
  showToast('File loaded successfully');
  event.target.value = '';
}

// PDF text extraction
async function extractPDFText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    showToast('Failed to read PDF');
    return '';
  }
}

// Paste modal
function showPasteModal() {
  document.getElementById('pasteModal').style.display = 'flex';
  document.getElementById('pasteInput').focus();
}

function hidePasteModal() {
  document.getElementById('pasteModal').style.display = 'none';
  document.getElementById('pasteInput').value = '';
}

function savePastedText() {
  const text = document.getElementById('pasteInput').value.trim();
  if (!text) {
    showToast('Please enter some text');
    return;
  }

  const now = getNow();
  const title = generateTitle(text);

  currentDoc = {
    title: title,
    source: now,
    type: 'TEXT',
    wordCount: countWords(text),
    content: text
  };

  // Save to history
  const item = {
    id: crypto.randomUUID(),
    title: currentDoc.title,
    createdAt: currentDoc.source,
    sourceType: currentDoc.type,
    wordCount: currentDoc.wordCount,
    content: currentDoc.content
  };

  history.unshift(item);
  saveHistory();
  localStorage.setItem('reader-current', JSON.stringify(item));

  updateUI();
  hidePasteModal();
  showToast('Text saved');
}

// Update UI
function updateUI() {
  document.getElementById('docTitle').textContent = currentDoc.title;
  document.getElementById('docSource').textContent = `${currentDoc.source} • ${currentDoc.type} • ${currentDoc.wordCount} words`;

  if (currentDoc.content) {
    document.getElementById('readingContent').innerHTML = '';
    renderContent(currentDoc.content);
  } else {
    document.getElementById('readingContent').innerHTML = '<p class="placeholder-text">Upload a file or paste text to start reading.</p>';
  }

  // Reset translation mode
  isTranslationMode = false;
  document.getElementById('translationSection').style.display = 'none';
}

function renderContent(text) {
  const container = document.getElementById('readingContent');
  container.innerHTML = '';
  container.textContent = text;
}

// Text selection
function handleTextSelect() {
  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';

    if (!text) {
      hideToolbar();
      return;
    }

    selectedText = text;

    // Get position
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();

    if (!rect) {
      hideToolbar();
      return;
    }

    const toolbar = document.getElementById('floatingToolbar');
    toolbar.style.display = 'flex';
    toolbar.style.left = rect.left + rect.width / 2 + 'px';
    toolbar.style.top = rect.top - 10 + 'px';

    // Adjust if toolbar would go off screen
    const toolbarRect = toolbar.getBoundingClientRect();
    if (toolbarRect.right > window.innerWidth - 20) {
      toolbar.style.left = (window.innerWidth - 20 - toolbarRect.width / 2) + 'px';
    }
    if (toolbarRect.top < 10) {
      toolbar.style.top = rect.bottom + 10 + 'px';
    }
  }, 10);
}

function hideToolbar() {
  document.getElementById('floatingToolbar').style.display = 'none';
  selectedText = '';
}

// Hide toolbar when clicking elsewhere
document.addEventListener('mousedown', (e) => {
  const toolbar = document.getElementById('floatingToolbar');
  if (!toolbar.contains(e.target)) {
    hideToolbar();
  }
});

document.addEventListener('touchstart', (e) => {
  const toolbar = document.getElementById('floatingToolbar');
  if (!toolbar.contains(e.target)) {
    hideToolbar();
  }
});

// Speech synthesis - iOS compatible, natural voice
function getVoices() {
  return new Promise((resolve) => {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      resolve(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        resolve(voices);
      };
    }
  });
}

// Find the most natural English voice
function findBestVoice(voices) {
  // Priority: Premium voices on iOS (Samantha, Daniel, etc.)
  // Then Microsoft natural voices
  // Then any English voice
  const preferredNames = [
    'Samantha',       // iOS Premium - natural
    'Daniel',        // iOS Premium
    'Ellen',         // iOS Premium
    'Moira',         // iOS
    'Karen',         // iOS
    'Tessa',         // iOS
    'Microsoft Zira', // Windows natural
    'Microsoft David', // Windows natural
    'Google US English',
    'en-US'
  ];

  for (const name of preferredNames) {
    const voice = voices.find(v =>
      v.name.includes(name) || v.name === name
    );
    if (voice) return voice;
  }

  // Fallback to any English voice
  return voices.find(v => v.lang.startsWith('en'));
}

async function readAll() {
  if (!currentDoc.content) {
    showToast('No content to read');
    return;
  }

  if (!('speechSynthesis' in window)) {
    showToast('Speech not supported');
    return;
  }

  window.speechSynthesis.cancel();

  // Initialize voices
  const voices = await getVoices();
  const bestVoice = findBestVoice(voices);

  const utterance = new SpeechSynthesisUtterance(currentDoc.content);

  if (bestVoice) {
    utterance.voice = bestVoice;
    utterance.lang = bestVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }

  // Natural speech settings
  utterance.rate = 0.75;      // Slightly slower for clarity
  utterance.pitch = 1.0;     // Normal pitch
  utterance.volume = 1.0;

  utterance.onend = () => {
    showToast('Reading complete');
  };

  utterance.onerror = (e) => {
    console.error('Speech error:', e);
    showToast('Error playing audio');
  };

  window.speechSynthesis.speak(utterance);
  showToast('Reading...');
}

async function speakSelection() {
  if (!selectedText) return;

  window.speechSynthesis.cancel();

  const voices = await getVoices();
  const bestVoice = findBestVoice(voices);

  const utterance = new SpeechSynthesisUtterance(selectedText);

  if (bestVoice) {
    utterance.voice = bestVoice;
    utterance.lang = bestVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }

  utterance.rate = 0.75;
  utterance.pitch = 1.0;

  utterance.onerror = (e) => {
    console.error('Speech error:', e);
  };

  window.speechSynthesis.speak(utterance);
  hideToolbar();
}

// Translation (using LibreTranslate - free API)
async function translateToCantonese(text) {
  try {
    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: 'zh'
      })
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    // Fallback to mock translation
    return `[粵語] ${text}`;
  }
}

// Mock translation for demo
function mockTranslate(text) {
  const prefixes = ['粵語譯：', '翻譯：', ''];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return prefix + text.split(' ').slice(0, 3).join(' ') + '...';
}

function toggleTranslation() {
  if (!currentDoc.content) {
    showToast('No content to translate');
    return;
  }

  isTranslationMode = !isTranslationMode;

  if (isTranslationMode) {
    renderTranslation();
    document.getElementById('translationSection').style.display = 'block';
    document.getElementById('readingSection').style.display = 'none';
  } else {
    document.getElementById('translationSection').style.display = 'none';
    document.getElementById('readingSection').style.display = 'block';
  }
}

function renderTranslation() {
  const container = document.getElementById('translationContent');
  const lines = currentDoc.content.split('\n').filter(line => line.trim());

  container.innerHTML = lines.map(line => `
    <div class="translation-block">
      <p class="en-text">${escapeHtml(line)}</p>
      <p class="yue-text">${mockTranslate(line)}</p>
    </div>
  `).join('');
}

async function translateSelection() {
  if (!selectedText) return;

  const translated = mockTranslate(selectedText);
  showToast(`Translation: ${translated}`);

  // Store in favorites
  saveToFavorites(selectedText, translated);
  hideToolbar();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Favorites
function saveToFavorites(text = selectedText, translation = '') {
  const fav = {
    id: crypto.randomUUID(),
    text: text,
    translation: translation || mockTranslate(text),
    createdAt: getNow()
  };

  favorites.unshift(fav);
  saveFavorites();
  showToast('Saved to favorites');
}

// Navigation
function goToLibrary() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('libraryPage').style.display = 'block';
  renderLibrary();
}

function goToHome() {
  document.getElementById('libraryPage').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

// Library
function renderLibrary(filter = '') {
  const container = document.getElementById('libraryList');
  const q = filter.toLowerCase();

  const filtered = history.filter(item => {
    const haystack = `${item.title} ${item.content}`.toLowerCase();
    return haystack.includes(q);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No history yet.</div>';
    return;
  }

  container.innerHTML = filtered.map(item => `
    <article class="library-item">
      <div class="library-item-header">${item.createdAt}</div>
      <h2 class="library-item-title">${escapeHtml(item.title)}</h2>
      <p class="library-item-meta">${item.sourceType} • ${item.wordCount} words</p>
      <div class="library-item-actions">
        <button class="btn-primary" onclick="openItem('${item.id}')">Open</button>
        <button class="btn-secondary" onclick="showDeleteModal('${item.id}')">Delete</button>
      </div>
    </article>
  `).join('');
}

function filterLibrary() {
  const query = document.getElementById('searchInput').value;
  renderLibrary(query);
}

function openItem(id) {
  const item = history.find(h => h.id === id);
  if (!item) return;

  currentDoc = {
    title: item.title,
    source: item.createdAt,
    type: item.sourceType,
    wordCount: item.wordCount,
    content: item.content
  };

  localStorage.setItem('reader-current', JSON.stringify(item));
  updateUI();
  goToHome();
}

function showDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById('deleteModal').style.display = 'flex';
}

function hideDeleteModal() {
  deleteTargetId = null;
  document.getElementById('deleteModal').style.display = 'none';
}

function confirmDelete() {
  if (!deleteTargetId) return;

  history = history.filter(h => h.id !== deleteTargetId);
  saveHistory();
  renderLibrary(document.getElementById('searchInput').value);
  hideDeleteModal();
  showToast('Deleted');
}

// Toast
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW registration failed'));
  });
}