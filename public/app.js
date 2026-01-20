const API_URL = '/api/todos';
const AUTH_API = '/api';

// Элементы DOM для авторизации
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');
const usernameDisplay = document.getElementById('usernameDisplay');

// Элементы DOM для задач
const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');

// Элементы DOM для модального окна переключения задачи
const modalOverlay = document.getElementById('modalOverlay');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel = document.getElementById('modalCancel');
const modalText = document.getElementById('modalText');

// Элементы DOM для модального окна лога задачи
const logModalOverlay = document.getElementById('logModalOverlay');
const logModalTitle = document.getElementById('logModalTitle');
const logList = document.getElementById('logList');
const logModalClose = document.getElementById('logModalClose');

// Проверка авторизации при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
  // Авторизация
  loginBtn.addEventListener('click', handleLogin);
  registerBtn.addEventListener('click', handleRegister);
  showRegister.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
  showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });
  logoutBtn.addEventListener('click', handleLogout);

  // Задачи
  addBtn.addEventListener('click', addTodo);
  todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  });

  // Модальное окно переключения задачи
  if (modalConfirm && modalCancel && modalOverlay) {
    modalConfirm.addEventListener('click', handleModalConfirm);
    modalCancel.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        hideModal();
      }
    });
  }


  // Модальное окно лога
  if (logModalOverlay && logModalClose) {
    logModalClose.addEventListener('click', hideLogModal);
    logModalOverlay.addEventListener('click', (e) => {
      if (e.target === logModalOverlay) {
        hideLogModal();
      }
    });
  }
}

// Проверка авторизации
async function checkAuth() {
  try {
    const response = await fetch(`${AUTH_API}/user`);
    if (response.ok) {
      const data = await response.json();
      showApp(data.user);
    } else {
      showAuth();
    }
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    showAuth();
  }
}

// Показать форму авторизации
function showAuth() {
  authContainer.style.display = 'block';
  appContainer.style.display = 'none';
  showLoginForm();
}

// Показать приложение
function showApp(user) {
  authContainer.style.display = 'none';
  appContainer.style.display = 'block';
  usernameDisplay.textContent = `Привет, ${user.username}!`;
  loadTodos();
}

// Показать форму входа
function showLoginForm() {
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

// Показать форму регистрации
function showRegisterForm() {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
  document.getElementById('registerUsername').value = '';
  document.getElementById('registerPassword').value = '';
}

// Обработка входа
async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    alert('Введите логин и пароль');
    return;
  }

  try {
    const response = await fetch(`${AUTH_API}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      showApp(data.user);
    } else {
      alert('Ошибка: ' + data.error);
    }
  } catch (error) {
    console.error('Ошибка входа:', error);
    alert('Не удалось войти');
  }
}

// Обработка регистрации
async function handleRegister() {
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;

  if (!username || !password) {
    alert('Введите логин и пароль');
    return;
  }

  try {
    const response = await fetch(`${AUTH_API}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      showApp(data.user);
    } else {
      alert('Ошибка: ' + data.error);
    }
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    alert('Не удалось зарегистрироваться');
  }
}

// Обработка выхода
async function handleLogout() {
  try {
    const response = await fetch(`${AUTH_API}/logout`, {
      method: 'POST'
    });

    if (response.ok) {
      showAuth();
    } else {
      alert('Ошибка при выходе');
    }
  } catch (error) {
    console.error('Ошибка выхода:', error);
    alert('Не удалось выйти');
  }
}

// Хранилище активных интервалов таймера на клиенте
const activeTimers = {};

// Текущее состояние задач и отложенный старт
let currentTodos = [];
let pendingStartTodoId = null;
let pendingActiveTodoId = null;

// Загрузка всех задач
async function loadTodos() {
  try {
    const response = await fetch(API_URL);
    if (response.status === 401) {
      showAuth();
      return;
    }
    const todos = await response.json();
    currentTodos = todos;
    renderTodos(todos);
  } catch (error) {
    console.error('Ошибка загрузки задач:', error);
  }
}

// Форматирование секунд в HH:MM:SS
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

// Очищаем все интервалы таймеров
function clearAllClientTimers() {
  Object.values(activeTimers).forEach((intervalId) => {
    clearInterval(intervalId);
  });
  Object.keys(activeTimers).forEach((key) => {
    delete activeTimers[key];
  });
}

// Получить текущую активную задачу (с запущенным таймером)
function getActiveTimerTodo() {
  if (!Array.isArray(currentTodos)) return null;
  return currentTodos.find(
    (t) => t.timer_started_at && !t.completed
  ) || null;
}

// Обработчик нажатия на "Старт" с учётом единственной активной задачи
function handleStartClick(todoId) {
  const active = getActiveTimerTodo();

  // Если нет активной задачи или жмём старт по той же самой — просто запускаем
  if (!active || active.id === todoId) {
    startTimer(todoId);
    return;
  }

  // Есть другая активная задача — показываем модалку подтверждения переключения
  pendingStartTodoId = todoId;
  pendingActiveTodoId = active.id;

  if (modalText) {
    modalText.textContent =
      'У вас уже запущен таймер по другой задаче. Поставить её на паузу и начать новую?';
  }

  showModal();
}

function showModal() {
  if (modalOverlay) {
    modalOverlay.style.display = 'flex';
  }
}

function hideModal() {
  if (modalOverlay) {
    modalOverlay.style.display = 'none';
  }
  pendingStartTodoId = null;
  pendingActiveTodoId = null;
}

async function handleModalConfirm() {
  if (!pendingStartTodoId || !pendingActiveTodoId) {
    hideModal();
    return;
  }

  const fromId = pendingActiveTodoId;
  const toId = pendingStartTodoId;

  hideModal();

  // Ставим текущую задачу на паузу и запускаем новую
  await pauseTimer(fromId);
  await startTimer(toId);
}

function showLogModal() {
  if (logModalOverlay) {
    logModalOverlay.style.display = 'flex';
  }
}

function hideLogModal() {
  if (logModalOverlay) {
    logModalOverlay.style.display = 'none';
  }
  if (logList) {
    logList.innerHTML = '';
  }
}

// Форматирование секунд в HH:MM:SS (для использования в логах)
function formatSecondsForLog(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  return `${hStr}:${mStr}:${sStr}`;
}

function formatLogEvent(eventType, secondsChange) {
  switch (eventType) {
    case 'start':
      return 'Старт таймера';
    case 'pause':
      return 'Пауза таймера';
    case 'manual_add':
      const addTime = formatSecondsForLog(Math.abs(secondsChange || 0));
      return `Добавлено времени: ${addTime}`;
    case 'manual_subtract':
      const subTime = formatSecondsForLog(Math.abs(secondsChange || 0));
      return `Вычтено времени: ${subTime}`;
    case 'manual_set':
      const setTime = formatSecondsForLog(Math.abs(secondsChange || 0));
      return `Установлено время: ${setTime}`;
    default:
      return eventType;
  }
}

async function openTodoLog(id, text) {
  try {
    const response = await fetch(`${API_URL}/${id}/logs`);

    if (response.status === 401) {
      showAuth();
      return;
    }

    const logs = await response.json();

    if (logModalTitle) {
      const shortText = text && text.length > 40 ? `${text.slice(0, 37)}...` : text;
      logModalTitle.textContent = shortText ? `Лог: ${shortText}` : 'Лог задачи';
    }

    if (logList) {
      logList.innerHTML = '';

      if (!logs || logs.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'log-empty';
        emptyItem.textContent = 'Пока нет событий по этой задаче.';
        logList.appendChild(emptyItem);
      } else {
        logs.forEach((entry) => {
          const li = document.createElement('li');
          li.className = 'log-item';

          const eventSpan = document.createElement('span');
          eventSpan.className = 'log-event';
          eventSpan.textContent = formatLogEvent(entry.event_type, entry.seconds_change);

          const timeSpan = document.createElement('span');
          timeSpan.className = 'log-time';
          const date = entry.created_at ? new Date(entry.created_at) : null;
          timeSpan.textContent = date ? date.toLocaleString('ru-RU') : '';

          li.appendChild(eventSpan);
          li.appendChild(timeSpan);
          logList.appendChild(li);
        });
      }
    }

    showLogModal();
  } catch (error) {
    console.error('Ошибка загрузки лога задачи:', error);
    alert('Не удалось загрузить лог задачи');
  }
}

// Отображение задач
function renderTodos(todos) {
  // Перед перерисовкой очищаем интервалы
  clearAllClientTimers();

  todoList.innerHTML = '';
  
  if (todos.length === 0) {
    todoList.innerHTML = '<li class="empty-state">Нет задач. Добавьте первую!</li>';
    return;
  }

  todos.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.completed === 1;
    checkbox.addEventListener('change', () => toggleTodo(todo.id, checkbox.checked));
    
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;
    text.style.cursor = 'pointer';
    text.addEventListener('click', () => {
      window.location.href = `/todo.html?id=${todo.id}`;
    });

    // Блок таймера
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';

    const timerLabel = document.createElement('span');
    timerLabel.className = 'timer-label';
    timerLabel.textContent = 'Время:';

    const timerTime = document.createElement('span');
    timerTime.className = 'timer-time';

    // Функция обновления времени для конкретного todo
    const updateTime = () => {
      const base = todo.total_time_seconds || 0;
      let current = base;

      if (todo.timer_started_at) {
        const startedAt = new Date(todo.timer_started_at);
        const now = new Date();
        const diffSeconds = Math.max(
          0,
          Math.floor((now.getTime() - startedAt.getTime()) / 1000)
        );
        current = base + diffSeconds;
      }

      timerTime.textContent = formatSeconds(current);
    };

    updateTime();

    // Запускаем интервал, если таймер активен
    if (todo.timer_started_at && !todo.completed) {
      const intervalId = setInterval(updateTime, 1000);
      activeTimers[todo.id] = intervalId;
    }

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'timer-controls';

    const startBtn = document.createElement('button');
    startBtn.className = 'timer-btn start-btn';
    startBtn.textContent = todo.timer_started_at ? 'Продолжается' : 'Старт';
    startBtn.disabled = !!todo.completed;
    startBtn.addEventListener('click', () => handleStartClick(todo.id));

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'timer-btn pause-btn';
    pauseBtn.textContent = 'Пауза';
    pauseBtn.disabled = !todo.timer_started_at || !!todo.completed;
    pauseBtn.addEventListener('click', () => pauseTimer(todo.id));

    controlsContainer.appendChild(startBtn);
    controlsContainer.appendChild(pauseBtn);

    timerContainer.appendChild(timerLabel);
    timerContainer.appendChild(timerTime);
    timerContainer.appendChild(controlsContainer);
    
    const logBtn = document.createElement('button');
    logBtn.className = 'log-btn';
    logBtn.textContent = 'Лог';
    logBtn.addEventListener('click', () => openTodoLog(todo.id, todo.text));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));
    
    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(timerContainer);
    li.appendChild(logBtn);
    li.appendChild(deleteBtn);
    todoList.appendChild(li);
  });
}

// Добавление новой задачи
async function addTodo() {
  const text = todoInput.value.trim();
  
  if (!text) {
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    if (response.status === 401) {
      showAuth();
      return;
    }

    if (response.ok) {
      todoInput.value = '';
      loadTodos();
    } else {
      const error = await response.json();
      alert('Ошибка: ' + error.error);
    }
  } catch (error) {
    console.error('Ошибка добавления задачи:', error);
    alert('Не удалось добавить задачу');
  }
}

// Переключение статуса задачи
async function toggleTodo(id, completed) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ completed })
    });

    if (response.status === 401) {
      showAuth();
      return;
    }

    if (response.ok) {
      loadTodos();
    } else {
      const error = await response.json();
      alert('Ошибка: ' + error.error);
    }
  } catch (error) {
    console.error('Ошибка обновления задачи:', error);
    alert('Не удалось обновить задачу');
  }
}

// Запуск таймера
async function startTimer(id) {
  try {
    const response = await fetch(`${API_URL}/${id}/start-timer`, {
      method: 'POST'
    });

    if (response.status === 401) {
      showAuth();
      return;
    }

    if (response.ok) {
      loadTodos();
    } else {
      const error = await response.json();
      alert('Ошибка: ' + error.error);
    }
  } catch (error) {
    console.error('Ошибка запуска таймера:', error);
    alert('Не удалось запустить таймер');
  }
}

// Пауза таймера
async function pauseTimer(id) {
  try {
    const response = await fetch(`${API_URL}/${id}/pause-timer`, {
      method: 'POST'
    });

    if (response.status === 401) {
      showAuth();
      return;
    }

    if (response.ok) {
      loadTodos();
    } else {
      const error = await response.json();
      alert('Ошибка: ' + error.error);
    }
  } catch (error) {
    console.error('Ошибка паузы таймера:', error);
    alert('Не удалось поставить таймер на паузу');
  }
}

// Удаление задачи
async function deleteTodo(id) {
  if (!confirm('Удалить эту задачу?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE'
    });

    if (response.status === 401) {
      showAuth();
      return;
    }

    if (response.ok) {
      loadTodos();
    } else {
      const error = await response.json();
      alert('Ошибка: ' + error.error);
    }
  } catch (error) {
    console.error('Ошибка удаления задачи:', error);
    alert('Не удалось удалить задачу');
  }
}
