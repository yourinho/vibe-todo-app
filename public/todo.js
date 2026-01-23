const API_URL = '/api/todos';
const AUTH_API = '/api';
const TAGS_API = '/api/tags';

// Палитра цветов для тегов (все с хорошей контрастностью для белого текста)
const TAG_COLORS = ['#4f46e5', '#7c3aed', '#059669', '#dc2626', '#ea580c', '#0d9488', '#6d28d9', '#be185d', '#ca8a04'];

const titleInput = document.getElementById('todoTitleInput');
const descriptionEditor = document.getElementById('todoDescriptionEditor');
const backBtn = document.getElementById('backToList');
const saveBtn = document.getElementById('saveTodoBtn');
const statusEl = document.getElementById('todoStatus');
const snackbarEl = document.getElementById('snackbar');
const statusDropdownWrap = document.getElementById('statusDropdownTodoWrap');
const statusDropdownTrigger = document.getElementById('statusDropdownTodoTrigger');
const statusDropdownMenu = document.getElementById('statusDropdownTodoMenu');
const statusDropdownValue = statusDropdownTrigger?.querySelector('.status-dropdown-todo-value');
const statusHiddenInput = document.getElementById('todoStatus');
const confirmExitModal = document.getElementById('confirmExitModal');
const confirmExitBtn = document.getElementById('confirmExitBtn');
const cancelExitBtn = document.getElementById('cancelExitBtn');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const timeInput = document.getElementById('timeInput');
const setTimeInput = document.getElementById('setTimeInput');
const addTimeBtn = document.getElementById('addTimeBtn');
const subtractTimeBtn = document.getElementById('subtractTimeBtn');
const setTimeBtn = document.getElementById('setTimeBtn');
const tagsListEl = document.getElementById('tagsList');
const addTagBtn = document.getElementById('addTagBtn');
const tagPickerEl = document.getElementById('tagPicker');
const tagPickerListEl = document.getElementById('tagPickerList');
const newTagNameInput = document.getElementById('newTagName');
const tagColorPaletteEl = document.getElementById('tagColorPalette');
const createTagBtn = document.getElementById('createTagBtn');
const commentsListEl = document.getElementById('commentsList');
const newCommentInput = document.getElementById('newCommentInput');
const addCommentBtn = document.getElementById('addCommentBtn');

let currentTodoId = null;
let currentTodoTags = [];
let savedText = '';
let savedDescription = '';
let savedStatus = 'backlog';
let hasUnsavedChanges = false;
let currentTotalTimeSeconds = 0;
const STATUS_LABELS = { backlog: 'Backlog', roadmap: 'Roadmap', sprint: 'Sprint', today: 'Today', waiting: 'Waiting', in_progress: 'In Progress', done: 'Done' };

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    setStatus('Не указан ID задачи', true);
    return;
  }

  currentTodoId = id;

  if (backBtn) {
    backBtn.addEventListener('click', handleBackClick);
  }

  if (confirmExitBtn) {
    confirmExitBtn.addEventListener('click', () => {
      hasUnsavedChanges = false;
      window.location.href = '/';
    });
  }

  if (cancelExitBtn) {
    cancelExitBtn.addEventListener('click', hideConfirmExitModal);
  }

  if (confirmExitModal) {
    confirmExitModal.addEventListener('click', (e) => {
      if (e.target === confirmExitModal) {
        hideConfirmExitModal();
      }
    });
  }

  // Предупреждение при закрытии страницы
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', saveTodo);
  }

  document.addEventListener('keydown', (e) => {
    const isSave =
      (e.key === 's' || e.key === 'S') && (e.metaKey || e.ctrlKey);
    if (isSave) {
      e.preventDefault();
      saveTodo();
    }
  });

  setupToolbar();
  setupResizeHandle();
  setupLinkDetection();
  setupTimeEditing();
  setupTagsUI();
  setupStatusDropdown();
  setupComments();

  // Сначала загружаем задачу (GET /api/todos/:id), затем проверка сессии
  await loadTodo();
  await ensureAuth();

  setupChangeTracking();
}

function setupToolbar() {
  if (!descriptionEditor) return;
  const toolbarButtons = document.querySelectorAll('.description-toolbar .toolbar-btn');

  toolbarButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      const value = btn.getAttribute('data-value') || null;

      descriptionEditor.focus();

      if (cmd === 'createLink') {
        const url = prompt('Введите URL ссылки:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
        return;
      }

      if (cmd === 'formatBlock' && value) {
        document.execCommand('formatBlock', false, value);
      } else {
        document.execCommand(cmd, false, value);
      }
    });
  });

  // Тулбар для комментариев
  const commentToolbarButtons = document.querySelectorAll('.comment-toolbar .toolbar-btn');
  commentToolbarButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!newCommentInput) return;
      
      const cmd = btn.getAttribute('data-cmd');
      const value = btn.getAttribute('data-value') || null;

      newCommentInput.focus();

      if (cmd === 'createLink') {
        const url = prompt('Введите URL ссылки:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
        return;
      }

      if (cmd === 'formatBlock' && value) {
        document.execCommand('formatBlock', false, value);
      } else {
        document.execCommand(cmd, false, value);
      }
    });
  });
}

function renderTags() {
  if (!tagsListEl) return;
  tagsListEl.innerHTML = '';
  currentTodoTags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.style.backgroundColor = tag.color;
    chip.innerHTML = `${escapeHtml(tag.name)} <span class="tag-chip-remove" data-tag-id="${tag.id}" title="Удалить">×</span>`;
    chip.querySelector('.tag-chip-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeTagFromTodo(tag.id);
    });
    tagsListEl.appendChild(chip);
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function setupTagsUI() {
  if (!addTagBtn || !tagPickerEl) return;

  addTagBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (tagPickerEl.style.display === 'block') {
      hideTagPicker();
    } else {
      showTagPicker();
    }
  });

  document.addEventListener('click', (e) => {
    if (tagPickerEl.style.display === 'block' && !tagPickerEl.contains(e.target) && e.target !== addTagBtn) {
      hideTagPicker();
    }
  });

  if (createTagBtn && newTagNameInput) {
    createTagBtn.addEventListener('click', () => createAndAddTag());
  }

  // Палитра цветов при первом открытии
  if (tagColorPaletteEl && tagColorPaletteEl.children.length === 0) {
    TAG_COLORS.forEach((c, i) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'tag-color-swatch';
      swatch.style.backgroundColor = c;
      swatch.title = c;
      swatch.dataset.color = c;
      if (i === 0) swatch.classList.add('selected');
      swatch.addEventListener('click', () => {
        tagColorPaletteEl.querySelectorAll('.tag-color-swatch').forEach((s) => s.classList.remove('selected'));
        swatch.classList.add('selected');
      });
      tagColorPaletteEl.appendChild(swatch);
    });
  }
}

function showTagPicker() {
  if (!tagPickerEl) return;
  fillTagPicker();
  tagPickerEl.style.display = 'block';
}

function hideTagPicker() {
  if (tagPickerEl) tagPickerEl.style.display = 'none';
  if (newTagNameInput) newTagNameInput.value = '';
}

function fillTagPicker() {
  if (!tagPickerListEl) return;
  tagPickerListEl.innerHTML = '';

  fetch(TAGS_API)
    .then((r) => (r.ok ? r.json() : []))
    .then((allTags) => {
      const existingIds = new Set(currentTodoTags.map((t) => t.id));
      const toShow = (allTags || []).filter((t) => !existingIds.has(t.id));
      if (toShow.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tag-picker-empty';
        empty.textContent = 'Нет доступных тегов. Создайте новый ниже.';
        tagPickerListEl.appendChild(empty);
      } else {
        toShow.forEach((tag) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'tag-picker-item';
          item.style.backgroundColor = tag.color;
          item.textContent = tag.name;
          item.dataset.tagId = tag.id;
          item.addEventListener('click', () => {
            addTagToTodo(tag.id, tag);
          });
          tagPickerListEl.appendChild(item);
        });
      }
    })
    .catch(() => {});
}

async function addTagToTodo(tagId, tagObj) {
  if (!currentTodoId) return;
  try {
    const res = await fetch(`${API_URL}/${currentTodoId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showSnackbar(d.error || 'Не удалось добавить тег', true);
      return;
    }
    const data = await res.json();
    const tag = data.tag || tagObj || { id: tagId, name: '', color: '#667eea' };
    currentTodoTags = [...currentTodoTags, { id: tag.id, name: tag.name, color: tag.color }];
    renderTags();
    fillTagPicker();
  } catch (e) {
    showSnackbar('Не удалось добавить тег', true);
  }
}

async function removeTagFromTodo(tagId) {
  if (!currentTodoId) return;
  try {
    const res = await fetch(`${API_URL}/${currentTodoId}/tags/${tagId}`, { method: 'DELETE' });
    if (!res.ok) {
      showSnackbar('Не удалось удалить тег', true);
      return;
    }
    currentTodoTags = currentTodoTags.filter((t) => t.id != tagId);
    renderTags();
    if (tagPickerEl && tagPickerEl.style.display === 'block') fillTagPicker();
  } catch (e) {
    showSnackbar('Не удалось удалить тег', true);
  }
}

async function createAndAddTag() {
  const name = (newTagNameInput && newTagNameInput.value || '').trim();
  if (!name) {
    showSnackbar('Введите название тега', true);
    return;
  }
  const palette = tagColorPaletteEl;
  const selected = palette && palette.querySelector('.tag-color-swatch.selected');
  const color = (selected && selected.dataset.color) || TAG_COLORS[0];

  try {
    const createRes = await fetch(TAGS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    if (!createRes.ok) {
      const d = await createRes.json().catch(() => ({}));
      showSnackbar(d.error || 'Не удалось создать тег', true);
      return;
    }
    const newTag = await createRes.json();
    await addTagToTodo(newTag.id, newTag);
    if (newTagNameInput) newTagNameInput.value = '';
  } catch (e) {
    showSnackbar('Не удалось создать тег', true);
  }
}

async function ensureAuth() {
  try {
    const response = await fetch(`${AUTH_API}/user`);
    if (!response.ok) {
      window.location.href = '/';
    }
  } catch (e) {
    console.error('Ошибка проверки авторизации на странице задачи:', e);
    window.location.href = '/';
  }
}

async function loadTodo() {
  try {
    const response = await fetch(`${API_URL}/${currentTodoId}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (response.status === 401) {
      window.location.href = '/';
      return;
    }

    if (!response.ok) {
      setStatus('Не удалось загрузить задачу', true);
      return;
    }

    const todo = await response.json();

    if (titleInput) {
      titleInput.value = todo.text || '';
    }

    if (descriptionEditor) {
      descriptionEditor.innerHTML = todo.description || '';
    }

    // Сохраняем начальное состояние
    savedText = todo.text || '';
    savedDescription = todo.description || '';
    savedStatus = todo.status_saved || todo.status || 'backlog';
    currentTotalTimeSeconds = todo.total_time_seconds || 0;
    currentTodoTags = todo.tags || [];
    hasUnsavedChanges = false;
    
    // Обновляем статус (показываем финальный, но сохраняем пользовательский)
    updateStatusDisplay(todo.status || 'backlog');
    if (statusHiddenInput) statusHiddenInput.value = savedStatus;
    
    updateTimeDisplay();
    updateStatusAndSaveButton();
    renderTags();
    await loadComments();
  } catch (e) {
    console.error('Ошибка загрузки задачи:', e);
    setStatus('Не удалось загрузить задачу', true);
  }
}

async function saveTodo() {
  const text = (titleInput?.value || '').trim();
  if (!text) {
    setStatus('Название задачи не может быть пустым', true);
    return;
  }

  let description = null;
  if (descriptionEditor) {
    const html = descriptionEditor.innerHTML.trim();
    const clean = html.replace(/<br>\s*$/i, '').trim();
    description = clean || null;
  }

  const status = statusHiddenInput?.value || 'backlog';

  try {
    const response = await fetch(`${API_URL}/${currentTodoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, description, status }),
    });

    if (response.status === 401) {
      window.location.href = '/';
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(`Ошибка сохранения: ${data.error || 'неизвестная ошибка'}`, true);
      showSnackbar('Не удалось сохранить задачу', true);
      return;
    }

    // Обновляем сохраненное состояние
    savedText = text;
    savedDescription = description;
    savedStatus = status;
    hasUnsavedChanges = false;
    
    updateStatusAndSaveButton();
    showSnackbar('Изменения сохранены');
  } catch (e) {
    console.error('Ошибка сохранения задачи:', e);
    setStatus('Не удалось сохранить задачу', true);
    showSnackbar('Не удалось сохранить задачу', true);
  }
}

function setupResizeHandle() {
  const resizeHandle = document.getElementById('resizeHandle');
  if (!resizeHandle || !descriptionEditor) return;

  let isResizing = false;
  let startY = 0;
  let startHeight = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = descriptionEditor.offsetHeight;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const diff = e.clientY - startY;
    const newHeight = Math.max(80, Math.min(600, startHeight + diff));
    descriptionEditor.style.height = `${newHeight}px`;
  });

  document.addEventListener('mouseup', () => {
    isResizing = false;
  });
}

function setupLinkDetection() {
  if (!descriptionEditor) return;

  // Обработка кликов по ссылкам
  descriptionEditor.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href) {
      e.preventDefault();
      e.stopPropagation();
      window.open(link.href, '_blank', 'noopener,noreferrer');
      return false;
    }
  });

  // Обработка вставки текста
  descriptionEditor.addEventListener('paste', (e) => {
    setTimeout(() => {
      detectAndConvertLinks();
      checkForChanges();
    }, 10);
  });

  // Обработка ввода текста
  descriptionEditor.addEventListener('input', () => {
    // Не обрабатываем при каждом вводе, только при потере фокуса
  });

  // Обработка потери фокуса
  descriptionEditor.addEventListener('blur', () => {
    detectAndConvertLinks();
    checkForChanges();
  });
}

function detectAndConvertLinks() {
  if (!descriptionEditor) return;

  // Получаем HTML содержимое
  let html = descriptionEditor.innerHTML;

  // Регулярное выражение для поиска URL (не внутри тегов <a>)
  // Ищем URL, которые еще не являются ссылками
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

  // Разбиваем HTML на части, чтобы не трогать существующие ссылки
  const parts = html.split(/(<a[^>]*>.*?<\/a>)/gi);
  
  const processedParts = parts.map((part) => {
    // Пропускаем уже существующие ссылки
    if (part.match(/^<a[^>]*>.*?<\/a>$/i)) {
      return part;
    }
    
    // Ищем URL в текстовой части
    return part.replace(urlRegex, (url) => {
      // Проверяем, не является ли URL уже частью ссылки
      // (простая проверка - если перед URL есть <a, значит это уже ссылка)
      const beforeUrl = part.substring(0, part.indexOf(url));
      if (beforeUrl.includes('<a')) {
        return url;
      }
      
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
  });

  const newHtml = processedParts.join('');
  
  // Обновляем только если что-то изменилось
  if (newHtml !== html) {
    // Сохраняем позицию курсора
    const selection = window.getSelection();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const offset = range ? range.startOffset : 0;
    
    descriptionEditor.innerHTML = newHtml;
    
    // Восстанавливаем позицию курсора (упрощенная версия)
    if (range && descriptionEditor.childNodes.length > 0) {
      try {
        const newRange = document.createRange();
        const textNode = descriptionEditor.childNodes[0];
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(textNode, Math.min(offset, textNode.textContent.length));
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      } catch (e) {
        // Игнорируем ошибки восстановления курсора
      }
    }
  }
}

function setupChangeTracking() {
  // Отслеживание изменений в названии
  if (titleInput) {
    titleInput.addEventListener('input', checkForChanges);
    titleInput.addEventListener('change', checkForChanges);
  }

  // Отслеживание изменений в описании
  if (descriptionEditor) {
    descriptionEditor.addEventListener('input', checkForChanges);
    descriptionEditor.addEventListener('paste', () => {
      setTimeout(() => {
        detectAndConvertLinks();
        checkForChanges();
      }, 10);
    });
  }
}

function checkForChanges() {
  const currentText = (titleInput?.value || '').trim();
  let currentDescription = '';
  
  if (descriptionEditor) {
    const html = descriptionEditor.innerHTML.trim();
    currentDescription = html.replace(/<br>\s*$/i, '').trim();
  }

  hasUnsavedChanges = 
    currentText !== savedText || 
    currentDescription !== savedDescription;

  updateStatusAndSaveButton();
}

function updateStatusAndSaveButton() {
  if (hasUnsavedChanges) {
    setStatus('Есть несохраненные изменения');
    if (saveBtn) {
      saveBtn.disabled = false;
    }
  } else {
    setStatus('Изменения сохранены');
    if (saveBtn) {
      saveBtn.disabled = true;
    }
  }
}

function handleBackClick() {
  if (hasUnsavedChanges) {
    showConfirmExitModal();
  } else {
    window.location.href = '/';
  }
}

function showConfirmExitModal() {
  if (confirmExitModal) {
    confirmExitModal.style.display = 'flex';
  }
}

function hideConfirmExitModal() {
  if (confirmExitModal) {
    confirmExitModal.style.display = 'none';
  }
}

function setupTimeEditing() {
  if (addTimeBtn) {
    addTimeBtn.addEventListener('click', () => updateTime('add'));
  }
  if (subtractTimeBtn) {
    subtractTimeBtn.addEventListener('click', () => updateTime('subtract'));
  }
  if (setTimeBtn) {
    setTimeBtn.addEventListener('click', () => updateTime('set'));
  }
  if (timeInput) {
    timeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          updateTime('subtract');
        } else {
          updateTime('add');
        }
      }
    });
  }
  if (setTimeInput) {
    setTimeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        updateTime('set');
      }
    });
  }
}

function parseTimeToSeconds(timeStr, isMinutes = false) {
  if (!timeStr) {
    return null;
  }
  
  // Если это поле для добавления/вычитания (минуты), парсим просто число
  if (isMinutes) {
    const minutes = parseFloat(timeStr);
    if (isNaN(minutes) || minutes < 0) {
      return null;
    }
    return Math.floor(minutes * 60); // конвертируем минуты в секунды
  }
  
  // Для поля установки времени - парсим формат HH:MM:SS
  if (!timeStr.match(/^\d{1,2}:[0-5]\d:[0-5]\d$/)) {
    return null;
  }
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function formatSeconds(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  return `${hStr}:${mStr}:${sStr}`;
}

function updateTimeDisplay() {
  if (currentTimeDisplay) {
    currentTimeDisplay.textContent = formatSeconds(currentTotalTimeSeconds);
  }
}

async function updateTime(operation) {
  let inputElement = null;
  let seconds = 0;
  let isMinutes = false;

  if (operation === 'set') {
    inputElement = setTimeInput;
    isMinutes = false; // для установки времени используем формат HH:MM:SS
  } else {
    inputElement = timeInput;
    isMinutes = true; // для добавления/вычитания используем минуты
  }

  if (!inputElement) {
    console.error('Input element not found for operation:', operation);
    return;
  }

  const timeStr = inputElement.value.trim();
  if (!timeStr) {
    showSnackbar('Введите время', true);
    return;
  }

  seconds = parseTimeToSeconds(timeStr, isMinutes);
  if (seconds === null) {
    if (isMinutes) {
      showSnackbar('Введите число минут (например: 30 или 120)', true);
    } else {
      showSnackbar('Неверный формат времени. Используйте HH:MM:SS', true);
    }
    return;
  }

  if (!currentTodoId) {
    console.error('currentTodoId is not set');
    showSnackbar('Ошибка: ID задачи не найден', true);
    return;
  }

  try {
    const requestBody = { operation, seconds };
    console.log('Sending update-time request:', { todoId: currentTodoId, ...requestBody });

    const response = await fetch(`${API_URL}/${currentTodoId}/update-time`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);

    if (response.status === 401) {
      window.location.href = '/';
      return;
    }

    if (!response.ok) {
      let errorMessage = 'неизвестная ошибка';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          errorMessage = data.error || `Ошибка ${response.status}`;
        } else {
          const text = await response.text();
          errorMessage = text || `Ошибка ${response.status}: ${response.statusText}`;
        }
      } catch (e) {
        console.error('Error parsing error response:', e);
        errorMessage = `Ошибка ${response.status}: ${response.statusText}`;
      }
      console.error('Ошибка обновления времени:', errorMessage);
      showSnackbar(`Ошибка: ${errorMessage}`, true);
      return;
    }

    const result = await response.json();
    console.log('Update-time result:', result);
    currentTotalTimeSeconds = result.total_time_seconds || 0;
    updateTimeDisplay();
    
    // Очищаем поля ввода
    if (timeInput) timeInput.value = '';
    if (setTimeInput) setTimeInput.value = '';

    const operationText = {
      add: 'добавлено',
      subtract: 'вычтено',
      set: 'установлено'
    }[operation] || 'изменено';

    showSnackbar(`Время ${operationText}: ${formatSeconds(seconds)}`);
  } catch (e) {
    console.error('Ошибка обновления времени:', e);
    showSnackbar(`Ошибка: ${e.message || 'Не удалось обновить время'}`, true);
  }
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#e03131' : '#777';
}

function setupStatusDropdown() {
  if (!statusDropdownWrap || !statusDropdownTrigger || !statusDropdownMenu) return;

  const items = statusDropdownMenu.querySelectorAll('.status-dropdown-todo-item');

  function openMenu() {
    updateMenuSelection();
    statusDropdownMenu.style.minWidth = Math.max(136, statusDropdownTrigger.offsetWidth) + 'px';
    statusDropdownMenu.classList.add('is-open');
    statusDropdownWrap.setAttribute('data-open', 'true');
    statusDropdownTrigger.setAttribute('aria-expanded', 'true');
    statusDropdownMenu.setAttribute('aria-hidden', 'false');
  }

  function closeMenu() {
    statusDropdownMenu.classList.remove('is-open');
    statusDropdownWrap.setAttribute('data-open', 'false');
    statusDropdownTrigger.setAttribute('aria-expanded', 'false');
    statusDropdownMenu.setAttribute('aria-hidden', 'true');
  }

  function toggleMenu() {
    if (statusDropdownMenu.classList.contains('is-open')) closeMenu();
    else openMenu();
  }

  function updateMenuSelection() {
    const value = statusHiddenInput?.value || 'backlog';
    items.forEach((el) => {
      const selected = el.dataset.value === value;
      el.classList.toggle('is-selected', selected);
      el.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  function selectItem(item) {
    const value = item.dataset.value;
    const textEl = item.querySelector('.status-dropdown-todo-item-text');
    const text = (textEl && textEl.textContent.trim()) || STATUS_LABELS[value] || value;
    if (statusHiddenInput) statusHiddenInput.value = value;
    if (statusDropdownValue) statusDropdownValue.textContent = text;
    savedStatus = value;
    hasUnsavedChanges = true;
    updateStatusAndSaveButton();
    closeMenu();
  }

  statusDropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  items.forEach((item) => {
    item.addEventListener('click', () => selectItem(item));
  });

  document.addEventListener('click', (e) => {
    if (statusDropdownMenu.classList.contains('is-open') && !statusDropdownWrap.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && statusDropdownMenu.classList.contains('is-open')) closeMenu();
  });
}

function updateStatusDisplay(finalStatus) {
  // Показываем финальный статус (может быть in_progress или done)
  const label = STATUS_LABELS[finalStatus] || finalStatus;
  if (statusDropdownValue) statusDropdownValue.textContent = label;
  
  // Если статус in_progress или done, делаем дропдаун неактивным (readonly)
  const isReadonly = finalStatus === 'in_progress' || finalStatus === 'done';
  if (statusDropdownTrigger) {
    statusDropdownTrigger.disabled = isReadonly;
    statusDropdownTrigger.style.opacity = isReadonly ? '0.6' : '1';
    statusDropdownTrigger.style.cursor = isReadonly ? 'not-allowed' : 'pointer';
  }
}

// Комментарии к задаче
function setupComments() {
  if (addCommentBtn) {
    addCommentBtn.addEventListener('click', addComment);
  }
  if (newCommentInput) {
    // Placeholder для contenteditable
    newCommentInput.addEventListener('focus', () => {
      if (!newCommentInput.textContent.trim()) {
        newCommentInput.classList.add('empty');
      }
    });
    newCommentInput.addEventListener('blur', () => {
      if (!newCommentInput.textContent.trim()) {
        newCommentInput.classList.add('empty');
      } else {
        newCommentInput.classList.remove('empty');
      }
    });
    newCommentInput.addEventListener('input', () => {
      if (newCommentInput.textContent.trim()) {
        newCommentInput.classList.remove('empty');
      }
    });
    
    newCommentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        addComment();
      }
    });
  }
}

async function loadComments() {
  if (!currentTodoId || !commentsListEl) return;
  
  try {
    const response = await fetch(`${API_URL}/${currentTodoId}/comments`, {
      credentials: 'include',
      cache: 'no-store'
    });
    
    if (response.status === 401) {
      window.location.href = '/';
      return;
    }
    
    if (!response.ok) {
      console.error('Ошибка загрузки комментариев:', response.status);
      return;
    }
    
    const comments = await response.json();
    renderComments(comments || []);
  } catch (e) {
    console.error('Ошибка загрузки комментариев:', e);
  }
}

function renderComments(comments) {
  if (!commentsListEl) return;
  
  commentsListEl.innerHTML = '';
  
  if (comments.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'comments-empty';
    emptyMsg.textContent = 'Пока нет комментариев';
    commentsListEl.appendChild(emptyMsg);
    return;
  }
  
  comments.forEach((comment) => {
    const commentEl = createCommentElement(comment);
    commentsListEl.appendChild(commentEl);
  });
}

function createCommentElement(comment) {
  const commentDiv = document.createElement('div');
  commentDiv.className = 'comment-item';
  commentDiv.dataset.commentId = comment.id;
  
  const isEdited = comment.updated_at && comment.updated_at !== comment.created_at;
  const date = new Date(isEdited ? comment.updated_at : comment.created_at);
  const dateStr = date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Используем innerHTML для сохранения форматирования (HTML из БД)
  commentDiv.innerHTML = `
    <div class="comment-content">
      <div class="comment-text" data-comment-id="${comment.id}">${comment.text || ''}</div>
      <div class="comment-meta">
        <span class="comment-date">${dateStr}${isEdited ? ' (изменено)' : ''}</span>
        <div class="comment-actions">
          <button class="comment-edit-btn" data-comment-id="${comment.id}">Редактировать</button>
          <button class="comment-delete-btn" data-comment-id="${comment.id}">Удалить</button>
        </div>
      </div>
    </div>
  `;
  
  const editBtn = commentDiv.querySelector('.comment-edit-btn');
  const deleteBtn = commentDiv.querySelector('.comment-delete-btn');
  const textEl = commentDiv.querySelector('.comment-text');
  
  editBtn.addEventListener('click', () => editComment(comment.id, comment.text, commentDiv));
  deleteBtn.addEventListener('click', () => deleteComment(comment.id));
  
  return commentDiv;
}

async function addComment() {
  if (!currentTodoId || !newCommentInput) return;
  
  // Для contenteditable получаем innerHTML или textContent
  const html = newCommentInput.innerHTML.trim();
  const text = newCommentInput.textContent.trim();
  
  if (!text) {
    showSnackbar('Введите текст комментария', true);
    return;
  }
  
  // Используем HTML для сохранения форматирования, но проверяем на пустоту по тексту
  const commentText = html || text;
  
  try {
    const response = await fetch(`${API_URL}/${currentTodoId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: commentText }),
      credentials: 'include'
    });
    
    if (response.status === 401) {
      window.location.href = '/';
      return;
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showSnackbar(`Ошибка: ${error.error || 'Не удалось добавить комментарий'}`, true);
      return;
    }
    
    newCommentInput.innerHTML = '';
    await loadComments();
    showSnackbar('Комментарий добавлен');
  } catch (e) {
    console.error('Ошибка добавления комментария:', e);
    showSnackbar('Не удалось добавить комментарий', true);
  }
}

function editComment(commentId, currentText, commentDiv) {
  const textEl = commentDiv.querySelector('.comment-text');
  const editBtn = commentDiv.querySelector('.comment-edit-btn');
  const deleteBtn = commentDiv.querySelector('.comment-delete-btn');
  
  // Создаем contenteditable div с тулбаром для редактирования
  const editWrapper = document.createElement('div');
  editWrapper.className = 'comment-edit-wrapper';
  
  const editToolbar = document.createElement('div');
  editToolbar.className = 'comment-edit-toolbar';
  editToolbar.innerHTML = `
    <button type="button" class="toolbar-btn" data-cmd="bold" data-target="edit-comment"><b>B</b></button>
    <button type="button" class="toolbar-btn" data-cmd="italic" data-target="edit-comment"><i>I</i></button>
    <button type="button" class="toolbar-btn" data-cmd="underline" data-target="edit-comment"><u>U</u></button>
    <button type="button" class="toolbar-btn" data-cmd="strikeThrough" data-target="edit-comment"><s>S</s></button>
    <button type="button" class="toolbar-btn" data-cmd="insertUnorderedList" data-target="edit-comment">• Список</button>
    <button type="button" class="toolbar-btn" data-cmd="formatBlock" data-value="h3" data-target="edit-comment">H3</button>
    <button type="button" class="toolbar-btn" data-cmd="createLink" data-target="edit-comment">Ссылка</button>
  `;
  
  const editInput = document.createElement('div');
  editInput.className = 'comment-edit-input';
  editInput.contentEditable = 'true';
  editInput.innerHTML = currentText || '';
  
  editWrapper.appendChild(editToolbar);
  editWrapper.appendChild(editInput);
  
  // Настраиваем тулбар для редактирования
  const editToolbarButtons = editToolbar.querySelectorAll('.toolbar-btn');
  editToolbarButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      const value = btn.getAttribute('data-value') || null;
      
      editInput.focus();
      
      if (cmd === 'createLink') {
        const url = prompt('Введите URL ссылки:');
        if (url) {
          document.execCommand('createLink', false, url);
        }
        return;
      }
      
      if (cmd === 'formatBlock' && value) {
        document.execCommand('formatBlock', false, value);
      } else {
        document.execCommand(cmd, false, value);
      }
    });
  });
  
  // Заменяем текст на редактор
  textEl.style.display = 'none';
  textEl.parentNode.insertBefore(editWrapper, textEl);
  editInput.focus();
  
  // Устанавливаем курсор в конец
  const range = document.createRange();
  range.selectNodeContents(editInput);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Создаем кнопки сохранения/отмены
  const saveBtn = document.createElement('button');
  saveBtn.className = 'comment-save-btn';
  saveBtn.textContent = 'Сохранить';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'comment-cancel-btn';
  cancelBtn.textContent = 'Отмена';
  
  const actionsDiv = commentDiv.querySelector('.comment-actions');
  editBtn.style.display = 'none';
  deleteBtn.style.display = 'none';
  actionsDiv.appendChild(saveBtn);
  actionsDiv.appendChild(cancelBtn);
  
  const saveHandler = async () => {
    const html = editInput.innerHTML.trim();
    const text = editInput.textContent.trim();
    
    if (!text) {
      showSnackbar('Текст комментария не может быть пустым', true);
      return;
    }
    
    const newText = html || text;
    
    try {
      const response = await fetch(`${API_URL}/${currentTodoId}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newText }),
        credentials: 'include'
      });
      
      if (response.status === 401) {
        window.location.href = '/';
        return;
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        showSnackbar(`Ошибка: ${error.error || 'Не удалось обновить комментарий'}`, true);
        return;
      }
      
      await loadComments();
      showSnackbar('Комментарий обновлен');
    } catch (e) {
      console.error('Ошибка обновления комментария:', e);
      showSnackbar('Не удалось обновить комментарий', true);
    }
  };
  
  const cancelHandler = () => {
    editWrapper.remove();
    textEl.style.display = '';
    saveBtn.remove();
    cancelBtn.remove();
    editBtn.style.display = '';
    deleteBtn.style.display = '';
  };
  
  saveBtn.addEventListener('click', saveHandler);
  cancelBtn.addEventListener('click', cancelHandler);
  
  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveHandler();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelHandler();
    }
  });
}

async function deleteComment(commentId) {
  if (!currentTodoId) return;
  
  if (!confirm('Удалить этот комментарий?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/${currentTodoId}/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (response.status === 401) {
      window.location.href = '/';
      return;
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showSnackbar(`Ошибка: ${error.error || 'Не удалось удалить комментарий'}`, true);
      return;
    }
    
    await loadComments();
    showSnackbar('Комментарий удален');
  } catch (e) {
    console.error('Ошибка удаления комментария:', e);
    showSnackbar('Не удалось удалить комментарий', true);
  }
}

function showSnackbar(message, isError = false) {
  if (!snackbarEl) return;
  snackbarEl.textContent = message;
  snackbarEl.classList.toggle('error', !!isError);
  snackbarEl.classList.add('show');

  clearTimeout(showSnackbar.timeoutId);
  showSnackbar.timeoutId = setTimeout(() => {
    snackbarEl.classList.remove('show');
  }, 2500);
}
