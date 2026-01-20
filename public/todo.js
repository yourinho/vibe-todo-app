const API_URL = '/api/todos';
const AUTH_API = '/api';

const titleInput = document.getElementById('todoTitleInput');
const descriptionEditor = document.getElementById('todoDescriptionEditor');
const backBtn = document.getElementById('backToList');
const saveBtn = document.getElementById('saveTodoBtn');
const statusEl = document.getElementById('todoStatus');
const snackbarEl = document.getElementById('snackbar');
const confirmExitModal = document.getElementById('confirmExitModal');
const confirmExitBtn = document.getElementById('confirmExitBtn');
const cancelExitBtn = document.getElementById('cancelExitBtn');

let currentTodoId = null;
let savedText = '';
let savedDescription = '';
let hasUnsavedChanges = false;

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

  await ensureAuth();
  await loadTodo();
  
  // Отслеживание изменений
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
    const response = await fetch(`${API_URL}/${currentTodoId}`);
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
    hasUnsavedChanges = false;
    
    updateStatusAndSaveButton();
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

  try {
    const response = await fetch(`${API_URL}/${currentTodoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, description }),
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

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#e03131' : '#777';
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
