import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const db = window.db;
const TRAININGS_COLLECTION = "trainings";

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

let trainings = [];
let currentProgramItems = [];
let isStartingFirestore = false;

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
    id: training.id || "",
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
  if (!training.date) return false;
  return new Date() >= getTrainingEndDateTime(training.date);
}

async function updateTrainingInFirestore(trainingId, data) {
  const ref = doc(db, TRAININGS_COLLECTION, trainingId);
  await updateDoc(ref, data);
}

async function finalizePastTrainingsIfNeeded() {
  for (const training of trainings) {
    if (!training.date) continue;
    if (!isTrainingFinished(training)) continue;
    if (training.finalizedProgram.length > 0) continue;

    const finalizedProgram = training.program
      .filter((item) => item.checked)
      .map((item) => item.text);

    await updateTrainingInFirestore(training.id, {
      finalizedProgram
    });
  }
}

function getUpcomingTrainings() {
  return getSortedTrainings().filter((training) => !isTrainingFinished(training));
}

function getPastTrainings() {
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
    checkbox.addEventListener("change", async (event) => {
      await toggleNextTrainingProgramItem(Number(event.target.dataset.index), event.target.checked);
    });
  });
}

async function toggleNextTrainingProgramItem(index, checked) {
  const nextTraining = getNextTraining();

  if (!nextTraining) return;

  const updatedProgram = nextTraining.program.map((item, itemIndex) => {
    if (itemIndex === index) {
      return {
        ...item,
        checked
      };
    }
    return item;
  });

  await updateTrainingInFirestore(nextTraining.id, {
    program: updatedProgram
  });
}

async function addNextTrainingProgramItem() {
  const text = nextProgramInput.value.trim();
  const nextTraining = getNextTraining();

  if (!nextTraining || text === "") {
    return;
  }

  const updatedProgram = [
    ...nextTraining.program,
    {
      text,
      checked: true
    }
  ];

  await updateTrainingInFirestore(nextTraining.id, {
    program: updatedProgram
  });

  nextProgramInput.value = "";
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
    ? (
        training.finalizedProgram.length > 0
          ? training.finalizedProgram
          : training.program.map((item) => item.text)
      )
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
    button.addEventListener("click", async () => {
      await deleteTraining(button.dataset.id);
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

async function deleteTraining(trainingId) {
  const confirmed = window.confirm("Dieses Training wirklich löschen?");

  if (!confirmed) return;

  await deleteDoc(doc(db, TRAININGS_COLLECTION, trainingId));

  if (editingTrainingIdInput.value === trainingId) {
    resetForm();
  }
}

async function saveTraining() {
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

  const existingId = editingTrainingIdInput.value;

  const trainingData = {
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

  if (existingId) {
    const existingTraining = trainings.find((training) => training.id === existingId);
    const oldFinalizedProgram = existingTraining?.finalizedProgram || [];

    await updateTrainingInFirestore(existingId, {
      ...trainingData,
      finalizedProgram: oldFinalizedProgram
    });
  } else {
    await addDoc(collection(db, TRAININGS_COLLECTION), trainingData);
  }

  resetForm();
}

async function startFirestoreSync() {
  if (!db) {
    console.error("Firestore nicht verfügbar.");
    alert("Firestore konnte nicht geladen werden.");
    return;
  }

  if (isStartingFirestore) return;
  isStartingFirestore = true;

  onSnapshot(collection(db, TRAININGS_COLLECTION), async (snapshot) => {
    trainings = snapshot.docs.map((item) =>
      normalizeTraining({
        id: item.id,
        ...item.data()
      })
    );

    renderAll();

    try {
      await finalizePastTrainingsIfNeeded();
    } catch (error) {
      console.error("Fehler beim Abschliessen vergangener Trainings:", error);
    }
  }, (error) => {
    console.error("Firestore Sync Fehler:", error);
    alert("Fehler beim Laden der Firebase-Daten. Prüfe Firestore-Regeln.");
  });
}

addProgramBtn.addEventListener("click", addProgramItem);

programInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addProgramItem();
  }
});

addNextProgramBtn.addEventListener("click", async () => {
  await addNextTrainingProgramItem();
});

nextProgramInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    await addNextTrainingProgramItem();
  }
});

saveTrainingBtn.addEventListener("click", async () => {
  await saveTraining();
});

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

startFirestoreSync();