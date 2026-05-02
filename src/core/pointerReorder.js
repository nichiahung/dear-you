const DRAG_THRESHOLD = 6;
const DRAG_SETTLE_MS = 180;
const DEFAULT_GHOST_MAX = 180;
const VIEWPORT_PADDING = 12;
const ACTIVE_CONTAINER_CLASS = 'reorder-active';

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.('button, textarea, input, select, audio, a'));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function indexForElement(element) {
  const index = Number(element?.dataset?.reorderIndex);
  return Number.isInteger(index) ? index : null;
}

function moveIndex(indices, fromIndex, toIndex) {
  const next = [...indices];
  const fromPosition = next.indexOf(fromIndex);
  const toPosition = next.indexOf(toIndex);
  if (fromPosition < 0 || toPosition < 0) return next;
  const [item] = next.splice(fromPosition, 1);
  next.splice(toPosition, 0, item);
  return next;
}

function nearestIndex(items, x, y) {
  let winner = null;
  let winnerDistance = Infinity;
  items.forEach(item => {
    const rect = item.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const distance = Math.hypot(cx - x, cy - y);
    if (distance < winnerDistance) {
      winnerDistance = distance;
      winner = indexForElement(item);
    }
  });
  return winner;
}

function clearItemTransforms(items) {
  items.forEach(item => {
    item.classList.remove('reorder-moving', 'reorder-pressing', 'drag-over', 'drag-source', 'reorder-insert-before', 'reorder-insert-after', 'reorder-boundary');
    item.style.removeProperty('--reorder-x');
    item.style.removeProperty('--reorder-y');
    item.style.removeProperty('transform');
    item.style.removeProperty('transition');
  });
}

function clampPosition(value, size, max) {
  return Math.max(VIEWPORT_PADDING, Math.min(max - size - VIEWPORT_PADDING, value));
}

function defaultGhostRect(rect, x, y) {
  const scale = Math.min(1, DEFAULT_GHOST_MAX / rect.width, DEFAULT_GHOST_MAX / rect.height);
  const width = Math.max(72, Math.round(rect.width * scale));
  const height = Math.max(72, Math.round(rect.height * scale));
  return {
    width,
    height,
    left: clampPosition(x - width / 2, width, window.innerWidth),
    top: clampPosition(y - height / 2, height, window.innerHeight),
    grabX: width / 2,
    grabY: height / 2
  };
}

function normalizeGhostRect(rect, sourceRect, x, y) {
  const width = Math.round(rect?.width || sourceRect.width);
  const height = Math.round(rect?.height || sourceRect.height);
  return {
    width,
    height,
    left: Number.isFinite(rect?.left) ? rect.left : clampPosition(x - width / 2, width, window.innerWidth),
    top: Number.isFinite(rect?.top) ? rect.top : clampPosition(y - height / 2, height, window.innerHeight),
    grabX: Number.isFinite(rect?.grabX) ? rect.grabX : width / 2,
    grabY: Number.isFinite(rect?.grabY) ? rect.grabY : height / 2
  };
}

function makeGhost(source, rect, x, y, context, getGhostRect) {
  const ghostRect = normalizeGhostRect(
    getGhostRect?.({ source, sourceRect: rect, x, y, context }) || defaultGhostRect(rect, x, y),
    rect,
    x,
    y
  );
  const ghost = source.cloneNode(true);
  ghost.classList.remove('main', 'supporting');
  ghost.classList.add('reorder-drag-ghost', 'reorder-ghost-compact');
  if (context?.surface) ghost.classList.add(`reorder-ghost-${context.surface}`);
  ghost.style.width = `${ghostRect.width}px`;
  ghost.style.height = `${ghostRect.height}px`;
  ghost.style.setProperty('--ghost-scale', context?.surface === 'browser' ? '1.085' : '1.045');
  ghost.style.setProperty('--ghost-rotate', context?.surface === 'browser' ? '-1.8deg' : '-0.8deg');
  ghost.style.transform = `translate3d(${ghostRect.left}px, ${ghostRect.top}px, 0) scale(var(--ghost-scale)) rotate(var(--ghost-rotate))`;
  ghost.style.setProperty('--grab-x', `${ghostRect.grabX}px`);
  ghost.style.setProperty('--grab-y', `${ghostRect.grabY}px`);
  document.body.appendChild(ghost);
  return ghost;
}

export function createPointerReorder({
  itemSelector,
  getItems,
  getGhostRect,
  onReorder,
  canReorder,
  onDragStart,
  onDragEnd,
  onAnnounce
}) {
  let state = null;

  function itemsFor(context) {
    return [...(getItems?.(context) || [])].filter(item => item?.isConnected);
  }

  function setGhostPosition(x, y) {
    if (!state?.ghost) return;
    const grabX = Number.parseFloat(state.ghost.style.getPropertyValue('--grab-x')) || 0;
    const grabY = Number.parseFloat(state.ghost.style.getPropertyValue('--grab-y')) || 0;
    state.ghost.style.transform = `translate3d(${x - grabX}px, ${y - grabY}px, 0) scale(var(--ghost-scale, 1.035)) rotate(var(--ghost-rotate, 0deg))`;
  }

  function applyTransforms() {
    const { items, indices, sourceIndex, currentIndex, rects } = state;
    const visualOrder = moveIndex(indices, sourceIndex, currentIndex);
    items.forEach(item => {
      const itemIndex = indexForElement(item);
      if (itemIndex === sourceIndex) return;
      const fromPosition = indices.indexOf(itemIndex);
      const toPosition = visualOrder.indexOf(itemIndex);
      const fromRect = rects[fromPosition];
      const toRect = rects[toPosition];
      if (!fromRect || !toRect) return;
      const dx = toRect.left - fromRect.left;
      const dy = toRect.top - fromRect.top;
      item.classList.add('reorder-moving');
      item.style.setProperty('--reorder-x', `${dx}px`);
      item.style.setProperty('--reorder-y', `${dy}px`);
      item.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      item.classList.toggle('drag-over', itemIndex === currentIndex);
      item.classList.toggle('reorder-insert-before', itemIndex === currentIndex && currentIndex < sourceIndex);
      item.classList.toggle('reorder-insert-after', itemIndex === currentIndex && currentIndex > sourceIndex);
    });
  }

  function updateTarget(x, y) {
    const hovered = document.elementFromPoint(x, y)?.closest?.(itemSelector);
    const hoveredIndex = state.items.includes(hovered) ? indexForElement(hovered) : null;
    const nextIndex = Number.isInteger(hoveredIndex) ? hoveredIndex : nearestIndex(state.items, x, y);
    if (!Number.isInteger(nextIndex) || nextIndex === state.currentIndex) return;
    state.currentIndex = nextIndex;
    applyTransforms();
  }

  function activate(event) {
    const sourceRect = state.source.getBoundingClientRect();
    state.items = itemsFor(state.context);
    state.indices = state.items.map(indexForElement).filter(Number.isInteger);
    if (!state.indices.includes(state.sourceIndex)) {
      state.source.classList.remove('reorder-pressing', 'show-tools');
      state = null;
      return;
    }
    state.rects = state.items.map(item => item.getBoundingClientRect());
    state.ghost = makeGhost(state.source, sourceRect, event.clientX, event.clientY, state.context, getGhostRect);
    state.active = true;
    state.container = state.source.parentElement;
    state.container?.classList.add(ACTIVE_CONTAINER_CLASS);
    if (state.context?.surface) state.container?.classList.add(`${ACTIVE_CONTAINER_CLASS}-${state.context.surface}`);
    state.source.classList.remove('reorder-pressing');
    state.source.classList.add('dragging', 'drag-source', 'show-tools');
    state.source.setPointerCapture?.(state.pointerId);
    onDragStart?.(state.context);
    setGhostPosition(event.clientX, event.clientY);
    applyTransforms();
  }

  function handlePointerMove(event) {
    if (!state || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      activate(event);
    }
    if (!state?.active) return;
    event.preventDefault();
    setGhostPosition(event.clientX, event.clientY);
    updateTarget(event.clientX, event.clientY);
  }

  async function finish({ commit }) {
    if (!state) return;
    const currentState = state;
    state = null;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('pointercancel', handlePointerCancel);

    if (!currentState.active) {
      currentState.source.classList.remove('reorder-pressing', 'show-tools');
      currentState.container?.classList.remove(ACTIVE_CONTAINER_CLASS, `${ACTIVE_CONTAINER_CLASS}-${currentState.context?.surface}`);
      onDragEnd?.(currentState.context, false);
      return;
    }

    const canCommit = commit && currentState.currentIndex !== currentState.sourceIndex
      ? canReorder?.(currentState.sourceIndex, currentState.currentIndex, currentState.context) !== false
      : Boolean(commit);
    const targetIndex = canCommit ? currentState.currentIndex : currentState.sourceIndex;
    const targetPosition = currentState.indices.indexOf(targetIndex);
    const targetRect = currentState.rects[targetPosition] || currentState.rects[currentState.indices.indexOf(currentState.sourceIndex)];
    const reduced = prefersReducedMotion();
    if (currentState.ghost && targetRect && !reduced) {
      if (!canCommit && commit) currentState.ghost.classList.add('reorder-boundary');
      currentState.ghost.style.transition = `transform ${DRAG_SETTLE_MS}ms var(--ease-page), width ${DRAG_SETTLE_MS}ms var(--ease-page), height ${DRAG_SETTLE_MS}ms var(--ease-page), border-color 120ms var(--ease-soft)`;
      currentState.ghost.style.width = `${targetRect.width}px`;
      currentState.ghost.style.height = `${targetRect.height}px`;
      currentState.ghost.style.transform = `translate3d(${targetRect.left}px, ${targetRect.top}px, 0) scale(1)`;
      await wait(DRAG_SETTLE_MS);
    }

    currentState.ghost?.remove();
    clearItemTransforms(currentState.items);
    currentState.container?.classList.remove(ACTIVE_CONTAINER_CLASS, `${ACTIVE_CONTAINER_CLASS}-${currentState.context?.surface}`);
    currentState.source.classList.remove('dragging', 'drag-source', 'reorder-pressing', 'show-tools');

    if (canCommit && targetIndex !== currentState.sourceIndex) {
      const result = await onReorder?.(currentState.sourceIndex, targetIndex, currentState.context);
      if (result !== false) onAnnounce?.(`照片已移到第 ${targetIndex + 1} 張`);
    }
    onDragEnd?.(currentState.context, Boolean(canCommit));
  }

  function handlePointerUp(event) {
    if (!state || event.pointerId !== state.pointerId) return;
    if (state.active) event.preventDefault();
    finish({ commit: state.active });
  }

  function handlePointerCancel(event) {
    if (!state || event.pointerId !== state.pointerId) return;
    finish({ commit: false });
  }

  function start(event, sourceIndex, context = {}) {
    if (state) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (isInteractiveTarget(event.target)) return;
    const source = event.currentTarget;
    source.classList.add('reorder-pressing', 'show-tools');
    state = {
      active: false,
      context,
      currentIndex: sourceIndex,
      source,
      sourceIndex,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
  }

  function cancel() {
    if (!state) return;
    finish({ commit: false });
  }

  return { cancel, start };
}
