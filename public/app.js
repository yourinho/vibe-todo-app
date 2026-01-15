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

// Загрузка всех задач
async function loadTodos() {
  try {
    const response = await fetch(API_URL);
    if (response.status === 401) {
      showAuth();
      return;
    }
    const todos = await response.json();
    renderTodos(todos);
  } catch (error) {
    console.error('Ошибка загрузки задач:', error);
  }
}

// Отображение задач
function renderTodos(todos) {
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
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));
    
    li.appendChild(checkbox);
    li.appendChild(text);
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
