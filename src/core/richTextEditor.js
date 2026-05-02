import { Editor, mergeAttributes, Node } from '@tiptap/core';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';

const FORMAT_MARKDOWN = 'markdown';
const editorMap = new Map();

const markdownRenderer = new MarkdownIt({
  breaks: true,
  html: true,
  linkify: true
});

const turndown = new TurndownService({
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  headingStyle: 'atx'
});

const ImageNode = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      title: { default: null }
    };
  },
  parseHTML() {
    return [{ tag: 'img[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes({ loading: 'lazy' }, HTMLAttributes)];
  }
});

turndown.addRule('underline', {
  filter: ['u'],
  replacement(content) {
    return content ? `<u>${content}</u>` : '';
  }
});

turndown.addRule('details', {
  filter: 'details',
  replacement(content, node) {
    const clone = node.cloneNode(true);
    const summary = clone.querySelector(':scope > summary') || clone.querySelector('summary');
    const summaryHtml = (summary?.innerHTML || 'Toggle').trim() || 'Toggle';
    const contentWrapper = clone.querySelector(':scope > div[data-type="detailsContent"]');
    let bodyHtml = '';

    if (contentWrapper) {
      bodyHtml = contentWrapper.innerHTML.trim();
    } else {
      if (summary) summary.remove();
      bodyHtml = clone.innerHTML.trim();
    }

    const openAttr = node.hasAttribute('open') ? ' open' : '';
    return `\n\n<details${openAttr}>\n<summary>${summaryHtml}</summary>\n<div data-type="detailsContent">\n${bodyHtml || '<p></p>'}\n</div>\n</details>\n\n`;
  }
});

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['a', 'blockquote', 'br', 'details', 'div', 'em', 'h1', 'h2', 'h3', 'img', 'li', 'ol', 'p', 's', 'strong', 'summary', 'u', 'ul'],
  ALLOWED_ATTR: ['alt', 'data-type', 'href', 'loading', 'open', 'rel', 'src', 'target', 'title']
};

const SLASH_COMMANDS = [
  { key: 'text', title: 'Text', hint: 'Plain paragraph', aliases: ['p', 'paragraph'], icon: 'T' },
  { key: 'h1', title: 'Heading 1', hint: 'Top-level heading', aliases: ['heading', 'header', 'h1'], icon: 'H1' },
  { key: 'h2', title: 'Heading 2', hint: 'Large section heading', aliases: ['heading', 'header', 'h2'], icon: 'H2' },
  { key: 'h3', title: 'Heading 3', hint: 'Smaller section heading', aliases: ['heading', 'header', 'h3'], icon: 'H3' },
  { key: 'bulletList', title: 'Bullet list', hint: 'Simple unordered list', aliases: ['bullet', 'list', 'ul'], icon: '-' },
  { key: 'orderedList', title: 'Numbered list', hint: 'Ordered list', aliases: ['number', 'numbered', 'list', 'ol'], icon: '1.' },
  { key: 'blockquote', title: 'Quote', hint: 'Call out a passage', aliases: ['quote', 'blockquote'], icon: '>' },
  { key: 'toggle', title: 'Toggle', hint: 'Collapsible section', aliases: ['details', 'collapse', 'collapsible'], icon: '▸' },
  { key: 'image', title: 'Image', hint: 'Insert an image URL', aliases: ['img', 'picture', 'photo'], icon: '▧' }
];

function hasHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function sanitizeHtml(value) {
  return DOMPurify.sanitize(String(value || ''), SANITIZE_CONFIG).trim();
}

function normalizeDetailsForEditor(html) {
  if (!html || !html.includes('<details')) return html;
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('details').forEach(details => {
    let summary = details.querySelector(':scope > summary');
    if (!summary) {
      summary = document.createElement('summary');
      summary.textContent = 'Toggle';
      details.prepend(summary);
    }

    if (details.querySelector(':scope > div[data-type="detailsContent"]')) return;

    const content = document.createElement('div');
    content.dataset.type = 'detailsContent';
    Array.from(details.childNodes).forEach(child => {
      if (child !== summary) content.appendChild(child);
    });
    if (!content.childNodes.length) content.appendChild(document.createElement('p'));
    details.appendChild(content);
  });

  return template.innerHTML;
}

function renderLegacyHtml(value) {
  const input = String(value || '');
  const html = hasHtml(input) ? input : escapeHtml(input).replace(/\n/g, '<br>');
  return sanitizeHtml(html);
}

function legacyToMarkdown(value) {
  const input = String(value || '');
  if (!input.trim()) return '';
  if (!hasHtml(input)) return input;
  return turndown.turndown(sanitizeHtml(input)).trim();
}

function markdownToHtml(value) {
  return sanitizeHtml(markdownRenderer.render(String(value || '')));
}

function valueToEditorHtml(value, format) {
  const html = format === FORMAT_MARKDOWN ? markdownToHtml(value) : renderLegacyHtml(value);
  return normalizeDetailsForEditor(html);
}

function htmlToMarkdown(value) {
  return turndown.turndown(sanitizeHtml(value)).trim();
}

function toolbarActions(editor, state=null) {
  return [
    { key: 'bold', label: 'B', title: 'Bold', active: () => editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', label: 'I', title: 'Italic', active: () => editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { key: 'underline', label: 'U', title: 'Underline', active: () => editor.isActive('underline'), run: () => editor.chain().focus().toggleUnderline().run() },
    { key: 'h1', label: 'H1', title: 'Heading 1', active: () => editor.isActive('heading', { level: 1 }), run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: 'h2', label: 'H2', title: 'Heading 2', active: () => editor.isActive('heading', { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'h3', label: 'H3', title: 'Heading 3', active: () => editor.isActive('heading', { level: 3 }), run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: 'bulletList', label: '-', title: 'Bullet list', active: () => editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { key: 'orderedList', label: '1.', title: 'Numbered list', active: () => editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: 'blockquote', label: '>', title: 'Quote', active: () => editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
    { key: 'toggle', label: '▸', title: 'Toggle', active: () => editor.isActive('details'), run: () => toggleDetails(editor) },
    { key: 'link', label: '↗', title: 'Link', active: () => editor.isActive('link'), run: () => state ? openLinkPopover(state) : toggleLink(editor) },
    { key: 'clear', label: '⌫', title: 'Clear formatting', active: () => false, run: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
    { key: 'image', label: '▧', title: 'Image', active: () => editor.isActive('image'), run: () => state ? openImagePopover(state) : null }
  ];
}

function toggleDetails(editor) {
  const chain = editor.chain().focus();
  if (editor.isActive('details')) {
    chain.unsetDetails().run();
    return;
  }
  chain.setDetails().run();
  editor.commands.updateAttributes('details', { open: true });
}

function toggleLink(editor) {
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink().run();
    return;
  }

  const previousUrl = editor.getAttributes('link').href || '';
  const url = window.prompt('Link URL', previousUrl);
  if (url === null) return;
  if (!url.trim()) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim(), target: '_blank', rel: 'noopener noreferrer' }).run();
}

function normalizeUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return url;
  return `https://${url}`;
}

function closeLinkPopover(state) {
  state.linkPopoverOpen = false;
  state.linkRange = null;
  if (state.linkPopover) state.linkPopover.hidden = true;
}

function openLinkPopover(state) {
  closeSlashMenu(state);
  closeImagePopover(state);
  const { editor } = state;
  editor.chain().focus().extendMarkRange('link').run();
  state.linkRange = {
    from: editor.state.selection.from,
    to: editor.state.selection.to
  };
  state.linkPopoverOpen = true;
  state.linkInput.value = editor.getAttributes('link').href || '';
  state.linkPopover.hidden = false;
  state.linkInput.focus();
  state.linkInput.select();
}

function applyLinkPopover(state) {
  const href = normalizeUrl(state.linkInput.value);
  const { editor, linkRange } = state;
  if (!linkRange) return;

  const chain = editor.chain().focus().setTextSelection(linkRange);
  if (!href) {
    chain.extendMarkRange('link').unsetLink().run();
    closeLinkPopover(state);
    return;
  }

  if (linkRange.from === linkRange.to) {
    chain.insertContent(`<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`).run();
  } else {
    chain.extendMarkRange('link').setLink({ href, target: '_blank', rel: 'noopener noreferrer' }).run();
  }
  closeLinkPopover(state);
}

function removeLinkPopover(state) {
  const { editor, linkRange } = state;
  if (!linkRange) return;
  editor.chain().focus().setTextSelection(linkRange).extendMarkRange('link').unsetLink().run();
  closeLinkPopover(state);
}

function closeImagePopover(state) {
  state.imagePopoverOpen = false;
  state.imageRange = null;
  if (state.imagePopover) state.imagePopover.hidden = true;
}

function openImagePopover(state) {
  closeSlashMenu(state);
  closeLinkPopover(state);
  const { editor } = state;
  editor.commands.focus();
  state.imageRange = {
    from: editor.state.selection.from,
    to: editor.state.selection.to
  };
  state.imagePopoverOpen = true;
  state.imageInput.value = '';
  state.imageAltInput.value = '';
  state.imagePopover.hidden = false;
  state.imageInput.focus();
}

function applyImagePopover(state) {
  const src = normalizeUrl(state.imageInput.value);
  if (!src || !state.imageRange) return;
  const alt = state.imageAltInput.value.trim();
  state.editor
    .chain()
    .focus()
    .setTextSelection(state.imageRange)
    .insertContent({ type: 'image', attrs: { src, alt, title: alt || null } })
    .run();
  closeImagePopover(state);
}

function syncToolbar(state) {
  state.host.classList.toggle('is-empty', state.editor.isEmpty);
  const actions = toolbarActions(state.editor, state);
  state.toolbar.querySelectorAll('[data-markdown-action]').forEach(button => {
    const action = actions.find(item => item.key === button.dataset.markdownAction);
    button.classList.toggle('active', Boolean(action?.active()));
  });
  updateSlashMenu(state);
}

function findSlashQuery(editor) {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\0');
  const match = /(^|\s)\/([^\s/]*)$/.exec(textBefore);
  if (!match) return null;

  const slashIndex = match.index + match[1].length;
  return {
    from: $from.pos - (textBefore.length - slashIndex),
    to: $from.pos,
    query: match[2].toLowerCase()
  };
}

function slashMatches(command, query) {
  if (!query) return true;
  const haystack = [command.key, command.title, command.hint, ...command.aliases].join(' ').toLowerCase();
  return haystack.includes(query);
}

function buildSlashMenu(state) {
  const menu = document.createElement('div');
  menu.className = 'slash-command-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', 'Block commands');
  menu.hidden = true;
  menu.addEventListener('mousedown', event => event.preventDefault());
  document.body.appendChild(menu);
  return menu;
}

function renderSlashMenu(state) {
  state.slashMenu.innerHTML = state.slashItems.map((item, index) => `
    <button class="${index === state.slashIndex ? 'active' : ''}" type="button" role="option" aria-selected="${index === state.slashIndex ? 'true' : 'false'}" data-slash-index="${index}">
      <span class="slash-command-icon">${escapeHtml(item.icon)}</span>
      <span>
        <span class="slash-command-title">${escapeHtml(item.title)}</span>
        <span class="slash-command-hint">${escapeHtml(item.hint)}</span>
      </span>
    </button>
  `).join('');

  state.slashMenu.querySelectorAll('[data-slash-index]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.slashIndex);
      applySlashCommand(state, state.slashItems[index]);
    });
  });
}

function positionSlashMenu(state) {
  try {
    const rect = state.editor.view.coordsAtPos(state.slashRange.to);
    const width = 276;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 260);
    state.slashMenu.style.left = `${left}px`;
    state.slashMenu.style.top = `${Math.max(12, top)}px`;
  } catch {
    const hostRect = state.host.getBoundingClientRect();
    state.slashMenu.style.left = `${Math.max(12, hostRect.left)}px`;
    state.slashMenu.style.top = `${Math.max(12, hostRect.top + 48)}px`;
  }
}

function updateSlashMenu(state) {
  if (!state.slashMenu) return;
  const slashRange = findSlashQuery(state.editor);
  if (!slashRange) {
    closeSlashMenu(state);
    return;
  }

  const items = SLASH_COMMANDS.filter(command => slashMatches(command, slashRange.query));
  if (!items.length) {
    closeSlashMenu(state);
    return;
  }

  state.slashRange = slashRange;
  state.slashItems = items;
  state.slashIndex = Math.min(state.slashIndex || 0, items.length - 1);
  state.slashOpen = true;
  renderSlashMenu(state);
  positionSlashMenu(state);
  state.slashMenu.hidden = false;
}

function closeSlashMenu(state) {
  state.slashOpen = false;
  state.slashRange = null;
  state.slashItems = [];
  state.slashIndex = 0;
  if (state.slashMenu) state.slashMenu.hidden = true;
}

function applySlashCommand(state, command) {
  if (!command || !state.slashRange) return;
  const range = state.slashRange;
  closeSlashMenu(state);
  const chain = state.editor.chain().focus().deleteRange(range);

  if (command.key === 'image') {
    chain.run();
    openImagePopover(state);
    return;
  }

  if (command.key === 'text') chain.setParagraph().run();
  if (command.key === 'h1') chain.setNode('heading', { level: 1 }).run();
  if (command.key === 'h2') chain.setNode('heading', { level: 2 }).run();
  if (command.key === 'h3') chain.setNode('heading', { level: 3 }).run();
  if (command.key === 'bulletList') chain.toggleBulletList().run();
  if (command.key === 'orderedList') chain.toggleOrderedList().run();
  if (command.key === 'blockquote') chain.toggleBlockquote().run();
  if (command.key === 'toggle') {
    chain.setDetails().run();
    state.editor.commands.updateAttributes('details', { open: true });
  }
}

function handleSlashKeyDown(state, event) {
  if (!state?.slashOpen) return false;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.slashIndex = (state.slashIndex + 1) % state.slashItems.length;
    renderSlashMenu(state);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.slashIndex = (state.slashIndex - 1 + state.slashItems.length) % state.slashItems.length;
    renderSlashMenu(state);
    return true;
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault();
    applySlashCommand(state, state.slashItems[state.slashIndex]);
    return true;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSlashMenu(state);
    return true;
  }
  return false;
}

function buildToolbar(state) {
  const toolbar = document.createElement('div');
  toolbar.className = 'markdown-toolbar';
  toolbar.setAttribute('aria-label', 'Markdown formatting');

  toolbarActions(state.editor, state).forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.markdownAction = item.key;
    button.textContent = item.label;
    button.title = item.title;
    button.setAttribute('aria-label', item.title);
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', item.run);
    toolbar.appendChild(button);
  });

  return toolbar;
}

function buildLinkPopover(state) {
  const popover = document.createElement('div');
  popover.className = 'markdown-link-popover';
  popover.hidden = true;

  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'Paste or type a link';
  input.setAttribute('aria-label', 'Link URL');
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLinkPopover(state);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLinkPopover(state);
      state.editor.commands.focus();
    }
  });

  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.textContent = 'Apply';
  applyButton.addEventListener('mousedown', event => event.preventDefault());
  applyButton.addEventListener('click', () => applyLinkPopover(state));

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('mousedown', event => event.preventDefault());
  removeButton.addEventListener('click', () => removeLinkPopover(state));

  popover.append(input, applyButton, removeButton);
  state.linkInput = input;
  return popover;
}

function buildImagePopover(state) {
  const popover = document.createElement('div');
  popover.className = 'markdown-image-popover';
  popover.hidden = true;

  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'Image URL or /assets path';
  input.setAttribute('aria-label', 'Image URL');

  const altInput = document.createElement('input');
  altInput.type = 'text';
  altInput.placeholder = 'Alt text';
  altInput.setAttribute('aria-label', 'Image alt text');

  const applyFromKeyboard = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyImagePopover(state);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeImagePopover(state);
      state.editor.commands.focus();
    }
  };
  input.addEventListener('keydown', applyFromKeyboard);
  altInput.addEventListener('keydown', applyFromKeyboard);

  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.textContent = 'Insert';
  applyButton.addEventListener('mousedown', event => event.preventDefault());
  applyButton.addEventListener('click', () => applyImagePopover(state));

  popover.append(input, altInput, applyButton);
  state.imageInput = input;
  state.imageAltInput = altInput;
  return popover;
}

function createEditorState(host, options={}) {
  host.textContent = '';
  host.classList.add('markdown-editor');
  host.dataset.placeholder = options.placeholder || host.dataset.placeholder || '';

  const toolbarMount = document.createElement('div');
  const linkPopoverMount = document.createElement('div');
  const imagePopoverMount = document.createElement('div');
  const surface = document.createElement('div');
  surface.className = 'markdown-surface';
  host.append(toolbarMount, linkPopoverMount, imagePopoverMount, surface);

  let activeState = null;
  const editor = new Editor({
    element: surface,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Details.configure({
        persist: true,
        renderToggleButton: ({ element, isOpen }) => {
          element.textContent = isOpen ? '⌄' : '›';
          element.setAttribute('aria-label', isOpen ? 'Collapse toggle' : 'Expand toggle');
        }
      }),
      DetailsSummary,
      DetailsContent,
      ImageNode,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https'
      }),
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            if (node.attrs.level === 1) return 'Heading 1';
            if (node.attrs.level === 2) return 'Heading 2';
            if (node.attrs.level === 3) return 'Heading 3';
          }
          if (node.type.name === 'detailsSummary') return 'Toggle';
          return host.dataset.placeholder || '';
        }
      }),
      Typography
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'markdown-area'
      },
      handleKeyDown(view, event) {
        return handleSlashKeyDown(activeState, event);
      }
    },
    onCreate: () => {
      const state = editorMap.get(host.id);
      if (state) syncToolbar(state);
    },
    onUpdate: () => {
      const state = editorMap.get(host.id);
      if (state) syncToolbar(state);
    },
    onSelectionUpdate: () => {
      const state = editorMap.get(host.id);
      if (state) syncToolbar(state);
    }
  });

  const state = {
    host,
    editor,
    surface,
    toolbar: null,
    linkPopover: null,
    linkPopoverOpen: false,
    linkInput: null,
    linkRange: null,
    imagePopover: null,
    imagePopoverOpen: false,
    imageInput: null,
    imageAltInput: null,
    imageRange: null,
    slashMenu: null,
    slashOpen: false,
    slashRange: null,
    slashItems: [],
    slashIndex: 0
  };
  activeState = state;
  state.toolbar = buildToolbar(state);
  state.linkPopover = buildLinkPopover(state);
  state.imagePopover = buildImagePopover(state);
  state.slashMenu = buildSlashMenu(state);
  toolbarMount.replaceChildren(state.toolbar);
  linkPopoverMount.replaceChildren(state.linkPopover);
  imagePopoverMount.replaceChildren(state.imagePopover);
  syncToolbar(state);
  return state;
}

export function renderMarkdown(value, format='legacy', className='markdown-content') {
  const html = format === FORMAT_MARKDOWN ? markdownToHtml(value) : renderLegacyHtml(value);
  return html ? `<div class="${className}">${html}</div>` : '';
}

export function markdownToPlainText(value, format='legacy') {
  const div = document.createElement('div');
  div.innerHTML = format === FORMAT_MARKDOWN ? markdownToHtml(value) : renderLegacyHtml(value);
  return (div.textContent || '').replace(/\u00a0/g, ' ').trim();
}

export function initMarkdownEditor(id, options={}) {
  const host = typeof id === 'string' ? document.getElementById(id) : id;
  if (!host?.id) return null;
  const existing = editorMap.get(host.id);
  if (existing?.host === host) return existing;
  if (existing) {
    existing.editor.destroy();
    existing.slashMenu?.remove();
    editorMap.delete(host.id);
  }

  const state = createEditorState(host, options);
  editorMap.set(host.id, state);
  return state;
}

export function initMarkdownEditors(root=document) {
  root.querySelectorAll('[data-markdown-editor]').forEach(el => initMarkdownEditor(el));
}

export function setMarkdownPlaceholder(id, placeholderText='') {
  const state = initMarkdownEditor(id, { placeholder: placeholderText });
  if (!state) return;
  state.host.dataset.placeholder = placeholderText;
}

export function setMarkdownValue(id, value='', format='legacy') {
  const state = initMarkdownEditor(id);
  if (!state) return;
  const html = valueToEditorHtml(value, format);
  state.editor.commands.setContent(html || '<p></p>', { emitUpdate: false });
  syncToolbar(state);
}

export function getMarkdownValue(id) {
  const state = initMarkdownEditor(id);
  if (!state) return '';
  return htmlToMarkdown(state.editor.getHTML());
}

export function focusMarkdown(id) {
  initMarkdownEditor(id)?.editor.focus();
}
