const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const PRIORITY_LABELS = {
  red: 'Важно и срочно',
  green: 'Важно, но не срочно',
  yellow: 'Не важно и не срочно',
  blue: 'Срочно, но не важно'
};

let tasks = {
  current: [],
  future: []
};

// Загрузка данных
function loadData() {
  const saved = localStorage.getItem('tasks');
  if (saved) {
    tasks = JSON.parse(saved);
  }
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function saveData() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function getDayOfWeek(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return DAYS[date.getDay()];
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function formatTime(timeFrom, timeTo) {
  if (!timeFrom && !timeTo) return '';
  if (timeFrom && timeTo) return `${timeFrom} — ${timeTo}`;
  if (timeFrom) return `с ${timeFrom}`;
  return `до ${timeTo}`;
}

function createTask(form, type) {
  const data = new FormData(form);
  const date = data.get('date');
  return {
    id: Date.now(),
    title: data.get('title').trim(),
    date,
    dayOfWeek: getDayOfWeek(date),
    timeFrom: data.get('timeFrom') || '',
    timeTo: data.get('timeTo') || '',
    priority: data.get('priority')
  };
}

function addTask(type, task) {
  tasks[type].push(task);
  tasks[type].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.timeFrom || '').localeCompare(b.timeFrom || '');
  });
  saveData();
  renderTasks(type);
}

function deleteTask(type, id) {
  tasks[type] = tasks[type].filter(t => t.id !== id);
  saveData();
  renderTasks(type);
}

function renderTaskItem(task, type) {
  const timeStr = formatTime(task.timeFrom, task.timeTo);
  const dateLabel = type === 'future' ? 'Дедлайн' : 'Дата';

  const div = document.createElement('div');
  div.className = `task-item priority-${task.priority}`;
  div.innerHTML = `
    <div class="task-info">
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-meta">
        ${dateLabel}: ${formatDate(task.date)} (${task.dayOfWeek})
        ${timeStr ? '<br>Время: ' + timeStr : ''}
      </div>
      <span class="task-priority">${PRIORITY_LABELS[task.priority]}</span>
    </div>
    <button class="btn-delete" data-id="${task.id}">Удалить</button>
  `;

  div.querySelector('.btn-delete').addEventListener('click', () => {
    deleteTask(type, task.id);
  });

  return div;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderTasks(type) {
  const container = document.getElementById(`tasks-${type}`);
  container.innerHTML = '';

  if (tasks[type].length === 0) {
    container.innerHTML = '<p class="empty-message">Нет задач</p>';
    return;
  }

  tasks[type].forEach(task => {
    container.appendChild(renderTaskItem(task, type));
  });
}

// Вкладки
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// Формы
document.getElementById('form-current').addEventListener('submit', e => {
  e.preventDefault();
  const task = createTask(e.target, 'current');
  addTask('current', task);
  e.target.reset();
});

document.getElementById('form-future').addEventListener('submit', e => {
  e.preventDefault();
  const task = createTask(e.target, 'future');
  addTask('future', task);
  e.target.reset();
});

// Темы
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Инициализация
loadData();
renderTasks('current');
renderTasks('future');
