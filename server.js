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
      description TEXT,
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
      event_type TEXT NOT NULL, -- 'create' | 'complete' | 'start' | 'pause' | 'manual_add' | 'manual_subtract' | 'manual_set'
      seconds_change INTEGER, -- изменение времени в секундах (для ручных операций)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (todo_id) REFERENCES todos(id)
    )`);

    // Таблица тегов (у каждого пользователя свои теги)
    db.run(`CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Связь задач и тегов (многие-ко-многим)
    db.run(`CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (todo_id, tag_id),
      FOREIGN KEY (todo_id) REFERENCES todos(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
    )`);

    // Миграция для добавления поля seconds_change
    db.run(
      'ALTER TABLE todo_logs ADD COLUMN seconds_change INTEGER',
      (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Ошибка миграции seconds_change:', err.message);
        }
      }
    );

    // Простейшая миграция для уже существующей таблицы todos
    db.run(
      'ALTER TABLE todos ADD COLUMN description TEXT',
      (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Ошибка миграции description:', err.message);
        }
      }
    );

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

// API Routes для тегов
app.get('/api/tags', requireAuth, (req, res) => {
  db.all(
    'SELECT id, name, color FROM tags WHERE user_id = ? ORDER BY name',
    [req.session.userId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows || []);
    }
  );
});

app.post('/api/tags', requireAuth, (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Название тега обязательно' });
    return;
  }
  const c = (color || '#667eea').toString().trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(c)) {
    res.status(400).json({ error: 'Некорректный цвет (ожидается #RRGGBB)' });
    return;
  }
  db.run(
    'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)',
    [req.session.userId, name.trim(), c],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ id: this.lastID, name: name.trim(), color: c });
    }
  );
});

app.put('/api/tags/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Название тега обязательно' });
    return;
  }
  const c = color != null ? color.toString().trim() : null;
  if (c !== null && !/^#[0-9A-Fa-f]{6}$/.test(c)) {
    res.status(400).json({ error: 'Некорректный цвет (ожидается #RRGGBB)' });
    return;
  }
  let q = 'UPDATE tags SET name = ?';
  const params = [name.trim()];
  if (c !== null) {
    q += ', color = ?';
    params.push(c);
  }
  q += ' WHERE id = ? AND user_id = ?';
  params.push(id, req.session.userId);
  db.run(q, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Тег не найден' });
      return;
    }
    res.json({ message: 'Тег обновлён' });
  });
});

app.delete('/api/tags/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM todo_tags WHERE tag_id = ?', [id], (err1) => {
    if (err1) {
      res.status(500).json({ error: err1.message });
      return;
    }
    db.run('DELETE FROM tags WHERE id = ? AND user_id = ?', [id, req.session.userId], function(err2) {
      if (err2) {
        res.status(500).json({ error: err2.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Тег не найден' });
        return;
      }
      res.json({ message: 'Тег удалён' });
    });
  });
});

// API Routes для задач (требуют авторизации)

// Специфичные маршруты должны быть ПЕРЕД общими маршрутами /api/todos/:id

// Обновление времени задачи вручную
app.post('/api/todos/:id/update-time', requireAuth, (req, res) => {
  const { id } = req.params;
  const { operation, seconds } = req.body;

  if (!operation || seconds === undefined) {
    res.status(400).json({ error: 'Не указаны операция или количество секунд' });
    return;
  }

  const secondsNum = typeof seconds === 'string' ? parseInt(seconds, 10) : Number(seconds);
  
  if (isNaN(secondsNum) || secondsNum < 0) {
    res.status(400).json({ error: 'Неверное количество секунд' });
    return;
  }

  if (!['add', 'subtract', 'set'].includes(operation)) {
    res.status(400).json({ error: 'Неверная операция. Допустимые: add, subtract, set' });
    return;
  }

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

      const currentTime = todo.total_time_seconds || 0;
      let newTime = currentTime;
      let eventType = '';
      let secondsChange = 0;

      switch (operation) {
        case 'add':
          newTime = currentTime + secondsNum;
          eventType = 'manual_add';
          secondsChange = secondsNum;
          break;
        case 'subtract':
          newTime = Math.max(0, currentTime - secondsNum);
          eventType = 'manual_subtract';
          secondsChange = -Math.min(secondsNum, currentTime);
          break;
        case 'set':
          newTime = secondsNum;
          eventType = 'manual_set';
          secondsChange = secondsNum - currentTime;
          break;
        default:
          res.status(400).json({ error: 'Неверная операция' });
          return;
      }

      db.run(
        'UPDATE todos SET total_time_seconds = ? WHERE id = ? AND user_id = ?',
        [newTime, id, req.session.userId],
        function(updateErr) {
          if (updateErr) {
            res.status(500).json({ error: updateErr.message });
            return;
          }

          db.run(
            'INSERT INTO todo_logs (user_id, todo_id, event_type, seconds_change) VALUES (?, ?, ?, ?)',
            [req.session.userId, id, eventType, secondsChange],
            (logErr) => {
              if (logErr) {
                console.error('Ошибка записи лога (manual time update):', logErr.message);
              }
              res.json({ message: 'Время обновлено', total_time_seconds: newTime });
            }
          );
        }
      );
    }
  );
});

// Добавить тег к задаче
app.post('/api/todos/:id/tags', requireAuth, (req, res) => {
  const { id } = req.params;
  const { tag_id } = req.body;
  if (!tag_id) {
    res.status(400).json({ error: 'Укажите tag_id' });
    return;
  }
  db.get('SELECT * FROM todos WHERE id = ? AND user_id = ?', [id, req.session.userId], (err, todo) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!todo) {
      res.status(404).json({ error: 'Задача не найдена' });
      return;
    }
    db.get('SELECT * FROM tags WHERE id = ? AND user_id = ?', [tag_id, req.session.userId], (e, tag) => {
      if (e) {
        res.status(500).json({ error: e.message });
        return;
      }
      if (!tag) {
        res.status(404).json({ error: 'Тег не найден' });
        return;
      }
      db.run('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)', [id, tag_id], function(insErr) {
        if (insErr) {
          res.status(500).json({ error: insErr.message });
          return;
        }
        if (this.changes === 0) {
          res.json({ message: 'Тег уже добавлен', tag: { id: tag.id, name: tag.name, color: tag.color } });
          return;
        }
        res.status(201).json({ tag: { id: tag.id, name: tag.name, color: tag.color } });
      });
    });
  });
});

// Удалить тег у задачи
app.delete('/api/todos/:id/tags/:tagId', requireAuth, (req, res) => {
  const { id, tagId } = req.params;
  db.get('SELECT * FROM todos WHERE id = ? AND user_id = ?', [id, req.session.userId], (err, todo) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!todo) {
      res.status(404).json({ error: 'Задача не найдена' });
      return;
    }
    db.run('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?', [id, tagId], function(delErr) {
      if (delErr) {
        res.status(500).json({ error: delErr.message });
        return;
      }
      res.json({ message: 'Тег удалён' });
    });
  });
});

// Получить одну задачу по id
app.get('/api/todos/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT * FROM todos WHERE id = ? AND user_id = ?',
    [id, req.session.userId],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: 'Задача не найдена' });
        return;
      }
      db.all(
        'SELECT t.id, t.name, t.color FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id = ?',
        [row.id],
        (e, tagRows) => {
          const tags = (e || !tagRows) ? [] : tagRows;
          res.json({
            id: row.id,
            user_id: row.user_id,
            text: row.text != null ? String(row.text) : '',
            description: row.description != null ? String(row.description) : null,
            completed: row.completed,
            created_at: row.created_at,
            total_time_seconds: row.total_time_seconds != null ? row.total_time_seconds : 0,
            timer_started_at: row.timer_started_at,
            tags
          });
        }
      );
    }
  );
});

// Получить все задачи текущего пользователя (с тегами)
// Query: ?status=all|open|closed|active
app.get('/api/todos', requireAuth, (req, res) => {
  const status = (req.query.status || 'all').toLowerCase();
  let where = 'user_id = ?';
  const params = [req.session.userId];

  if (status === 'open') {
    where += ' AND completed = 0';
  } else if (status === 'closed') {
    where += ' AND completed = 1';
  } else if (status === 'active') {
    where += ' AND completed = 0 AND timer_started_at IS NOT NULL';
  }

  db.all(
    `SELECT * FROM todos WHERE ${where} ORDER BY created_at DESC`,
    params,
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!rows || rows.length === 0) {
        res.json([]);
        return;
      }
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      db.all(
        `SELECT tt.todo_id, t.id AS tag_id, t.name AS tag_name, t.color AS tag_color
         FROM todo_tags tt JOIN tags t ON t.id = tt.tag_id
         WHERE tt.todo_id IN (${placeholders})`,
        ids,
        (e, tagRows) => {
          if (e) {
            res.status(500).json({ error: e.message });
            return;
          }
          const byTodo = {};
          (tagRows || []).forEach((tr) => {
            if (!byTodo[tr.todo_id]) byTodo[tr.todo_id] = [];
            byTodo[tr.todo_id].push({ id: tr.tag_id, name: tr.tag_name, color: tr.tag_color });
          });
          rows.forEach((r) => { r.tags = byTodo[r.id] || []; });
          res.json(rows);
        }
      );
    }
  );
});

// Создать новую задачу
app.post('/api/todos', requireAuth, (req, res) => {
  const { text, description } = req.body;
  if (!text || text.trim() === '') {
    res.status(400).json({ error: 'Текст задачи обязателен' });
    return;
  }

  db.run(
    'INSERT INTO todos (user_id, text, description) VALUES (?, ?, ?)',
    [req.session.userId, text.trim(), description || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const newId = this.lastID;
      db.run(
        'INSERT INTO todo_logs (user_id, todo_id, event_type) VALUES (?, ?, ?)',
        [req.session.userId, newId, 'create'],
        (logErr) => {
          if (logErr) console.error('Ошибка записи лога (create):', logErr.message);
        }
      );
      res.json({ id: newId, text: text.trim(), description: description || null, completed: 0 });
    }
  );
});

// Обновить задачу
app.put('/api/todos/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { text, description, completed } = req.body;

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

      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description || null);
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

      const loggingComplete = completed === true || completed === 1;

      db.run(query, params, function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (loggingComplete) {
          db.run(
            'INSERT INTO todo_logs (user_id, todo_id, event_type) VALUES (?, ?, ?)',
            [req.session.userId, id, 'complete'],
            (logErr) => {
              if (logErr) console.error('Ошибка записи лога (complete):', logErr.message);
              res.json({ message: 'Задача обновлена' });
            }
          );
        } else {
          res.json({ message: 'Задача обновлена' });
        }
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
    'SELECT event_type, seconds_change, created_at FROM todo_logs WHERE user_id = ? AND todo_id = ? ORDER BY created_at DESC',
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
  db.run('DELETE FROM todo_tags WHERE todo_id = ?', [id], (err1) => {
    if (err1) {
      res.status(500).json({ error: err1.message });
      return;
    }
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
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
