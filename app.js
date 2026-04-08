import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const db = window.db;
const TRAININGS_COLLECTION = "trainings";

/* =========================
   LOGIN DATEN HIER ÄNDERN
========================= */
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const TRAINER_USERNAME = "trainer";
const TRAINER_PASSWORD = "trainer123";

/* =========================
   LOGIN ELEMENTE
========================= */
const loginCard = document.getElementById("login-card");
const appContent = document.getElementById("app-content");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginError = document.getElementById("login-error");
const currentRoleText = document.getElementById("current-role");

/* =========================
   APP ELEMENTE
========================= */
const adminSection = document.getElementById("admin-section");
const allTrainingsSection = document.getElementById("all-trainings-section");

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
const nextTrainingAddArea = document.getElementById("next-training-add-area");

const lastTrainingsList = document.getElementById("last-trainings-list");
const allTrainingsList = document.getElementById("all-trainings-list");

const toggleLastTrainingsBtn = document.getElementById("toggle-last-trainings-btn");
const lastTrainingsWrapper = document.getElementById("last-trainings-wrapper");

const toggleAllTrainingsBtn = document.getElementById("toggle-all-trainings-btn");
const allTrainingsWrapper = document.getElementById("all-trainings-wrapper");

const togglePdfBtn = document.getElementById("toggle-pdf-btn");
const pdfWrapper = document.getElementById("pdf-wrapper");
const pdfFromDateInput = document.getElementById("pdf-from-date");
const pdfToDateInput = document.getElementById("pdf-to-date");
const generatePdfBtn = document.getElementById("generate-pdf-btn");
const pdfError = document.getElementById("pdf-error");

const leaderCheckboxes = document.querySelectorAll(".leader-checkbox");

/* =========================
   STATE
========================= */
let trainings = [];
let currentProgramItems = [];
let isStartingFirestore = false;
let currentRole = localStorage.getItem("jr-role") || "";

/* =========================
   LOGIN
========================= */
function isAdmin() {
  return currentRole === "admin";
}

function isTrainer() {
  return currentRole === "trainer";
}

function isLoggedIn() {
  return isAdmin() || isTrainer();
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

function hideLoginError() {
  loginError.textContent = "";
  loginError.classList.add("hidden");
}

function applyRoleUI() {
  if (!isLoggedIn()) {
    loginCard.classList.remove("hidden");
    appContent.classList.add("hidden");
    return;
  }

  loginCard.classList.add("hidden");
  appContent.classList.remove("hidden");

  if (isAdmin()) {
    currentRoleText.textContent = "Eingeloggt als: Admin";
    adminSection.classList.remove("hidden");
    allTrainingsSection.classList.remove("hidden");
    nextTrainingAddArea.classList.remove("hidden");
    if (togglePdfBtn) togglePdfBtn.classList.remove("hidden");
  } else {
    currentRoleText.textContent = "Eingeloggt als: Trainer";
    adminSection.classList.add("hidden");
    allTrainingsSection.classList.add("hidden");
    nextTrainingAddArea.classList.remove("hidden");
    if (pdfWrapper) pdfWrapper.classList.add("hidden");
    if (togglePdfBtn) togglePdfBtn.classList.add("hidden");
    resetForm();
  }

  renderAll();
}

function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  hideLoginError();

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    currentRole = "admin";
    localStorage.setItem("jr-role", currentRole);
    usernameInput.value = "";
    passwordInput.value = "";
    applyRoleUI();
    return;
  }

  if (username === TRAINER_USERNAME && password === TRAINER_PASSWORD) {
    currentRole = "trainer";
    localStorage.setItem("jr-role", currentRole);
    usernameInput.value = "";
    passwordInput.value = "";
    applyRoleUI();
    return;
  }

  showLoginError("Benutzername oder Passwort falsch.");
}

function logout() {
  currentRole = "";
  localStorage.removeItem("jr-role");
  usernameInput.value = "";
  passwordInput.value = "";
  hideLoginError();
  if (pdfWrapper) pdfWrapper.classList.add("hidden");
  hidePdfError();
  applyRoleUI();
}

/* =========================
   TRAINING HILFSFUNKTIONEN
========================= */
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

function formatDateShort(dateString) {
  if (!dateString) return "";

  return parseLocalDate(dateString).toLocaleDateString("de-CH", {
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

function getUpcomingTrainings() {
  return getSortedTrainings().filter((training) => !isTrainingFinished(training));
}

function getPastTrainings() {
  return getSortedTrainings()
    .filter((training) => isTrainingFinished(training))
    .reverse();
}

function getNextTraining() {
  const upcomingTrainings = getUpcomingTrainings();
  return upcomingTrainings[0] || null;
}

/* =========================
   FIRESTORE
========================= */
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

/* =========================
   FORM
========================= */
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
      if (!isAdmin()) return;
      const index = Number(button.dataset.index);
      currentProgramItems.splice(index, 1);
      renderProgramPreview();
    });
  });
}

/* =========================
   NÄCHSTES TRAINING
========================= */
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

  nextProgramInput.disabled = !isLoggedIn();
  addNextProgramBtn.disabled = !isLoggedIn();

  nextTrainingProgram.innerHTML = "";

  if (nextTraining.program.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<label><span>Noch kein Programm erfasst</span></label>`;
    nextTrainingProgram.appendChild(li);
    return;
  }

  nextTraining.program.forEach((item, index) => {
    const disabledAttr = isLoggedIn() ? "" : "disabled";

    const li = document.createElement("li");
    li.innerHTML = `
      <label>
        <input type="checkbox" data-index="${index}" ${item.checked ? "checked" : ""} ${disabledAttr} />
        <span>${item.text}</span>
      </label>
    `;
    nextTrainingProgram.appendChild(li);
  });

  nextTrainingProgram.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      if (!isLoggedIn()) return;
      await toggleNextTrainingProgramItem(
        Number(event.target.dataset.index),
        event.target.checked
      );
    });
  });
}

async function toggleNextTrainingProgramItem(index, checked) {
  const nextTraining = getNextTraining();
  if (!nextTraining) return;

  const updatedProgram = nextTraining.program.map((item, itemIndex) => {
    if (itemIndex === index) {
      return { ...item, checked };
    }
    return item;
  });

  await updateTrainingInFirestore(nextTraining.id, {
    program: updatedProgram
  });
}

async function addNextTrainingProgramItem() {
  if (!isLoggedIn()) return;

  const text = nextProgramInput.value.trim();
  const nextTraining = getNextTraining();

  if (!nextTraining || text === "") return;

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

/* =========================
   VERGANGENE TRAININGS
========================= */
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

/* =========================
   ALLE TRAININGS
========================= */
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

  const actionButtons = isAdmin()
    ? `
      <div class="button-row">
        <button type="button" class="edit-training-btn" data-id="${training.id}">Bearbeiten</button>
        <button type="button" class="secondary delete-training-btn" data-id="${training.id}">Löschen</button>
      </div>
    `
    : "";

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

    ${actionButtons}
  `;

  return card;
}

function attachTrainingCardEvents() {
  if (!isAdmin()) return;

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

/* =========================
   ADMIN
========================= */
function addProgramItem() {
  if (!isAdmin()) return;

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
  if (!isAdmin()) return;

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
  if (!isAdmin()) return;

  const confirmed = window.confirm("Dieses Training wirklich löschen?");
  if (!confirmed) return;

  await deleteDoc(doc(db, TRAININGS_COLLECTION, trainingId));

  if (editingTrainingIdInput.value === trainingId) {
    resetForm();
  }
}

async function saveTraining() {
  if (!isAdmin()) return;

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

/* =========================
   PDF
========================= */
function showPdfError(message) {
  pdfError.textContent = message;
  pdfError.classList.remove("hidden");
}

function hidePdfError() {
  pdfError.textContent = "";
  pdfError.classList.add("hidden");
}

function getTrainingsInRange(fromDate, toDate) {
  return getSortedTrainings().filter((training) => {
    return training.date >= fromDate && training.date <= toDate;
  });
}

function getAllFridaysInRange(fromDate, toDate) {
  const result = [];
  const current = parseLocalDate(fromDate);
  const end = parseLocalDate(toDate);

  while (current.getDay() !== 5) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    result.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 7);
  }

  return result;
}

function getMissingFridays(fromDate, toDate, trainingsInRange) {
  const allFridays = getAllFridaysInRange(fromDate, toDate);
  const existingDates = new Set(trainingsInRange.map((training) => training.date));

  return allFridays.filter((date) => !existingDates.has(date));
}

function buildTrainingPdfLines(training) {
  const lines = [];

  lines.push(`Datum: ${formatDate(training.date)}`);
  lines.push(`Status: ${training.status}`);
  lines.push(`Fokus: ${training.focus || "-"}`);
  lines.push(`Leiter: ${training.leaders.length > 0 ? training.leaders.join(", ") : "-"}`);

  const programSource = isTrainingFinished(training)
    ? (
        training.finalizedProgram.length > 0
          ? training.finalizedProgram
          : training.program.map((item) => item.text)
      )
    : training.program.map((item) => item.text);

  if (programSource.length === 0) {
    lines.push("Programm: -");
  } else {
    lines.push("Programm:");
    programSource.forEach((item) => {
      lines.push(`- ${item}`);
    });
  }

  lines.push("");
  return lines;
}

async function generatePdf() {
  if (!isAdmin()) return;

  hidePdfError();

  const fromDate = pdfFromDateInput.value;
  const toDate = pdfToDateInput.value;

  if (!fromDate || !toDate) {
    showPdfError("Bitte Von- und Bis-Datum auswählen.");
    return;
  }

  if (fromDate > toDate) {
    showPdfError("Das Von-Datum muss vor dem Bis-Datum liegen.");
    return;
  }

  const trainingsInRange = getTrainingsInRange(fromDate, toDate);
  const missingFridays = getMissingFridays(fromDate, toDate, trainingsInRange);

  const { jsPDF } = await import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.es.js");

  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 14;
  const marginRight = 14;
  const maxWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = 5;

  let y = 16;

  function ensureSpace(linesNeeded = 1) {
    const neededHeight = linesNeeded * lineHeight;
    if (y + neededHeight > pageHeight - 15) {
      doc.addPage();
      y = 16;
    }
  }

  function addWrappedText(text, fontSize = 10, isBold = false, extraGap = 0) {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);

    const wrapped = doc.splitTextToSize(text, maxWidth);
    ensureSpace(wrapped.length);

    doc.text(wrapped, marginLeft, y);
    y += wrapped.length * lineHeight + extraGap;
  }

  addWrappedText("Jugendriege Glattfelden – Trainingsübersicht", 14, true, 2);
  addWrappedText(`Zeitraum: ${formatDateShort(fromDate)} bis ${formatDateShort(toDate)}`, 10, false, 3);

  const missingText =
    missingFridays.length > 0
      ? missingFridays.map((date) => formatDateShort(date)).join(", ")
      : "Keine";

  addWrappedText(`Fehlende Freitage ohne Eintrag: ${missingText}`, 10, true, 4);

  if (trainingsInRange.length === 0) {
    addWrappedText("Keine Trainings im gewählten Zeitraum vorhanden.", 11, false, 0);
  } else {
    trainingsInRange.forEach((training, index) => {
      const lines = buildTrainingPdfLines(training);

      ensureSpace(lines.length + 2);
      addWrappedText(`Training ${index + 1}`, 11, true, 1);

      lines.forEach((line) => {
        if (line === "") {
          y += 2;
        } else {
          addWrappedText(line, 10, false, 0);
        }
      });

      y += 2;
    });
  }

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

/* =========================
   FIRESTORE SYNC
========================= */
async function startFirestoreSync() {
  if (!db) {
    console.error("Firestore nicht verfügbar.");
    return;
  }

  if (isStartingFirestore) return;
  isStartingFirestore = true;

  onSnapshot(
    collection(db, TRAININGS_COLLECTION),
    async (snapshot) => {
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
    },
    (error) => {
      console.error("Firestore Sync Fehler:", error);
    }
  );
}

/* =========================
   EVENTS
========================= */
loginBtn.onclick = login;

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    login();
  }
});

usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    login();
  }
});

logoutBtn.onclick = logout;
addProgramBtn.onclick = addProgramItem;

programInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addProgramItem();
  }
});

addNextProgramBtn.onclick = async () => {
  await addNextTrainingProgramItem();
};

nextProgramInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    await addNextTrainingProgramItem();
  }
});

saveTrainingBtn.onclick = async () => {
  await saveTraining();
};

cancelEditBtn.onclick = () => {
  resetForm();
};

toggleLastTrainingsBtn.onclick = () => {
  lastTrainingsWrapper.classList.toggle("hidden");
  renderToggleButtons();
};

toggleAllTrainingsBtn.onclick = () => {
  allTrainingsWrapper.classList.toggle("hidden");
  renderToggleButtons();
};

if (togglePdfBtn) {
  togglePdfBtn.onclick = () => {
    pdfWrapper.classList.toggle("hidden");
    hidePdfError();
  };
}

if (generatePdfBtn) {
  generatePdfBtn.onclick = async () => {
    await generatePdf();
  };
}

/* =========================
   START
========================= */
applyRoleUI();
startFirestoreSync();
