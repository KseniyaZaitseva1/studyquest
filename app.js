// ===== StudyQuest: логика приложения =====

// Элементы: задачи и счёт
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const tasksList = document.getElementById("tasksList");
const scoreValue = document.getElementById("scoreValue");
const scoreBox = document.getElementById("scoreBox");
const activeCount = document.getElementById("activeCount");
const doneCount = document.getElementById("doneCount");
const emptyMessage = document.getElementById("emptyMessage");
const pointsPicker = document.querySelector(".points-picker");
const progressFill = document.getElementById("progressFill");
const progressEmoji = document.getElementById("progressEmoji");
const progressCaption = document.getElementById("progressCaption");
const tasksCounter = document.getElementById("tasksCounter");
const progressBar = document.querySelector(".progress__bar");

// Элементы: герой, магазин, арена
const heroAvatarEl = document.getElementById("heroAvatar");
const heroLevelEl = document.getElementById("heroLevel");
const heroPowerEl = document.getElementById("heroPower");
const earnedTotalEl = document.getElementById("earnedTotal");
const spentTotalEl = document.getElementById("spentTotal");
const inventoryList = document.getElementById("inventoryList");
const levelUpButton = document.getElementById("levelUpButton");
const shopGrid = document.getElementById("shopGrid");
const shopWalletEl = document.getElementById("shopWallet");
const arenaList = document.getElementById("arenaList");
const arenaResult = document.getElementById("arenaResult");

// ===== Константы =====

// Очки по умолчанию за одну задачу
const POINTS_PER_TASK = 10;

// Ключи хранилища
const STORAGE_KEY = "studyquest-data";
const LEGACY_STORAGE_KEY = "studyquest-tasks"; // старый формат, нужен для миграции

// Экономика героя
const BASE_POWER = 10; // сила героя на 1 уровне
const LEVEL_BONUS = 8; // прибавка силы за каждый новый уровень
const MAX_LEVEL = 5;
const LEVEL_COST = 40; // цена прокачки = LEVEL_COST * текущий уровень

// Аватар героя по уровням
const HERO_AVATARS = ["🧑‍🎓", "🧙", "🧝", "🦸", "🐉"];

// Магазин: предметы для персонажа
const ITEMS = [
  { id: "dagger", name: "Кинжал", emoji: "🗡️", cost: 20, power: 5, desc: "Лёгкое оружие новичка" },
  { id: "shield", name: "Щит", emoji: "🛡️", cost: 35, power: 8, desc: "Надёжная защита в бою" },
  { id: "staff", name: "Посох", emoji: "🪄", cost: 55, power: 12, desc: "Магия бьёт больно" },
  { id: "armor", name: "Доспех", emoji: "🥋", cost: 70, power: 15, desc: "Тяжёлый, зато крепкий" },
  { id: "greatsword", name: "Двуручный меч", emoji: "⚔️", cost: 90, power: 18, desc: "Оружие настоящего героя" },
  { id: "ring", name: "Кольцо силы", emoji: "💍", cost: 110, power: 20, desc: "Древний артефакт" },
];

// Арена: противники по возрастанию силы
const ENEMIES = [
  { id: "slime", name: "Слизь", emoji: "🟢", power: 15, reward: 20 },
  { id: "rat", name: "Гигантская крыса", emoji: "🐀", power: 25, reward: 30 },
  { id: "goblin", name: "Гоблин", emoji: "👺", power: 40, reward: 50 },
  { id: "golem", name: "Каменный голем", emoji: "🗿", power: 60, reward: 80 },
  { id: "dragon", name: "Дракон", emoji: "🐉", power: 95, reward: 200 },
];

// ===== Состояние игры =====

let tasks = []; // [{ id, text, done, points }]
let spent = 0; // сколько очков потрачено в магазине и на прокачку
let inventory = []; // id купленных предметов
let level = 1; // уровень героя
let defeated = []; // id побеждённых противников

let selectedPoints = POINTS_PER_TASK; // очки, выбранные для новой задачи

// Счётчик уникальных номеров задач
let nextId = Date.now();

function generateId() {
  nextId += 1;
  return nextId;
}

// ===== Справочники =====

function getItem(id) {
  return ITEMS.find(function (item) {
    return item.id === id;
  });
}

function getEnemy(id) {
  return ENEMIES.find(function (enemy) {
    return enemy.id === id;
  });
}

// ===== Подсчёт очков и силы =====

// Очки, заработанные за выполненные задачи
function earnedFromTasks() {
  return tasks.reduce(function (sum, task) {
    return task.done ? sum + (task.points || POINTS_PER_TASK) : sum;
  }, 0);
}

// Очки, заработанные на арене
function earnedFromBattles() {
  return ENEMIES.reduce(function (sum, enemy) {
    return defeated.indexOf(enemy.id) !== -1 ? sum + enemy.reward : sum;
  }, 0);
}

// Всего заработано за всё время
function getEarnedTotal() {
  return earnedFromTasks() + earnedFromBattles();
}

// Доступные очки (кошелёк) = заработано − потрачено
function getWallet() {
  return Math.max(0, getEarnedTotal() - spent);
}

// Сила героя: база + уровни + бонусы предметов
function getHeroPower() {
  const itemBonus = inventory.reduce(function (sum, id) {
    const item = getItem(id);
    return item ? sum + item.power : sum;
  }, 0);
  return BASE_POWER + (level - 1) * LEVEL_BONUS + itemBonus;
}

// Цена следующего уровня
function getLevelUpCost() {
  return LEVEL_COST * level;
}

// ===== Проверка данных из хранилища =====

function sanitizeTasks(raw) {
  if (!Array.isArray(raw)) return [];

  const valid = [];
  raw.forEach(function (item) {
    if (!item || typeof item !== "object") return;

    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (text === "") return;

    const points = Number(item.points);
    valid.push({
      id: Number.isFinite(item.id) ? item.id : Date.now() + valid.length,
      text: text,
      done: item.done === true,
      points: Number.isFinite(points) && points > 0 ? points : POINTS_PER_TASK,
    });
  });
  return valid;
}

function sanitizeInventory(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = [];
  raw.forEach(function (id) {
    if (typeof id === "string" && getItem(id) && ids.indexOf(id) === -1) ids.push(id);
  });
  return ids;
}

function sanitizeDefeated(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = [];
  raw.forEach(function (id) {
    if (typeof id === "string" && getEnemy(id) && ids.indexOf(id) === -1) ids.push(id);
  });
  return ids;
}

function sanitizeNumber(raw) {
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function sanitizeLevel(raw) {
  const number = Math.floor(Number(raw));
  if (!Number.isFinite(number) || number < 1) return 1;
  return number > MAX_LEVEL ? MAX_LEVEL : number;
}

// ===== Загрузка и сохранение =====

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const legacy = saved === null ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
    const raw = saved !== null ? saved : legacy;
    const parsed = raw !== null ? JSON.parse(raw) : null;

    if (parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)) {
      tasks = sanitizeTasks(parsed.tasks);
      spent = sanitizeNumber(parsed.spent);
      inventory = sanitizeInventory(parsed.inventory);
      level = sanitizeLevel(parsed.level);
      defeated = sanitizeDefeated(parsed.defeated);
    } else {
      // Старый формат: просто массив задач, игра начинается с нуля
      tasks = sanitizeTasks(parsed);
      spent = 0;
      inventory = [];
      level = 1;
      defeated = [];
    }
  } catch (error) {
    console.warn("Данные повреждены, начинаем с пустого списка:", error);
    tasks = [];
    spent = 0;
    inventory = [];
    level = 1;
    defeated = [];
  }

  saveData(); // сразу сохраняем данные в чистом виде (включая миграцию)
}

function saveData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        spent: spent,
        level: level,
        inventory: inventory,
        defeated: defeated,
        tasks: tasks,
      })
    );
    localStorage.removeItem(LEGACY_STORAGE_KEY); // старый ключ больше не нужен
  } catch (error) {
    console.warn("Не удалось сохранить данные:", error);
  }
}

// Загружаем данные сразу при старте скрипта
loadData();

// Новые номера задач не должны совпадать с уже сохранёнными
nextId = tasks.reduce(function (max, task) {
  return Number.isFinite(task.id) && task.id > max ? task.id : max;
}, nextId);

// ===== Обработчики: задачи =====

pointsPicker.addEventListener("click", function (event) {
  const option = event.target.closest(".points-picker__option");
  if (!option) return;

  selectedPoints = Number(option.dataset.points);
  pointsPicker.querySelectorAll(".points-picker__option").forEach(function (button) {
    const active = button === option;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
});

taskForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const text = taskInput.value.trim();
  if (text === "") return;

  tasks.push({
    id: generateId(),
    text: text,
    done: false,
    points: selectedPoints,
  });

  taskInput.value = "";
  saveData();
  render();
});

tasksList.addEventListener("click", function (event) {
  const checkbox = event.target.closest(".task__checkbox");
  if (checkbox) {
    const id = Number(checkbox.dataset.id);
    const hadFocus = document.activeElement === checkbox;
    const task = tasks.find(function (item) {
      return item.id === id;
    });
    if (task) {
      task.done = checkbox.checked;
      saveData();
      render();
      if (hadFocus) {
        const newCheckbox = document.querySelector('.task__checkbox[data-id="' + id + '"]');
        if (newCheckbox) newCheckbox.focus();
      }
    }
    return;
  }

  const deleteButton = event.target.closest(".task__delete");
  if (deleteButton) {
    const id = Number(deleteButton.dataset.id);
    const hadFocus = document.activeElement === deleteButton;
    const index = tasks.findIndex(function (item) {
      return item.id === id;
    });
    tasks = tasks.filter(function (item) {
      return item.id !== id;
    });
    saveData();
    render();
    if (hadFocus) {
      const buttons = tasksList.querySelectorAll(".task__delete");
      const next = buttons[Math.min(index, buttons.length - 1)];
      if (next) {
        next.focus();
      } else {
        taskInput.focus();
      }
    }
  }
});

// ===== Обработчики: магазин и герой =====

shopGrid.addEventListener("click", function (event) {
  const button = event.target.closest(".item-card__buy");
  if (!button) return;

  const item = getItem(button.dataset.id);
  if (!item) return;
  if (inventory.indexOf(item.id) !== -1) return; // уже куплено
  if (getWallet() < item.cost) return; // не хватает очков

  spent += item.cost;
  inventory.push(item.id);
  saveData();
  render();
});

levelUpButton.addEventListener("click", function () {
  if (level >= MAX_LEVEL) return;

  const cost = getLevelUpCost();
  if (getWallet() < cost) return;

  spent += cost;
  level += 1;
  saveData();
  render();
});

// ===== Обработчики: арена =====

arenaList.addEventListener("click", function (event) {
  const button = event.target.closest(".enemy__fight");
  if (!button) return;

  const id = button.dataset.id;
  const enemy = getEnemy(id);
  if (!enemy) return;
  if (defeated.indexOf(id) !== -1) return; // уже побеждён
  if (isEnemyLocked(enemy)) return; // сначала победи предыдущего

  if (getHeroPower() >= enemy.power) {
    defeated.push(id);
    saveData();
    render();
    setArenaResult("Победа! Герой победил «" + enemy.name + "» и получил " + enemy.reward + " ⭐", "win");
  } else {
    setArenaResult(
      "Поражение. Сила героя: " + getHeroPower() + ", а нужна: " + enemy.power +
        ". Купи снаряжение в магазине или прокачай уровень!",
      "lose"
    );
  }
});

// Противник закрыт, пока не побеждён предыдущий
function isEnemyLocked(enemy) {
  const index = ENEMIES.indexOf(enemy);
  return index > 0 && defeated.indexOf(ENEMIES[index - 1].id) === -1;
}

function setArenaResult(text, kind) {
  arenaResult.textContent = text;
  arenaResult.classList.remove("arena__result--win", "arena__result--lose");
  if (kind === "win") arenaResult.classList.add("arena__result--win");
  if (kind === "lose") arenaResult.classList.add("arena__result--lose");
}

// ===== Отрисовка =====

function render() {
  renderTasks();
  updateStats();
  renderGame();
}

function renderTasks() {
  tasksList.innerHTML = "";

  tasks.forEach(function (task) {
    tasksList.appendChild(createTaskElement(task));
  });

  emptyMessage.hidden = tasks.length > 0;
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task" + (task.done ? " task--done" : "");

  const label = document.createElement("label");
  label.className = "task__label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task__checkbox";
  checkbox.checked = task.done;
  checkbox.dataset.id = task.id;

  const text = document.createElement("span");
  text.className = "task__text";
  text.textContent = task.text;

  const points = document.createElement("span");
  points.className = "task__points";
  points.textContent = "+" + (task.points || POINTS_PER_TASK);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "task__delete";
  deleteButton.dataset.id = task.id;
  deleteButton.textContent = "✕";
  deleteButton.title = "Удалить задачу";
  deleteButton.setAttribute("aria-label", "Удалить задачу: " + task.text);

  label.appendChild(checkbox);
  label.appendChild(text);

  item.appendChild(label);
  item.appendChild(points);
  item.appendChild(deleteButton);

  return item;
}

function updateStats() {
  const doneTasks = tasks.filter(function (task) {
    return task.done;
  });

  activeCount.textContent = tasks.length - doneTasks.length;
  doneCount.textContent = doneTasks.length;
  tasksCounter.textContent = tasks.length;

  // В шапке показываем доступные очки (кошелёк)
  scoreValue.textContent = getWallet();

  scoreBox.classList.remove("is-pulse");
  void scoreBox.offsetWidth; // перезапуск анимации
  scoreBox.classList.add("is-pulse");

  updateProgress(doneTasks.length);
}

function updateProgress(doneTotal) {
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((doneTotal / total) * 100);
  progressFill.style.width = percent + "%";
  progressBar.setAttribute("aria-valuenow", String(percent));

  if (total === 0) {
    progressEmoji.textContent = "🌱";
    progressCaption.textContent = "Добавь первый квест — и погнали! 🏁";
  } else if (percent === 100) {
    progressEmoji.textContent = "🏆";
    progressCaption.textContent = "Все квесты выполнены! Ты молодец!";
  } else if (percent >= 50) {
    progressEmoji.textContent = "🚀";
    progressCaption.textContent = "Почти финал: выполнено " + percent + "%";
  } else if (percent > 0) {
    progressEmoji.textContent = "⚡";
    progressCaption.textContent = "Отличное начало: " + percent + "%";
  } else {
    progressEmoji.textContent = "🌱";
    progressCaption.textContent = "Первый шаг: поставь галочку у задачи";
  }
}

// ===== Отрисовка игрового блока =====

function renderGame() {
  renderHero();
  renderShop();
  renderArena();
}

function renderHero() {
  heroAvatarEl.textContent = HERO_AVATARS[level - 1] || HERO_AVATARS[HERO_AVATARS.length - 1];
  heroLevelEl.textContent = level;
  heroPowerEl.textContent = getHeroPower();
  earnedTotalEl.textContent = getEarnedTotal();
  spentTotalEl.textContent = spent;

  // Инвентарь
  inventoryList.innerHTML = "";
  if (inventory.length === 0) {
    const empty = document.createElement("span");
    empty.className = "inventory__empty";
    empty.textContent = "Пока пусто — загляни в магазин 🛒";
    inventoryList.appendChild(empty);
  } else {
    inventory.forEach(function (id) {
      const item = getItem(id);
      const chip = document.createElement("span");
      chip.className = "inventory__chip";
      chip.textContent = item.emoji + " " + item.name;
      inventoryList.appendChild(chip);
    });
  }

  // Кнопка прокачки
  if (level >= MAX_LEVEL) {
    levelUpButton.disabled = true;
    levelUpButton.textContent = "Максимальный уровень 🏆";
  } else {
    const cost = getLevelUpCost();
    const affordable = getWallet() >= cost;
    levelUpButton.disabled = !affordable;
    levelUpButton.textContent = affordable
      ? "Прокачать · " + cost + " ⭐"
      : "Нужно " + cost + " ⭐";
  }
}

function renderShop() {
  shopWalletEl.textContent = getWallet();
  shopGrid.innerHTML = "";

  ITEMS.forEach(function (item) {
    const owned = inventory.indexOf(item.id) !== -1;
    const affordable = getWallet() >= item.cost;

    const card = document.createElement("article");
    card.className =
      "item-card" +
      (owned ? " item-card--owned" : "") +
      (!owned && !affordable ? " item-card--insufficient" : "");

    const emoji = document.createElement("span");
    emoji.className = "item-card__emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = item.emoji;

    const name = document.createElement("h3");
    name.className = "item-card__name";
    name.textContent = item.name;

    const desc = document.createElement("p");
    desc.className = "item-card__desc";
    desc.textContent = item.desc;

    const power = document.createElement("span");
    power.className = "item-card__power";
    power.textContent = "+" + item.power + " силы";

    const buy = document.createElement("button");
    buy.type = "button";
    buy.className = "btn item-card__buy";
    buy.dataset.id = item.id;

    if (owned) {
      buy.textContent = "Куплено ✓";
      buy.disabled = true;
    } else if (!affordable) {
      buy.textContent = "Не хватает " + (item.cost - getWallet()) + " ⭐";
      buy.disabled = true;
    } else {
      buy.textContent = "Купить · " + item.cost + " ⭐";
      buy.setAttribute("aria-label", "Купить " + item.name + " за " + item.cost + " очков");
    }

    card.appendChild(emoji);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(power);
    card.appendChild(buy);
    shopGrid.appendChild(card);
  });
}

function renderArena() {
  arenaList.innerHTML = "";

  ENEMIES.forEach(function (enemy, index) {
    const isDefeated = defeated.indexOf(enemy.id) !== -1;
    const locked = index > 0 && defeated.indexOf(ENEMIES[index - 1].id) === -1;
    const canWin = getHeroPower() >= enemy.power;

    const item = document.createElement("li");
    item.className =
      "enemy" + (isDefeated ? " enemy--defeated" : locked ? " enemy--locked" : "");

    const emoji = document.createElement("span");
    emoji.className = "enemy__emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = enemy.emoji;

    const info = document.createElement("div");
    info.className = "enemy__info";

    const name = document.createElement("span");
    name.className = "enemy__name";
    name.textContent = enemy.name;

    const stats = document.createElement("span");
    stats.className = "enemy__power";
    stats.textContent = "Сила: " + enemy.power + " · Награда: " + enemy.reward + " ⭐";

    info.appendChild(name);
    info.appendChild(stats);

    const fight = document.createElement("button");
    fight.type = "button";
    fight.className = "btn enemy__fight";
    fight.dataset.id = enemy.id;

    if (isDefeated) {
      fight.textContent = "Повержен ✓";
      fight.disabled = true;
    } else if (locked) {
      fight.textContent = "🔒 Закрыт";
      fight.disabled = true;
    } else {
      fight.textContent = "В бой";
      if (!canWin) {
        fight.classList.add("enemy__fight--risky");
        fight.title = "Сила героя меньше силы противника — бой будет проигран";
      }
      fight.setAttribute("aria-label", "Отправить героя в бой против: " + enemy.name);
    }

    item.appendChild(emoji);
    item.appendChild(info);
    item.appendChild(fight);
    arenaList.appendChild(item);
  });
}

// Сразу отрисовываем всё загруженное на экране
render();
