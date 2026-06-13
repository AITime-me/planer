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
  current: { editingId: null, timeFrom: '', timeTo: '' },
  future: { editingId: null, timeFrom: '', timeTo: '' }
};

function loadData() {
  const saved = localStorage.getItem('tasks');
  if (saved) {
    tasks = JSON.parse(saved);
  }
  normalizeTasks();

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
      message: 'Время «до» не может быть раньше времени «с». Проверьте интервал и нажмите «ОК».'
    };
  }
  return { valid: true };
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

function buildTaskFromForm(form, type) {
  const data = new FormData(form);
  const date = data.get('date');
  const state = formState[type];

  return {
    id: state.editingId || Date.now(),
    title: data.get('title').trim(),
    date,
    dayOfWeek: getDayOfWeek(date),
    timeFrom: state.timeFrom || '',
    timeTo: state.timeTo || '',
    priority: data.get('priority'),
    completed: state.editingId
      ? Boolean(tasks[type].find(task => task.id === state.editingId)?.completed)
      : false
  };
}

function addTask(type, task) {
  tasks[type].push(task);
  sortTasks(tasks[type]);
  saveData();
  renderTasks(type);
}

function updateTask(type, task) {
  const index = tasks[type].findIndex(item => item.id === task.id);
  if (index === -1) return;
  tasks[type][index] = task;
  sortTasks(tasks[type]);
  saveData();
  renderTasks(type);
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

function updateTimeDisplay(displayEl, timeFrom, timeTo) {
  const timeStr = formatTime(timeFrom, timeTo);
  if (timeStr) {
    displayEl.textContent = `Выбрано время: ${timeStr}`;
    displayEl.hidden = false;
  } else {
    displayEl.textContent = '';
    displayEl.hidden = true;
  }
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
  formState[type] = { editingId: null, timeFrom: '', timeTo: '' };
  updateTimeDisplay(form.querySelector('.time-display'), '', '');
  hideTimeError(form);
  setFormMode(form, type, 'add');
}

function confirmTime(form, type) {
  const draftFrom = form.querySelector('[name="timeFromDraft"]').value;
  const draftTo = form.querySelector('[name="timeToDraft"]').value;
  const validation = validateTimeRange(draftFrom, draftTo);

  if (!validation.valid) {
    showTimeError(form, validation.message);
    return false;
  }

  hideTimeError(form);
  formState[type].timeFrom = draftFrom;
  formState[type].timeTo = draftTo;
  updateTimeDisplay(form.querySelector('.time-display'), draftFrom, draftTo);
  return true;
}

function startEdit(type, task) {
  const form = document.getElementById(`form-${type}`);

  formState[type] = {
    editingId: task.id,
    timeFrom: task.timeFrom || '',
    timeTo: task.timeTo || ''
  };

  form.querySelector('[name="title"]').value = task.title;
  form.querySelector('[name="date"]').value = task.date;
  form.querySelector('[name="priority"]').value = task.priority;
  form.querySelector('[name="timeFromDraft"]').value = task.timeFrom || '';
  form.querySelector('[name="timeToDraft"]').value = task.timeTo || '';

  updateTimeDisplay(form.querySelector('.time-display'), task.timeFrom || '', task.timeTo || '');
  hideTimeError(form);
  setFormMode(form, type, 'edit');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTaskItem(task, type) {
  const timeStr = formatTime(task.timeFrom, task.timeTo);

  const div = document.createElement('div');
  div.className = `task-item priority-${task.priority}${task.completed ? ' task-completed' : ''}`;

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
      <span class="task-priority">${PRIORITY_LABELS[task.priority]}</span>
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

  form.querySelector('.btn-time-ok').addEventListener('click', () => {
    confirmTime(form, type);
  });

  form.querySelector('.btn-cancel').addEventListener('click', () => {
    resetForm(form, type);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();

    const validation = validateTimeRange(formState[type].timeFrom, formState[type].timeTo);
    if (!validation.valid) {
      showTimeError(form, validation.message);
      return;
    }

    hideTimeError(form);
    const task = buildTaskFromForm(form, type);

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
