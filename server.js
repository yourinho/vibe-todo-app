const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Настройка сессий
app.use(session({
  secret: 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // установи true если используешь HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 часа
  }
}));

// Инициализация базы данных
const db = new sqlite3.Database('./todos.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('Подключено к SQLite базе данных');
    
    // Создание таблицы пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Создание таблицы задач с привязкой к пользователю
    db.run(`CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_time_seconds INTEGER DEFAULT 0,
      timer_started_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Таблица логов событий таймера по задачам
    db.run(`CREATE TABLE IF NOT EXISTS todo_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      todo_id INTEGER NOT NULL,
      event_type TEXT NOT NULL, -- 'start' | 'pause'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (todo_id) REFERENCES todos(id)
    )`);

    // Простейшая миграция для уже существующей таблицы todos
    db.run(
      'ALTER TABLE todos ADD COLUMN total_time_seconds INTEGER DEFAULT 0',
      (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Ошибка миграции total_time_seconds:', err.message);
        }
      }
    );

    db.run(
      'ALTER TABLE todos ADD COLUMN timer_started_at DATETIME',
      (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Ошибка миграции timer_started_at:', err.message);
        }
      }
    );
  }
});

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Требуется авторизация' });
  }
}

// API Routes для авторизации

// Регистрация
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: 'Логин и пароль обязательны' });
    return;
  }
  
  if (username.length < 3) {
    res.status(400).json({ error: 'Логин должен быть не менее 3 символов' });
    return;
  }
  
  if (password.length < 4) {
    res.status(400).json({ error: 'Пароль должен быть не менее 4 символов' });
    return;
  }
  
  try {
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Сохраняем пользователя в БД
    db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username.trim(), hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
          } else {
            res.status(500).json({ error: err.message });
          }
          return;
        }
        
        // Автоматически логиним пользователя после регистрации
        req.session.userId = this.lastID;
        req.session.username = username.trim();
        
        res.json({ 
          message: 'Регистрация успешна',
          user: { id: this.lastID, username: username.trim() }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при регистрации' });
  }
});

// Вход
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: 'Логин и пароль обязательны' });
    return;
  }
  
  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username.trim()],
    async (err, user) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (!user) {
        res.status(401).json({ error: 'Неверный логин или пароль' });
        return;
      }
      
      try {
        const match = await bcrypt.compare(password, user.password);
        
        if (match) {
          req.session.userId = user.id;
          req.session.username = user.username;
          res.json({ 
            message: 'Вход выполнен успешно',
            user: { id: user.id, username: user.username }
          });
        } else {
          res.status(401).json({ error: 'Неверный логин или пароль' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Ошибка при проверке пароля' });
      }
    }
  );
});

// Выход
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Ошибка при выходе' });
    } else {
      res.json({ message: 'Выход выполнен успешно' });
    }
  });
});

// Проверка текущего пользователя
app.get('/api/user', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ 
      user: { 
        id: req.session.userId, 
        username: req.session.username 
      } 
    });
  } else {
    res.status(401).json({ error: 'Не авторизован' });
  }
});

// API Routes для задач (требуют авторизации)

// Получить все задачи текущего пользователя
app.get('/api/todos', requireAuth, (req, res) => {
  db.all(
    'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC',
    [req.session.userId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Создать новую задачу
app.post('/api/todos', requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text || text.trim() === '') {
    res.status(400).json({ error: 'Текст задачи обязателен' });
    return;
  }

  db.run(
    'INSERT INTO todos (user_id, text) VALUES (?, ?)',
    [req.session.userId, text.trim()],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, text: text.trim(), completed: 0 });
    }
  );
});

// Обновить задачу
app.put('/api/todos/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { text, completed } = req.body;

  // Проверяем, что задача принадлежит текущему пользователю
  db.get(
    'SELECT * FROM todos WHERE id = ? AND user_id = ?',
    [id, req.session.userId],
    (err, todo) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (!todo) {
        res.status(404).json({ error: 'Задача не найдена' });
        return;
      }

      let query = 'UPDATE todos SET ';
      let params = [];
      const updates = [];

      if (text !== undefined) {
        updates.push('text = ?');
        params.push(text.trim());
      }

      if (completed !== undefined) {
        // Если задача переключается в состояние "выполнена",
        // и таймер был запущен, нужно добавить прошедшее время
        if (completed && todo.timer_started_at) {
          const startedAt = new Date(todo.timer_started_at);
          const now = new Date();
          const diffSeconds = Math.max(
            0,
            Math.floor((now.getTime() - startedAt.getTime()) / 1000)
          );

          const newTotal =
            (todo.total_time_seconds || 0) + diffSeconds;

          updates.push('completed = ?');
          params.push(1);

          updates.push('total_time_seconds = ?');
          params.push(newTotal);

          updates.push('timer_started_at = NULL');
        } else {
          updates.push('completed = ?');
          params.push(completed ? 1 : 0);
        }
      }

      if (updates.length === 0) {
        res.json({ message: 'Нет изменений' });
        return;
      }

      query += updates.join(', ');
      query += ' WHERE id = ? AND user_id = ?';
      params.push(id, req.session.userId);

      db.run(query, params, function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Задача обновлена' });
      });
    }
  );
});

// Запуск таймера для задачи
app.post('/api/todos/:id/start-timer', requireAuth, (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT * FROM todos WHERE id = ? AND user_id = ?',
    [id, req.session.userId],
    (err, todo) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (!todo) {
        res.status(404).json({ error: 'Задача не найдена' });
        return;
      }

      // Если таймер уже запущен для этой задачи, просто возвращаем текущие данные
      if (todo.timer_started_at) {
        res.json({ message: 'Таймер уже запущен' });
        return;
      }

      // Проверяем, нет ли другой активной задачи с таймером у этого пользователя
      db.get(
        'SELECT id FROM todos WHERE user_id = ? AND timer_started_at IS NOT NULL AND id != ? LIMIT 1',
        [req.session.userId, id],
        (activeErr, activeTodo) => {
          if (activeErr) {
            res.status(500).json({ error: activeErr.message });
            return;
          }

          if (activeTodo) {
            res.status(400).json({
              error:
                'У вас уже есть другая задача с запущенным таймером. Сначала поставьте её на паузу.'
            });
            return;
          }

          const nowIso = new Date().toISOString();

          db.run(
            'UPDATE todos SET timer_started_at = ? WHERE id = ? AND user_id = ?',
            [nowIso, id, req.session.userId],
            function(updateErr) {
              if (updateErr) {
                res.status(500).json({ error: updateErr.message });
                return;
              }

              // Логируем запуск таймера
              db.run(
                'INSERT INTO todo_logs (user_id, todo_id, event_type) VALUES (?, ?, ?)',
                [req.session.userId, id, 'start'],
                (logErr) => {
                  if (logErr) {
                    console.error('Ошибка записи лога (start):', logErr.message);
                  }
                  res.json({ message: 'Таймер запущен' });
                }
              );
            }
          );
        }
      );
    }
  );
});

// Пауза таймера для задачи
app.post('/api/todos/:id/pause-timer', requireAuth, (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT * FROM todos WHERE id = ? AND user_id = ?',
    [id, req.session.userId],
    (err, todo) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (!todo) {
        res.status(404).json({ error: 'Задача не найдена' });
        return;
      }

      if (!todo.timer_started_at) {
        res.status(400).json({ error: 'Таймер не запущен' });
        return;
      }

      const startedAt = new Date(todo.timer_started_at);
      const now = new Date();
      const diffSeconds = Math.max(
        0,
        Math.floor((now.getTime() - startedAt.getTime()) / 1000)
      );

      const newTotal = (todo.total_time_seconds || 0) + diffSeconds;

      db.run(
        'UPDATE todos SET total_time_seconds = ?, timer_started_at = NULL WHERE id = ? AND user_id = ?',
        [newTotal, id, req.session.userId],
        function(updateErr) {
          if (updateErr) {
            res.status(500).json({ error: updateErr.message });
            return;
          }

          // Логируем паузу таймера
          db.run(
            'INSERT INTO todo_logs (user_id, todo_id, event_type) VALUES (?, ?, ?)',
            [req.session.userId, id, 'pause'],
            (logErr) => {
              if (logErr) {
                console.error('Ошибка записи лога (pause):', logErr.message);
              }
              res.json({ message: 'Таймер поставлен на паузу' });
            }
          );
        }
      );
    }
  );
});

// Лог событий по задаче
app.get('/api/todos/:id/logs', requireAuth, (req, res) => {
  const { id } = req.params;

  db.all(
    'SELECT event_type, created_at FROM todo_logs WHERE user_id = ? AND todo_id = ? ORDER BY created_at DESC',
    [req.session.userId, id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Удалить задачу
app.delete('/api/todos/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  // Проверяем, что задача принадлежит текущему пользователю
  db.run(
    'DELETE FROM todos WHERE id = ? AND user_id = ?',
    [id, req.session.userId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Задача не найдена' });
        return;
      }
      res.json({ message: 'Задача удалена' });
    }
  );
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
