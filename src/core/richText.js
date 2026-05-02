import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

const FORMAT_MARKDOWN = 'markdown';

const markdownRenderer = new MarkdownIt({
  breaks: true,
  html: true,
  linkify: true
});

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['a', 'blockquote', 'br', 'details', 'div', 'em', 'h1', 'h2', 'h3', 'img', 'li', 'ol', 'p', 's', 'strong', 'summary', 'u', 'ul'],
  ALLOWED_ATTR: ['alt', 'data-type', 'href', 'loading', 'open', 'rel', 'src', 'target', 'title']
};

let editorModulePromise = null;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function hasHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function sanitizeHtml(value) {
  return DOMPurify.sanitize(String(value || ''), SANITIZE_CONFIG).trim();
}

function renderLegacyHtml(value) {
  const input = String(value || '');
  const html = hasHtml(input) ? input : escapeHtml(input).replace(/\n/g, '<br>');
  return sanitizeHtml(html);
}

function markdownToHtml(value) {
  return sanitizeHtml(markdownRenderer.render(String(value || '')));
}

function loadEditorModule() {
  if (!editorModulePromise) editorModulePromise = import('./richTextEditor.js');
  return editorModulePromise;
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

export async function initMarkdownEditor(...args) {
  return (await loadEditorModule()).initMarkdownEditor(...args);
}

export async function initMarkdownEditors(...args) {
  return (await loadEditorModule()).initMarkdownEditors(...args);
}

export async function setMarkdownPlaceholder(...args) {
  return (await loadEditorModule()).setMarkdownPlaceholder(...args);
}

export async function setMarkdownValue(...args) {
  return (await loadEditorModule()).setMarkdownValue(...args);
}

export async function getMarkdownValue(...args) {
  return (await loadEditorModule()).getMarkdownValue(...args);
}

export async function focusMarkdown(...args) {
  return (await loadEditorModule()).focusMarkdown(...args);
}
