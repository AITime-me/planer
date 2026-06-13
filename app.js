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

const formState = {
  current: { editingId: null },
  future: { editingId: null }
};

function loadData() {
  const saved = localStorage.getItem('tasks');
  if (saved) {
    tasks = JSON.parse(saved);
  }
  normalizeTasks();
  promoteFutureTasks();
  saveData();

  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function normalizeTasks() {
  let changed = false;

  ['current', 'future'].forEach(type => {
    if (!Array.isArray(tasks[type])) {
      tasks[type] = [];
      changed = true;
    }

    tasks[type] = tasks[type].map(task => {
      if (task.completed === undefined) {
        changed = true;
      }
      return {
        ...task,
        completed: Boolean(task.completed)
      };
    });
  });

  if (changed) {
    saveData();
  }
}

function saveData() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysUntilDate(dateStr) {
  const today = new Date(getTodayDateStr() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  const diffMs = target - today;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function isTaskOverdue(task) {
  return !task.completed && task.date < getTodayDateStr();
}

function promoteFutureTasks() {
  const toMove = [];
  const remaining = [];

  tasks.future.forEach(task => {
    if (daysUntilDate(task.date) <= 14) {
      toMove.push(task);
    } else {
      remaining.push(task);
    }
  });

  if (toMove.length === 0) {
    return false;
  }

  tasks.future = remaining;
  const currentIds = new Set(tasks.current.map(task => task.id));

  toMove.forEach(task => {
    if (!currentIds.has(task.id)) {
      tasks.current.push({
        ...task,
        dayOfWeek: getDayOfWeek(task.date)
      });
      currentIds.add(task.id);
    }
  });

  sortTasks(tasks.current);
  return true;
}

function refreshAllTasks() {
  promoteFutureTasks();
  saveData();
  renderTasks('current');
  renderTasks('future');
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

function validateTimeRange(timeFrom, timeTo) {
  if (!timeFrom || !timeTo) {
    return { valid: true };
  }
  if (timeTo < timeFrom) {
    return {
      valid: false,
      message: 'Время «до» не может быть раньше времени «с». Проверьте интервал.'
    };
  }
  return { valid: true };
}

function fillTimeSelect(select, unit) {
  const placeholder = unit === 'hour' ? 'Ч' : 'М';
  const max = unit === 'hour' ? 23 : 59;
  let options = `<option value="">${placeholder}</option>`;

  for (let i = 0; i <= max; i++) {
    const value = String(i).padStart(2, '0');
    options += `<option value="${value}">${value}</option>`;
  }

  select.innerHTML = options;
}

function initTimeSelects(form) {
  fillTimeSelect(form.querySelector('[name="timeFromHour"]'), 'hour');
  fillTimeSelect(form.querySelector('[name="timeFromMinute"]'), 'minute');
  fillTimeSelect(form.querySelector('[name="timeToHour"]'), 'hour');
  fillTimeSelect(form.querySelector('[name="timeToMinute"]'), 'minute');
}

function readTimeFromForm(form, prefix) {
  const hour = form.querySelector(`[name="${prefix}Hour"]`).value;
  const minute = form.querySelector(`[name="${prefix}Minute"]`).value;

  if (!hour && !minute) {
    return { valid: true, value: '' };
  }

  if (hour && minute) {
    return { valid: true, value: `${hour}:${minute}` };
  }

  return {
    valid: false,
    message: 'Укажите и часы, и минуты или оставьте время пустым.'
  };
}

function setTimeSelects(form, prefix, timeStr) {
  const hourEl = form.querySelector(`[name="${prefix}Hour"]`);
  const minuteEl = form.querySelector(`[name="${prefix}Minute"]`);

  if (!timeStr) {
    hourEl.value = '';
    minuteEl.value = '';
    return;
  }

  const [hour, minute] = timeStr.split(':');
  hourEl.value = hour || '';
  minuteEl.value = minute || '';
}

function validateFormTime(form) {
  const timeFromResult = readTimeFromForm(form, 'timeFrom');
  if (!timeFromResult.valid) {
    return timeFromResult;
  }

  const timeToResult = readTimeFromForm(form, 'timeTo');
  if (!timeToResult.valid) {
    return timeToResult;
  }

  return validateTimeRange(timeFromResult.value, timeToResult.value);
}

function sortTasks(list) {
  list.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.timeFrom || '').localeCompare(b.timeFrom || '');
  });
}

function groupTasksByDate(taskList) {
  const groups = new Map();

  taskList.forEach(task => {
    if (!groups.has(task.date)) {
      groups.set(task.date, []);
    }
    groups.get(task.date).push(task);
  });

  return [...groups.keys()]
    .sort()
    .map(date => ({
      date,
      dayOfWeek: getDayOfWeek(date),
      tasks: groups.get(date).sort((a, b) => (a.timeFrom || '').localeCompare(b.timeFrom || ''))
    }));
}

function buildTaskFromForm(form, type, timeFrom, timeTo) {
  const data = new FormData(form);
  const date = data.get('date');
  const state = formState[type];

  return {
    id: state.editingId || Date.now(),
    title: data.get('title').trim(),
    date,
    dayOfWeek: getDayOfWeek(date),
    timeFrom,
    timeTo,
    priority: data.get('priority'),
    completed: state.editingId
      ? Boolean(tasks[type].find(task => task.id === state.editingId)?.completed)
      : false
  };
}

function addTask(type, task) {
  tasks[type].push(task);
  sortTasks(tasks[type]);
  refreshAllTasks();
}

function updateTask(type, task) {
  const index = tasks[type].findIndex(item => item.id === task.id);
  if (index === -1) return;
  tasks[type][index] = task;
  sortTasks(tasks[type]);
  refreshAllTasks();
}

function deleteTask(type, id) {
  tasks[type] = tasks[type].filter(task => task.id !== id);
  saveData();
  renderTasks(type);

  if (formState[type].editingId === id) {
    resetForm(document.getElementById(`form-${type}`), type);
  }
}

function toggleTaskComplete(type, id) {
  const task = tasks[type].find(item => item.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveData();
  renderTasks(type);
}

function showTimeError(form, message) {
  const errorEl = form.querySelector('.time-error');
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideTimeError(form) {
  const errorEl = form.querySelector('.time-error');
  errorEl.textContent = '';
  errorEl.hidden = true;
}

function setFormMode(form, type, mode) {
  const titleEl = form.querySelector('.form-title');
  const submitBtn = form.querySelector('.btn-add');
  const cancelBtn = form.querySelector('.btn-cancel');

  if (mode === 'edit') {
    titleEl.textContent = 'Редактировать задачу';
    submitBtn.textContent = 'Сохранить';
    cancelBtn.hidden = false;
  } else {
    titleEl.textContent = 'Добавить задачу';
    submitBtn.textContent = 'Добавить';
    cancelBtn.hidden = true;
  }
}

function resetForm(form, type) {
  form.reset();
  formState[type] = { editingId: null };
  hideTimeError(form);
  setFormMode(form, type, 'add');
}

function startEdit(type, task) {
  const form = document.getElementById(`form-${type}`);

  formState[type] = { editingId: task.id };

  form.querySelector('[name="title"]').value = task.title;
  form.querySelector('[name="date"]').value = task.date;
  form.querySelector('[name="priority"]').value = task.priority;
  setTimeSelects(form, 'timeFrom', task.timeFrom || '');
  setTimeSelects(form, 'timeTo', task.timeTo || '');

  hideTimeError(form);
  setFormMode(form, type, 'edit');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTaskItem(task, type) {
  const timeStr = formatTime(task.timeFrom, task.timeTo);
  const overdue = isTaskOverdue(task);

  const div = document.createElement('div');
  div.className = `task-item priority-${task.priority}${task.completed ? ' task-completed' : ''}${overdue ? ' task-overdue' : ''}`;

  div.innerHTML = `
    <label class="task-done-label">
      <input type="checkbox" class="task-done-checkbox" ${task.completed ? 'checked' : ''}>
      <span>Выполнено</span>
    </label>
    <div class="task-info">
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-meta">
        ${timeStr ? 'Время: ' + timeStr : 'Без указания времени'}
      </div>
      <div class="task-badges">
        ${overdue ? '<span class="task-overdue-badge">Просрочено</span>' : ''}
        <span class="task-priority">${PRIORITY_LABELS[task.priority]}</span>
      </div>
    </div>
    <div class="task-actions">
      <button type="button" class="btn-edit">Редактировать</button>
      <button type="button" class="btn-delete">Удалить</button>
    </div>
  `;

  div.querySelector('.task-done-checkbox').addEventListener('change', () => {
    toggleTaskComplete(type, task.id);
  });

  div.querySelector('.btn-edit').addEventListener('click', () => {
    startEdit(type, task);
  });

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

  groupTasksByDate(tasks[type]).forEach(group => {
    const groupEl = document.createElement('section');
    groupEl.className = 'task-group';

    const header = document.createElement('h3');
    header.className = 'task-group-header';
    header.textContent = `${formatDate(group.date)} (${group.dayOfWeek})`;
    groupEl.appendChild(header);

    const itemsEl = document.createElement('div');
    itemsEl.className = 'task-group-items';

    group.tasks.forEach(task => {
      itemsEl.appendChild(renderTaskItem(task, type));
    });

    groupEl.appendChild(itemsEl);
    container.appendChild(groupEl);
  });
}

function setupForm(form) {
  const type = form.dataset.type;

  initTimeSelects(form);

  form.querySelector('.btn-cancel').addEventListener('click', () => {
    resetForm(form, type);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const validation = validateFormTime(form);
    if (!validation.valid) {
      showTimeError(form, validation.message);
      return;
    }

    hideTimeError(form);
    const timeFrom = readTimeFromForm(form, 'timeFrom').value;
    const timeTo = readTimeFromForm(form, 'timeTo').value;
    const task = buildTaskFromForm(form, type, timeFrom, timeTo);

    if (formState[type].editingId) {
      updateTask(type, task);
    } else {
      addTask(type, task);
    }

    resetForm(form, type);
  });
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(item => item.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

document.querySelectorAll('.task-form').forEach(setupForm);

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.querySelectorAll('.theme-btn').forEach(item => item.classList.remove('active'));
    btn.classList.add('active');
  });
});

loadData();
renderTasks('current');
renderTasks('future');
