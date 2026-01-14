const API_URL = '/api/todos';

// Элементы DOM
const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');

// Загрузка задач при загрузке страницы
document.addEventListener('DOMContentLoaded', loadTodos);

// Добавление задачи по клику на кнопку
addBtn.addEventListener('click', addTodo);

// Добавление задачи по Enter
todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addTodo();
  }
});

// Загрузка всех задач
async function loadTodos() {
  try {
    const response = await fetch(API_URL);
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

