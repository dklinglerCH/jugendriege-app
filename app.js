const STORAGE_KEY = "trainings-app-data";

const editingTrainingIdInput = document.getElementById("editing-training-id");
const trainingDateInput = document.getElementById("training-date");
const trainingStatusInput = document.getElementById("training-status");
const trainingFocusInput = document.getElementById("training-focus");
const programInput = document.getElementById("program-input");
const addProgramBtn = document.getElementById("add-program-btn");
const programPreviewList = document.getElementById("program-preview-list");
const saveTrainingBtn = document.getElementById("save-training-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const nextTrainingDate = document.getElementById("next-training-date");
const nextTrainingStatus = document.getElementById("next-training-status");
const nextTrainingFocus = document.getElementById("next-training-focus");
const nextTrainingLeaders = document.getElementById("next-training-leaders");
const nextTrainingProgram = document.getElementById("next-training-program");
const nextProgramInput = document.getElementById("next-program-input");
const addNextProgramBtn = document.getElementById("add-next-program-btn");

const lastTrainingsList = document.getElementById("last-trainings-list");
const allTrainingsList = document.getElementById("all-trainings-list");

const toggleLastTrainingsBtn = document.getElementById("toggle-last-trainings-btn");
const lastTrainingsWrapper = document.getElementById("last-trainings-wrapper");

const toggleAllTrainingsBtn = document.getElementById("toggle-all-trainings-btn");
const allTrainingsWrapper = document.getElementById("all-trainings-wrapper");

const leaderCheckboxes = document.querySelectorAll(".leader-checkbox");

let trainings = loadTrainings();
let currentProgramItems = [];

function parseLocalDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function getTrainingEndDateTime(dateString) {
  return new Date(`${dateString}T22:00:00`);
}

function normalizeProgram(program) {
  if (!Array.isArray(program)) {
    return [];
  }

  return program
    .map((item) => {
      if (typeof item === "string") {
        return {
          text: item,
          checked: false
        };
      }

      return {
        text: (item.text || "").trim(),
        checked: Boolean(item.checked)
      };
    })
    .filter((item) => item.text !== "");
}

function normalizeTraining(training) {
  return {
    id: training.id || Date.now().toString(),
    date: training.date || "",
    status: training.status || "Findet statt",
    focus: (training.focus || "").trim(),
    leaders: Array.isArray(training.leaders) ? training.leaders : [],
    program: normalizeProgram(training.program),
    finalizedProgram: Array.isArray(training.finalizedProgram)
      ? training.finalizedProgram.filter((item) => typeof item === "string" && item.trim() !== "")
      : []
  };
}

function loadTrainings() {
  const savedTrainings = localStorage.getItem(STORAGE_KEY);

  if (!savedTrainings) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedTrainings);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeTraining);
  } catch (error) {
    return [];
  }
}

function saveTrainings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trainings));
}

function generateId() {
  return Date.now().toString();
}

function formatDate(dateString) {
  if (!dateString) return "";

  return parseLocalDate(dateString).toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getSelectedLeaders() {
  return Array.from(leaderCheckboxes)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

function setSelectedLeaders(leaders) {
  leaderCheckboxes.forEach((checkbox) => {
    checkbox.checked = leaders.includes(checkbox.value);
  });
}

function getSortedTrainings() {
  return [...trainings].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
}

function isTrainingFinished(training) {
  return new Date() >= getTrainingEndDateTime(training.date);
}

function finalizePastTrainingsIfNeeded() {
  let hasChanged = false;

  trainings = trainings.map((training) => {
    const normalized = normalizeTraining(training);

    if (!normalized.date) {
      return normalized;
    }

    if (!isTrainingFinished(normalized)) {
      return normalized;
    }

    if (normalized.finalizedProgram.length > 0) {
      return normalized;
    }

    normalized.finalizedProgram = normalized.program
      .filter((item) => item.checked)
      .map((item) => item.text);

    hasChanged = true;
    return normalized;
  });

  if (hasChanged) {
    saveTrainings();
  }
}

function getUpcomingTrainings() {
  finalizePastTrainingsIfNeeded();

  return getSortedTrainings().filter((training) => !isTrainingFinished(training));
}

function getPastTrainings() {
  finalizePastTrainingsIfNeeded();

  return getSortedTrainings()
    .filter((training) => isTrainingFinished(training))
    .reverse();
}

function resetForm() {
  editingTrainingIdInput.value = "";
  trainingDateInput.value = "";
  trainingStatusInput.value = "Findet statt";
  trainingFocusInput.value = "";
  programInput.value = "";
  currentProgramItems = [];
  setSelectedLeaders([]);
  saveTrainingBtn.textContent = "Training speichern";
  cancelEditBtn.classList.add("hidden");
  renderProgramPreview();
}

function renderProgramPreview() {
  programPreviewList.innerHTML = "";

  if (currentProgramItems.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Noch keine Programmpunkte";
    programPreviewList.appendChild(li);
    return;
  }

  currentProgramItems.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="training-row">
        <span>${item.text}</span>
        <button type="button" class="secondary remove-program-btn" data-index="${index}">Entfernen</button>
      </div>
    `;
    programPreviewList.appendChild(li);
  });

  document.querySelectorAll(".remove-program-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      currentProgramItems.splice(index, 1);
      renderProgramPreview();
    });
  });
}

function getNextTraining() {
  const upcomingTrainings = getUpcomingTrainings();
  return upcomingTrainings[0] || null;
}

function renderNextTraining() {
  const nextTraining = getNextTraining();

  if (!nextTraining) {
    nextTrainingDate.textContent = "Noch kein Training geplant";
    nextTrainingStatus.textContent = "";
    nextTrainingFocus.textContent = "";
    nextTrainingLeaders.textContent = "";
    nextTrainingProgram.innerHTML = "";
    nextProgramInput.value = "";
    nextProgramInput.disabled = true;
    addNextProgramBtn.disabled = true;
    return;
  }

  nextTrainingDate.textContent = `${formatDate(nextTraining.date)}, 18:00–20:00`;
  nextTrainingStatus.textContent = `Status: ${nextTraining.status}`;
  nextTrainingFocus.textContent = nextTraining.focus
    ? `Fokus: ${nextTraining.focus}`
    : "Fokus: Noch nicht gesetzt";
  nextTrainingLeaders.textContent =
    nextTraining.leaders.length > 0
      ? `Leiter: ${nextTraining.leaders.join(", ")}`
      : "Leiter: Noch nicht gewählt";

  nextProgramInput.disabled = false;
  addNextProgramBtn.disabled = false;

  nextTrainingProgram.innerHTML = "";

  if (nextTraining.program.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<label><span>Noch kein Programm erfasst</span></label>`;
    nextTrainingProgram.appendChild(li);
    return;
  }

  nextTraining.program.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label>
        <input type="checkbox" data-index="${index}" ${item.checked ? "checked" : ""} />
        <span>${item.text}</span>
      </label>
    `;
    nextTrainingProgram.appendChild(li);
  });

  nextTrainingProgram.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      toggleNextTrainingProgramItem(Number(event.target.dataset.index), event.target.checked);
    });
  });
}

function toggleNextTrainingProgramItem(index, checked) {
  const nextTraining = getNextTraining();

  if (!nextTraining) return;

  const trainingIndex = trainings.findIndex((training) => training.id === nextTraining.id);

  if (trainingIndex === -1) return;
  if (!trainings[trainingIndex].program[index]) return;

  trainings[trainingIndex].program[index].checked = checked;
  saveTrainings();
  renderAll();
}

function addNextTrainingProgramItem() {
  const text = nextProgramInput.value.trim();
  const nextTraining = getNextTraining();

  if (!nextTraining || text === "") {
    return;
  }

  const trainingIndex = trainings.findIndex((training) => training.id === nextTraining.id);

  if (trainingIndex === -1) {
    return;
  }

  trainings[trainingIndex].program.push({
    text,
    checked: true
  });

  saveTrainings();
  nextProgramInput.value = "";
  renderAll();
}

function renderLastTrainings() {
  const pastTrainings = getPastTrainings().slice(0, 3);

  lastTrainingsList.innerHTML = "";

  if (pastTrainings.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Noch keine vergangenen Trainings";
    lastTrainingsList.appendChild(li);
    return;
  }

  pastTrainings.forEach((training) => {
    const li = document.createElement("li");

    const focusText = training.focus
      ? `Fokus: ${training.focus}`
      : "Fokus: Noch nicht gesetzt";

    const leadersText =
      training.leaders.length > 0
        ? `Leiter: ${training.leaders.join(", ")}`
        : "Leiter: Noch nicht gewählt";

    const finalProgram =
      training.finalizedProgram.length > 0
        ? training.finalizedProgram
        : training.program.map((item) => item.text);

    const programHtml =
      finalProgram.length > 0
        ? `<ul>${finalProgram.map((item) => `<li>${item}</li>`).join("")}</ul>`
        : `<p>Kein Programm vorhanden</p>`;

    li.innerHTML = `
      <div>
        <strong>${formatDate(training.date)}</strong>
        <p class="training-meta">Status: ${training.status}</p>
        <p class="training-meta">${focusText}</p>
        <p class="training-meta">${leadersText}</p>
        <div>
          <strong>Programm</strong>
          ${programHtml}
        </div>
      </div>
    `;

    lastTrainingsList.appendChild(li);
  });
}

function createTrainingCard(training) {
  const card = document.createElement("div");
  card.className = "training-entry";

  const focusHtml = training.focus
    ? `<p class="training-meta"><strong>Fokus:</strong> ${training.focus}</p>`
    : `<p class="training-meta"><strong>Fokus:</strong> Noch nicht gesetzt</p>`;

  const leadersHtml =
    training.leaders.length > 0
      ? `<p class="training-meta"><strong>Leiter:</strong> ${training.leaders.join(", ")}</p>`
      : `<p class="training-meta"><strong>Leiter:</strong> Noch nicht gewählt</p>`;

  const programSource = isTrainingFinished(training)
    ? (training.finalizedProgram.length > 0
        ? training.finalizedProgram
        : training.program.map((item) => item.text))
    : training.program.map((item) => item.text);

  const programHtml =
    programSource.length > 0
      ? `<ul>${programSource.map((item) => `<li>${item}</li>`).join("")}</ul>`
      : `<p>Kein Programm vorhanden</p>`;

  card.innerHTML = `
    <div class="training-entry-header">
      <h3>${formatDate(training.date)}</h3>
      <p class="training-meta">Status: ${training.status}</p>
      ${focusHtml}
      ${leadersHtml}
    </div>

    <div class="training-entry-program">
      <strong>Programm</strong>
      ${programHtml}
    </div>

    <div class="button-row">
      <button type="button" class="edit-training-btn" data-id="${training.id}">Bearbeiten</button>
      <button type="button" class="secondary delete-training-btn" data-id="${training.id}">Löschen</button>
    </div>
  `;

  return card;
}

function attachTrainingCardEvents() {
  document.querySelectorAll(".edit-training-btn").forEach((button) => {
    button.addEventListener("click", () => {
      startEditingTraining(button.dataset.id);
    });
  });

  document.querySelectorAll(".delete-training-btn").forEach((button) => {
    button.addEventListener("click", () => {
      deleteTraining(button.dataset.id);
    });
  });
}

function renderAllTrainings() {
  const sortedTrainings = getSortedTrainings().reverse();

  allTrainingsList.innerHTML = "";

  if (sortedTrainings.length === 0) {
    allTrainingsList.innerHTML = "<p>Noch keine Trainings erfasst.</p>";
    return;
  }

  sortedTrainings.forEach((training) => {
    const card = createTrainingCard(training);
    allTrainingsList.appendChild(card);
  });

  attachTrainingCardEvents();
}

function renderToggleButtons() {
  toggleLastTrainingsBtn.textContent = lastTrainingsWrapper.classList.contains("hidden")
    ? "Anzeigen"
    : "Einklappen";

  toggleAllTrainingsBtn.textContent = allTrainingsWrapper.classList.contains("hidden")
    ? "Anzeigen"
    : "Einklappen";
}

function renderAll() {
  finalizePastTrainingsIfNeeded();
  renderProgramPreview();
  renderNextTraining();
  renderLastTrainings();
  renderAllTrainings();
  renderToggleButtons();
}

function addProgramItem() {
  const text = programInput.value.trim();

  if (text === "") return;

  currentProgramItems.push({
    text,
    checked: false
  });

  programInput.value = "";
  renderProgramPreview();
}

function startEditingTraining(trainingId) {
  const training = trainings.find((item) => item.id === trainingId);

  if (!training) return;

  editingTrainingIdInput.value = training.id;
  trainingDateInput.value = training.date;
  trainingStatusInput.value = training.status;
  trainingFocusInput.value = training.focus || "";
  currentProgramItems = training.program.map((item) => ({
    text: item.text,
    checked: Boolean(item.checked)
  }));
  setSelectedLeaders(training.leaders);

  saveTrainingBtn.textContent = "Änderungen speichern";
  cancelEditBtn.classList.remove("hidden");

  renderProgramPreview();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function deleteTraining(trainingId) {
  const confirmed = window.confirm("Dieses Training wirklich löschen?");

  if (!confirmed) return;

  trainings = trainings.filter((training) => training.id !== trainingId);
  saveTrainings();

  if (editingTrainingIdInput.value === trainingId) {
    resetForm();
  }

  renderAll();
}

function saveTraining() {
  const date = trainingDateInput.value;
  const status = trainingStatusInput.value;
  const focus = trainingFocusInput.value.trim();
  const leaders = getSelectedLeaders();

  if (!date) {
    alert("Bitte ein Datum auswählen.");
    return;
  }

  const selectedDate = parseLocalDate(date);
  const day = selectedDate.getDay();

  if (day !== 5) {
    alert("Trainings sind nur am Freitag möglich.");
    return;
  }

  const trainingData = {
    id: editingTrainingIdInput.value || generateId(),
    date,
    status,
    focus,
    leaders,
    program: currentProgramItems.map((item) => ({
      text: item.text,
      checked: Boolean(item.checked)
    })),
    finalizedProgram: []
  };

  const existingIndex = trainings.findIndex((training) => training.id === trainingData.id);

  if (existingIndex >= 0) {
    const oldFinalizedProgram = trainings[existingIndex].finalizedProgram || [];
    trainingData.finalizedProgram = oldFinalizedProgram;
    trainings[existingIndex] = trainingData;
  } else {
    trainings.push(trainingData);
  }

  saveTrainings();
  resetForm();
  renderAll();
}

addProgramBtn.addEventListener("click", addProgramItem);

programInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addProgramItem();
  }
});

addNextProgramBtn.addEventListener("click", addNextTrainingProgramItem);

nextProgramInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addNextTrainingProgramItem();
  }
});

saveTrainingBtn.addEventListener("click", saveTraining);

cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

toggleLastTrainingsBtn.addEventListener("click", () => {
  lastTrainingsWrapper.classList.toggle("hidden");
  renderToggleButtons();
});

toggleAllTrainingsBtn.addEventListener("click", () => {
  allTrainingsWrapper.classList.toggle("hidden");
  renderToggleButtons();
});

renderAll();