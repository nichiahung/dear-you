import { MARGIN_AUTHORS, MARGIN_BOOKS_SETTING_KEY, MARGIN_BOOK_STATUSES } from '../core/constants.js';
import { escapeHtml, formatDate, jsArg } from '../core/dom.js';
import {
  focusMarkdown,
  getMarkdownValue,
  initMarkdownEditors,
  markdownToPlainText,
  renderMarkdown,
  setMarkdownPlaceholder,
  setMarkdownValue
} from '../core/richText.js';
import { isLocalEntryId } from '../services/localStore.js';

export function normalizeMargin(margin, entry={}) {
  const authorKey = MARGIN_AUTHORS[margin?.authorKey] ? margin.authorKey : (margin?.author === 'Marlene' ? 'her' : 'me');
  const quotes = normalizeMarginQuotes(margin);
  return {
    authorKey,
    author: margin?.author || MARGIN_AUTHORS[authorKey].label,
    bookId: margin?.bookId || '',
    book: margin?.book ? normalizeMarginBook(margin.book) : null,
    page: quotes[0]?.page || margin?.page || '',
    quote: quotes[0]?.quote || margin?.quote || '',
    quoteFormat: quotes[0]?.quoteFormat || margin?.quoteFormat || '',
    quotes,
    bookmarked: Boolean(margin?.bookmarked),
    createdFromTitle: entry?.title || ''
  };
}

export function normalizeMarginQuotes(margin) {
  const quotes = Array.isArray(margin?.quotes) ? margin.quotes : [];
  const normalized = quotes
    .map(item => ({
      page: item?.page || '',
      quote: item?.quote || '',
      quoteFormat: item?.quoteFormat || ''
    }))
    .filter(item => item.page || markdownToPlainText(item.quote, item.quoteFormat));
  if (normalized.length) return normalized;
  if (margin?.quote || margin?.page) return [{ page: margin.page || '', quote: margin.quote || '', quoteFormat: margin.quoteFormat || '' }];
  return [];
}

export function normalizeMarginBook(book) {
  const title = book?.title || 'Untitled';
  const author = book?.author || 'Unknown author';
  const id = book?.id || `book-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    title,
    author,
    year: book?.year || '',
    coverUrl: book?.coverUrl || '',
    coverId: book?.coverId || null,
    openLibraryKey: book?.openLibraryKey || null,
    provider: book?.provider || (book?.openLibraryKey ? 'openlibrary' : ''),
    providerId: book?.providerId || book?.openLibraryKey || null,
    status: MARGIN_BOOK_STATUSES.includes(book?.status) ? book.status : MARGIN_BOOK_STATUSES[0],
    votes: Math.max(0, Number(book?.votes || 0)),
    createdAt: book?.createdAt || Date.now()
  };
}

export function renderBookCover(book, alt='Book cover') {
  if (book?.coverUrl) {
    return `<img class="book-cover" src="${escapeHtml(book.coverUrl)}" loading="lazy" alt="${escapeHtml(alt)}">`;
  }
  return `<span class="book-cover-placeholder">No<br>Cover</span>`;
}

export function coverUrlFromOpenLibrary(doc) {
  if (doc?.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
  const isbn = Array.isArray(doc?.isbn) ? doc.isbn.find(Boolean) : null;
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg`;
  return '';
}

export function bookFromOpenLibraryDoc(doc) {
  const key = doc?.key || `search-${doc?.title || Date.now()}`;
  const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '-');
  return normalizeMarginBook({
    id: `ol-${safeKey}`,
    title: doc?.title || 'Untitled',
    author: Array.isArray(doc?.author_name) ? doc.author_name.slice(0, 2).join(', ') : 'Unknown author',
    year: doc?.first_publish_year || '',
    coverUrl: coverUrlFromOpenLibrary(doc),
    coverId: doc?.cover_i || null,
    openLibraryKey: doc?.key || null,
    provider: 'openlibrary',
    providerId: doc?.key || null,
    status: MARGIN_BOOK_STATUSES[0],
    votes: 1
  });
}

export function bookFromSearchApiResult(book) {
  return normalizeMarginBook({
    id: book?.id || `${book?.provider || 'book'}-${book?.providerId || book?.title || Date.now()}`,
    title: book?.title || 'Untitled',
    author: book?.author || 'Unknown author',
    year: book?.year || '',
    coverUrl: book?.coverUrl || '',
    provider: book?.provider || '',
    providerId: book?.providerId || '',
    openLibraryKey: book?.provider === 'openlibrary' ? book?.providerId : null,
    status: MARGIN_BOOK_STATUSES[0],
    votes: 1
  });
}

export function createMarginsFeature({ getEntry, getSetting, getCurrentCategory, loadEntries, openEditor, saveEntryToDB, setSetting }) {
  let marginBooks=[];
  let marginBooksLoaded=false;
  let selectedMarginBookId=null;
  let selectedMarginAuthor='me';
  let marginBookSearchOpen=false;
  let marginBookSearchQuery='';
  let marginBookSearchStatus='';
  let marginBookSearchResults=[];
  
  function selectedMarginBook() {
    return marginBooks.find(book => book.id === selectedMarginBookId) || marginBooks[0] || null;
  }
  
  async function loadMarginBooks() {
    if (marginBooksLoaded) return marginBooks;
    const stored = await getSetting(MARGIN_BOOKS_SETTING_KEY);
    marginBooks = Array.isArray(stored) ? stored.map(normalizeMarginBook) : [];
    marginBooksLoaded = true;
    if (!selectedMarginBookId && marginBooks[0]) selectedMarginBookId = marginBooks[0].id;
    return marginBooks;
  }
  
  async function saveMarginBooks() {
    marginBooks = marginBooks.map(normalizeMarginBook);
    await setSetting(MARGIN_BOOKS_SETTING_KEY, marginBooks);
  }
  
  function renderMarginBookOption(book) {
    const selected = book.id === selectedMarginBookId ? 'selected' : '';
    return `<option value="${escapeHtml(book.id)}" ${selected}>${escapeHtml(book.title)} · ${escapeHtml(book.author)}</option>`;
  }
  
  async function renderMarginsWorkspace(list, container, countEl) {
    await loadMarginBooks();
    const visibleList = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || 0) - (a.updatedAt || 0));
    countEl.textContent = visibleList.length>0 ? `· ${visibleList.length} ${visibleList.length===1?'note':'notes'}` : '';
    container.innerHTML = `
      <div class="margins-layout">
        <section class="margins-panel" aria-label="讀書心得">
          <div class="margin-thread">
            ${visibleList.length ? visibleList.map(renderMarginNote).join('') : renderEmptyMarginsThread()}
          </div>
        </section>
        ${renderReadingQueue()}
      </div>
    `;
    await setMarginQuoteDrafts('marginComposer', [{ page: '', quote: '' }]);
    await setMarkdownPlaceholder('marginBodyInput', selectedMarginBook()
      ? `關於《${selectedMarginBook().title}》，我想留下...`
      : '先選一本書，再留下心得');
  }
  
  function renderEmptyMarginsThread() {
    return `
      <div class="margin-thread-empty">
        還沒有書邊的字。選一本書，留下一句讀到妳的地方。
      </div>
    `;
  }
  
  function bookForMargin(margin) {
    if (margin?.bookId) {
      const liveBook = marginBooks.find(book => book.id === margin.bookId);
      if (liveBook) return liveBook;
    }
    return margin?.book || null;
  }
  
  function renderMarginNote(entry) {
    const margin = normalizeMargin(entry.margin, entry);
    const author = MARGIN_AUTHORS[margin.authorKey] || MARGIN_AUTHORS.me;
    const book = bookForMargin(margin);
    const dateStr = entry.date ? formatDate(entry.date) : '';
    const entryId = String(entry.id);
    const isCloudEntry = entry.source === 'cloud' || !isLocalEntryId(entry.id);
    const sourceIcon = isCloudEntry
      ? '<span class="iconify entry-source cloud" data-icon="ph:cloud-thin" title="Cloud"></span>'
      : '<span class="iconify entry-source local" data-icon="ph:bookmark-simple-thin" title="Local only"></span>';
    const pages = [...new Set(margin.quotes.map(item => item.page).filter(Boolean))];
    const page = pages.map(item => `<span class="margin-page-chip">p. ${escapeHtml(item)}</span>`).join('');
    const bookTitle = book ? escapeHtml(book.title) : 'Unselected book';
    const authorLine = book?.author ? ` · ${escapeHtml(book.author)}` : '';
  
    return `
      <article class="margin-note ${author.cls}" role="button" tabindex="0" onclick="editEntry('${entryId}')" onkeydown="handleMarginNoteKey(event, '${entryId}')">
        <div class="margin-note-meta">
          <div class="margin-note-cover">${renderBookCover(book, book?.title || 'Book cover')}</div>
          <div>
            <div class="margin-note-kicker">${escapeHtml(author.label)}</div>
            <div class="margin-book-meta">Reading note${authorLine}</div>
            <div class="margin-book-title">${bookTitle}${page}</div>
          </div>
          <span class="entry-date margin-note-date">${dateStr}</span>
        </div>
        ${margin.quotes.length ? `<div class="margin-quotes">${margin.quotes.map(renderMarginQuote).join('')}</div>` : ''}
        ${entry.body?`<div class="margin-reflection"><span class="margin-reflection-label">Reflection · 心得</span>${renderMarkdown(entry.body, entry.bodyFormat, 'entry-body markdown-content')}</div>`:''}
        <div class="margin-note-footer">
          <span class="entry-actions">
            ${sourceIcon}
            <button onclick="event.stopPropagation(); editEntry('${entryId}')"><span class="iconify" data-icon="ph:pencil-simple-thin"></span>edit</button>
            <button onclick="event.stopPropagation(); confirmDelete('${entryId}')"><span class="iconify" data-icon="ph:trash-thin"></span>remove</button>
          </span>
          <button class="margin-reply-btn" onclick="event.stopPropagation(); replyToMargin('${entryId}')">
            <span class="iconify" data-icon="ph:arrow-bend-down-left-thin"></span>reply
          </button>
        </div>
      </article>
    `;
  }

  function renderMarginQuote(item, index) {
    if (!markdownToPlainText(item.quote, item.quoteFormat)) return '';
    const page = item.page ? `<span class="margin-quote-page">p. ${escapeHtml(item.page)}</span>` : '';
    return `
      <figure class="margin-quote-block">
        ${page}
        <blockquote class="margin-quote">${renderMarkdown(item.quote, item.quoteFormat, 'markdown-content margin-quote-content')}</blockquote>
      </figure>
    `;
  }
  
  function handleMarginNoteKey(event, id) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    editEntry(id);
  }
  
  function renderReadingQueue() {
    return `
      <aside class="reading-queue" aria-label="書本候選清單">
        <div class="reading-queue-header">
          <div>
            <div class="reading-queue-title">書本候選清單</div>
            <div class="reading-queue-subtitle">Reading Queue</div>
          </div>
          <button class="book-add-btn" type="button" onclick="toggleBookSearchDrawer()" aria-label="Add book">+</button>
        </div>
        ${renderBookSearchDrawer()}
        <div class="queue-books">
          ${marginBooks.length ? marginBooks.map(renderQueueBook).join('') : renderEmptyReadingQueue()}
        </div>
      </aside>
    `;
  }
  
  function renderBookSearchDrawer() {
    return `
      <div class="book-search-drawer ${marginBookSearchOpen ? 'visible' : ''}" id="bookSearchDrawer">
        <div class="book-search-line">
          <input type="search" id="bookSearchInput" value="${escapeHtml(marginBookSearchQuery)}" placeholder="輸入書名搜尋封面" onkeydown="handleBookSearchKey(event)">
          <button class="book-search-btn" type="button" onclick="searchOpenLibraryBooks()">
            <span class="iconify" data-icon="ph:magnifying-glass-thin"></span>Search
          </button>
        </div>
        <div class="book-search-status" id="bookSearchStatus">${escapeHtml(marginBookSearchStatus)}</div>
        <div class="book-search-results" id="bookSearchResults">
          ${marginBookSearchResults.map((book, index) => renderBookSearchResult(book, index)).join('')}
        </div>
      </div>
    `;
  }
  
  function renderBookSearchResult(book, index) {
    return `
      <button class="book-result" type="button" onclick="addBookFromSearch(${index})">
        ${renderBookCover(book, book.title)}
        <span>
          <span class="book-title">${escapeHtml(book.title)}</span>
          <span class="book-author">${escapeHtml(book.author)}</span>
          ${book.year ? `<span class="book-year">${escapeHtml(String(book.year))}</span>` : ''}
        </span>
      </button>
    `;
  }
  
  function renderQueueBook(book) {
    const active = book.id === selectedMarginBookId ? 'active' : '';
    return `
      <button class="queue-book ${active}" type="button" onclick='selectMarginBook(${jsArg(book.id)}, true)'>
        ${renderBookCover(book, book.title)}
        <span>
          <span class="book-title">${escapeHtml(book.title)}</span>
          <span class="book-author">${escapeHtml(book.author)}</span>
          <span class="book-status-row">
            <span class="book-status" onclick='event.stopPropagation(); cycleMarginBookStatus(${jsArg(book.id)})'>${escapeHtml(book.status)}</span>
            <span class="book-queue-actions">
              <span class="book-votes" onclick='event.stopPropagation(); voteMarginBook(${jsArg(book.id)})'>
                <span class="iconify" data-icon="ph:heart-thin"></span>${book.votes}
              </span>
              <span class="book-remove" role="button" tabindex="0" aria-label="Remove ${escapeHtml(book.title)} from reading queue" onclick='event.stopPropagation(); removeMarginBook(${jsArg(book.id)})' onkeydown='handleQueueBookActionKey(event, () => removeMarginBook(${jsArg(book.id)}))'>
                <span class="iconify" data-icon="ph:trash-thin"></span>
              </span>
            </span>
          </span>
        </span>
      </button>
    `;
  }
  
  function renderEmptyReadingQueue() {
    return `
      <div class="queue-empty">
        先加入一本想一起讀的書。<br>
        封面會從 Open Library 搜尋。
      </div>
    `;
  }
  
  function renderMarginComposer() {
    const book = selectedMarginBook();
    return `
      <div class="margin-composer" id="marginComposer">
        <div class="margin-composer-title">留下書邊的字</div>
        <div class="field">
          <label>Book · 關聯書本</label>
          <select id="marginBookSelect" onchange="selectMarginBook(this.value)" ${marginBooks.length ? '' : 'disabled'}>
            ${marginBooks.length ? marginBooks.map(renderMarginBookOption).join('') : '<option>先從右側加入一本書</option>'}
          </select>
        </div>
        <div class="field">
          <label>Quotes · 我讀到的句子</label>
          <div class="margin-quote-list" id="marginComposerQuoteList"></div>
          <button class="margin-quote-add" type="button" onclick="addMarginQuote('marginComposer')">
            <span class="iconify" data-icon="ph:plus-thin"></span>新增 quote
          </button>
        </div>
        <div class="field">
          <label>Reflection · 心得</label>
          <div id="marginBodyInput" data-markdown-editor data-placeholder="${book ? `關於《${escapeHtml(book.title)}》，我想留下...` : '先選一本書，再留下心得'}"></div>
        </div>
        <div class="margin-composer-actions">
          <div class="margin-author-toggle" aria-label="留言者">
            ${Object.values(MARGIN_AUTHORS).map(author => `
              <button type="button" class="${selectedMarginAuthor === author.key ? 'active' : ''}" onclick="selectMarginAuthor('${author.key}')">${escapeHtml(author.label)}</button>
            `).join('')}
          </div>
          <button class="margin-submit" type="button" onclick="saveMarginReflection()">留下書邊的字</button>
        </div>
      </div>
    `;
  }
  
  function setWorkFilter(type) {
    currentWorkFilter = type === 'all' || WORK_TYPES[type] ? type : 'all';
    loadEntries();
  }
  
  function selectMarginAuthor(authorKey) {
    selectedMarginAuthor = MARGIN_AUTHORS[authorKey] ? authorKey : 'me';
    loadEntries();
  }
  
  function selectMarginBook(bookId, rerender=false) {
    if (marginBooks.some(book => book.id === bookId)) selectedMarginBookId = bookId;
    const select = document.getElementById('marginBookSelect') || document.getElementById('marginEditorBook');
    if (select && select.value !== selectedMarginBookId) select.value = selectedMarginBookId || '';
    if (rerender && getCurrentCategory() === 'margins') loadEntries();
  }

  function quoteListId(scope) {
    return `${scope}QuoteList`;
  }

  function quoteEditorId(scope, index) {
    return `${scope}QuoteEditor${index}`;
  }

  async function readMarginQuoteDrafts(scope) {
    const wrap = document.getElementById(quoteListId(scope));
    if (!wrap) return [];
    return Promise.all(Array.from(wrap.querySelectorAll('[data-margin-quote-row]')).map(async (row, index) => ({
      page: row.querySelector('[data-margin-quote-page]')?.value.trim() || '',
      quote: await getMarkdownValue(row.querySelector('[data-markdown-editor]')?.id || quoteEditorId(scope, index)),
      quoteFormat: 'markdown'
    })));
  }

  async function setMarginQuoteDrafts(scope, quotes) {
    const wrap = document.getElementById(quoteListId(scope));
    if (!wrap) return;
    const drafts = quotes.length ? quotes : [{ page: '', quote: '' }];
    wrap.innerHTML = drafts.map((item, index) => `
      <div class="margin-quote-editor-row" data-margin-quote-row>
        <div class="field margin-quote-text-field">
          <label>Quote ${index + 1}</label>
          <div class="margin-quote-input" id="${quoteEditorId(scope, index)}" data-markdown-editor data-placeholder="把那句停下來想起對方的文字放在這裡"></div>
        </div>
        <div class="field margin-quote-page-field">
          <label>Page · 頁碼</label>
          <input type="text" data-margin-quote-page value="${escapeHtml(item.page || '')}" placeholder="p. 42">
        </div>
        <button class="margin-quote-remove" type="button" onclick="removeMarginQuote('${scope}', ${index})" ${drafts.length === 1 ? 'disabled' : ''} aria-label="移除 quote ${index + 1}">
          <span class="iconify" data-icon="ph:trash-thin"></span>
        </button>
      </div>
    `).join('');
    await initMarkdownEditors(wrap);
    await Promise.all(drafts.map((item, index) => setMarkdownValue(quoteEditorId(scope, index), item.quote || '', item.quoteFormat)));
  }

  async function addMarginQuote(scope) {
    const drafts = await readMarginQuoteDrafts(scope);
    await setMarginQuoteDrafts(scope, [...drafts, { page: '', quote: '' }]);
    await focusMarkdown(quoteEditorId(scope, drafts.length));
  }

  async function removeMarginQuote(scope, index) {
    const drafts = await readMarginQuoteDrafts(scope);
    if (drafts.length <= 1) return;
    drafts.splice(index, 1);
    await setMarginQuoteDrafts(scope, drafts);
  }
  
  function toggleBookSearchDrawer() {
    marginBookSearchOpen = !marginBookSearchOpen;
    loadEntries().then(() => {
      if (marginBookSearchOpen) document.getElementById('bookSearchInput')?.focus();
    });
  }
  
  function handleBookSearchKey(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    searchOpenLibraryBooks();
  }
  
  async function searchOpenLibraryBooks() {
    const input = document.getElementById('bookSearchInput');
    marginBookSearchQuery = input?.value.trim() || marginBookSearchQuery.trim();
    marginBookSearchOpen = true;
    marginBookSearchResults = [];
    if (!marginBookSearchQuery) {
      marginBookSearchStatus = '請先輸入書名';
      loadEntries();
      return;
    }
  
    marginBookSearchStatus = 'searching book sources...';
    await loadEntries();
  
    try {
      marginBookSearchResults = await searchBooksWithBackendFallback(marginBookSearchQuery);
      marginBookSearchStatus = marginBookSearchResults.length
        ? `${marginBookSearchResults.length} books found`
        : '找不到候選書，換個書名試試';
    } catch (err) {
      console.error('Open Library search failed:', err);
      marginBookSearchStatus = '暫時無法搜尋封面，稍後再試';
    }
  
    loadEntries().then(() => document.getElementById('bookSearchInput')?.focus());
  }
  
  async function searchBooksWithBackendFallback(query) {
    try {
      const apiBooks = await searchBooksApi(query);
      if (apiBooks.length) return apiBooks.slice(0, 5);
    } catch (err) {
      console.warn('Backend book search unavailable, falling back to Open Library:', err);
    }
  
    let docs = await searchOpenLibraryDocuments('title', query);
    if (docs.length === 0) docs = await searchOpenLibraryDocuments('q', query);
    return docs.slice(0, 5).map(bookFromOpenLibraryDoc);
  }
  
  async function searchBooksApi(query) {
    const params = new URLSearchParams({ q: query });
    const res = await fetch(`/api/searchBooks?${params.toString()}`);
    if (!res.ok) throw new Error(`searchBooks returned ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.books) ? data.books.map(bookFromSearchApiResult) : [];
  }
  
  async function searchOpenLibraryDocuments(field, value) {
    const params = new URLSearchParams({
      [field]: value,
      limit: '5',
      fields: 'key,title,author_name,first_publish_year,cover_i,isbn'
    });
    const res = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
    if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
    const data = await res.json();
    return data.docs || [];
  }
  
  async function addBookFromSearch(index) {
    const book = marginBookSearchResults[index];
    if (!book) return;
    const duplicate = marginBooks.find(item =>
      (book.openLibraryKey && item.openLibraryKey === book.openLibraryKey) ||
      (item.title === book.title && item.author === book.author)
    );
    const savedBook = duplicate || normalizeMarginBook({ ...book, createdAt: Date.now() });
    if (!duplicate) marginBooks.unshift(savedBook);
    selectedMarginBookId = savedBook.id;
    marginBookSearchOpen = false;
    marginBookSearchQuery = '';
    marginBookSearchStatus = '';
    marginBookSearchResults = [];
    await saveMarginBooks();
    loadEntries();
  }
  
  async function voteMarginBook(bookId) {
    const book = marginBooks.find(item => item.id === bookId);
    if (!book) return;
    book.votes = Number(book.votes || 0) + 1;
    await saveMarginBooks();
    loadEntries();
  }
  
  async function cycleMarginBookStatus(bookId) {
    const book = marginBooks.find(item => item.id === bookId);
    if (!book) return;
    const idx = MARGIN_BOOK_STATUSES.indexOf(book.status);
    book.status = MARGIN_BOOK_STATUSES[(idx + 1) % MARGIN_BOOK_STATUSES.length];
    await saveMarginBooks();
    loadEntries();
  }

  async function removeMarginBook(bookId) {
    const book = marginBooks.find(item => item.id === bookId);
    if (!book) return;
    if (!confirm(`要從候選清單移出《${book.title}》嗎？已留下的讀書心得不會被刪除。`)) return;

    marginBooks = marginBooks.filter(item => item.id !== bookId);
    if (selectedMarginBookId === bookId) selectedMarginBookId = marginBooks[0]?.id || null;
    await saveMarginBooks();
    loadEntries();
  }

  function handleQueueBookActionKey(event, action) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    action();
  }
  
  async function saveMarginReflection() {
    await loadMarginBooks();
    const bookId = document.getElementById('marginBookSelect')?.value || selectedMarginBookId || '';
    const book = marginBooks.find(item => item.id === bookId) || null;
    const quotes = (await readMarginQuoteDrafts('marginComposer')).filter(item => item.page || markdownToPlainText(item.quote, item.quoteFormat));
    const body = await getMarkdownValue('marginBodyInput');
  
    if (!book) {
      alert('請先從右側加入或選擇一本書。');
      return;
    }
    if (!quotes.some(item => markdownToPlainText(item.quote, item.quoteFormat)) && !markdownToPlainText(body, 'markdown')) {
      alert('請至少留下一句讀到的文字或心得。');
      return;
    }
  
    selectedMarginBookId = book.id;
    const author = MARGIN_AUTHORS[selectedMarginAuthor] || MARGIN_AUTHORS.me;
    await saveEntryToDB({
      category: 'margins',
      date: new Date().toISOString().slice(0,10),
      title: book.title,
      body,
      bodyFormat: 'markdown',
      images: [],
      audios: [],
      margin: {
        authorKey: author.key,
        author: author.label,
        bookId: book.id,
        book,
        page: quotes[0]?.page || '',
        quote: quotes[0]?.quote || '',
        quoteFormat: quotes[0]?.quoteFormat || 'markdown',
        quotes,
        bookmarked: false
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    loadEntries();
  }
  
  async function replyToMargin(id) {
    const entry = await getEntry(id);
    const margin = normalizeMargin(entry?.margin, entry);
    if (margin.bookId) selectedMarginBookId = margin.bookId;
    await openEditor(null, {
      category: 'margins',
      authorKey: margin.authorKey === 'her' ? 'me' : 'her',
      margin: {
        ...margin,
        quote: margin.quote,
        page: margin.page,
        quotes: margin.quotes
      },
      body: ''
    });
    await focusMarkdown('marginEditorBody');
  }

  async function renderMarginEditorFields(entry, defaults={}, visible=false) {
    document.querySelectorAll('.standard-entry-field').forEach(field => {
      field.style.display = visible ? 'none' : 'block';
    });
    const marginFields = document.getElementById('marginEditorFields');
    const mediaField = document.getElementById('mediaField');
    if (mediaField) mediaField.style.display = visible ? 'none' : 'block';
    if (!marginFields) return;
    marginFields.classList.toggle('visible', visible);
    if (!visible) return;
  
    const margin = normalizeMargin(defaults.margin || entry?.margin, entry || {});
    const bookFromEntry = bookForMargin(margin);
    const initialBookId = margin.bookId || defaults.bookId || bookFromEntry?.id || selectedMarginBookId || marginBooks[0]?.id || '';
    if (marginBooks.some(book => book.id === initialBookId)) selectedMarginBookId = initialBookId;
    selectedMarginAuthor = MARGIN_AUTHORS[defaults.authorKey] ? defaults.authorKey : (MARGIN_AUTHORS[margin.authorKey] ? margin.authorKey : selectedMarginAuthor);
  
    const bookSelect = document.getElementById('marginEditorBook');
    if (bookSelect) {
      bookSelect.innerHTML = marginBooks.length
        ? marginBooks.map(renderMarginBookOption).join('')
        : '<option value="">先從右側加入一本書</option>';
      bookSelect.disabled = marginBooks.length === 0;
      bookSelect.value = selectedMarginBookId || '';
      bookSelect.onchange = event => {
        selectMarginBook(event.target.value);
        updateMarginEditorPlaceholder();
      };
    }
    await setMarginQuoteDrafts('marginEditor', margin.quotes.length ? margin.quotes : [{ quote: defaults.quote || '', page: defaults.page || '' }]);
    await setMarkdownValue('marginEditorBody', entry?.body || defaults.body || '', entry?.bodyFormat || defaults.bodyFormat);
    await updateMarginEditorPlaceholder();
    renderMarginEditorAuthors();
  }
  
  async function updateMarginEditorPlaceholder() {
    const bodyInput = document.getElementById('marginEditorBody');
    if (!bodyInput) return;
    const book = selectedMarginBook();
    await setMarkdownPlaceholder('marginEditorBody', book ? `關於《${book.title}》，我想留下...` : '先選一本書，再留下心得');
  }
  
  function renderMarginEditorAuthors() {
    const wrap = document.getElementById('marginEditorAuthors');
    if (!wrap) return;
    wrap.innerHTML = Object.values(MARGIN_AUTHORS).map(author => `
      <button type="button" class="${selectedMarginAuthor === author.key ? 'active' : ''}" onclick="selectMarginEditorAuthor('${author.key}')">${escapeHtml(author.label)}</button>
    `).join('');
  }
  
  function selectMarginEditorAuthor(authorKey) {
    selectedMarginAuthor = MARGIN_AUTHORS[authorKey] ? authorKey : 'me';
    renderMarginEditorAuthors();
  }

  async function buildEditorEntry({ date, editingId }) {
    await loadMarginBooks();
    const bookId = document.getElementById('marginEditorBook')?.value || selectedMarginBookId || '';
    const book = marginBooks.find(item => item.id === bookId) || null;
    const quotes = (await readMarginQuoteDrafts('marginEditor')).filter(item => item.page || markdownToPlainText(item.quote, item.quoteFormat));
    const reflection = await getMarkdownValue('marginEditorBody');

    if (!book) {
      alert('請先從右側加入或選擇一本書。');
      return null;
    }
    if (!quotes.some(item => markdownToPlainText(item.quote, item.quoteFormat)) && !markdownToPlainText(reflection, 'markdown')) {
      alert('請至少留下一句讀到的文字或心得。');
      return null;
    }

    selectedMarginBookId = book.id;
    const author = MARGIN_AUTHORS[selectedMarginAuthor] || MARGIN_AUTHORS.me;
    const old = editingId ? await getEntry(editingId) : null;
    const entry = {
      category: 'margins',
      date: date || new Date().toISOString().slice(0,10),
      title: book.title,
      body: reflection,
      bodyFormat: 'markdown',
      images: [],
      audios: [],
      margin: {
        authorKey: author.key,
        author: author.label,
        bookId: book.id,
        book,
        page: quotes[0]?.page || '',
        quote: quotes[0]?.quote || '',
        quoteFormat: quotes[0]?.quoteFormat || 'markdown',
        quotes,
        bookmarked: Boolean(old?.margin?.bookmarked)
      },
      createdAt: old?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    if (editingId) entry.id = editingId;
    return entry;
  }

  return {
    addBookFromSearch,
    addMarginQuote,
    buildEditorEntry,
    cycleMarginBookStatus,
    handleBookSearchKey,
    handleMarginNoteKey,
    handleQueueBookActionKey,
    loadMarginBooks,
    removeMarginBook,
    removeMarginQuote,
    renderEditorFields: renderMarginEditorFields,
    renderWorkspace: renderMarginsWorkspace,
    replyToMargin,
    saveMarginReflection,
    searchOpenLibraryBooks,
    selectMarginAuthor,
    selectMarginBook,
    selectMarginEditorAuthor,
    toggleBookSearchDrawer,
    voteMarginBook
  };
}
