const API_URL = '/api/todos';
const AUTH_API = '/api';

const titleInput = document.getElementById('todoTitleInput');
const descriptionEditor = document.getElementById('todoDescriptionEditor');
const backBtn = document.getElementById('backToList');
const saveBtn = document.getElementById('saveTodoBtn');
const statusEl = document.getElementById('todoStatus');
const snackbarEl = document.getElementById('snackbar');

let currentTodoId = null;

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
    backBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

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

  await ensureAuth();
  await loadTodo();
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

    setStatus('Задача загружена');
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
      return;
    }

    setStatus('Изменения сохранены');
  } catch (e) {
    console.error('Ошибка сохранения задачи:', e);
    setStatus('Не удалось сохранить задачу', true);
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
