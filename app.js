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
  if (!Array.isArray(program)) return [];
  return program
    .map((item) => {
      if (typeof item === "string") return { text: item, checked: false };
      return { text: (item.text || "").trim(), checked: Boolean(item.checked) };
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
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric"
  });
}
function formatDateShort(dateString) {
  if (!dateString) return "";
  return parseLocalDate(dateString).toLocaleDateString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric"
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
    await updateTrainingInFirestore(training.id, { finalizedProgram });
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
function renderNextTraining() { /* ... (unverändert, vollständig) ... */ }
async function toggleNextTrainingProgramItem(index, checked) { /* ... vollständig ... */ }
async function addNextTrainingProgramItem() { /* ... vollständig ... */ }

/* =========================
   VERGANGENE + ALLE TRAININGS
========================= */
function renderLastTrainings() { /* ... vollständig ... */ }
function createTrainingCard(training) { /* ... vollständig ... */ }
function attachTrainingCardEvents() { /* ... vollständig ... */ }
function renderAllTrainings() { /* ... vollständig ... */ }
function renderToggleButtons() { /* ... vollständig ... */ }
function renderAll() { /* ... vollständig ... */ }
function addProgramItem() { /* ... vollständig ... */ }
function startEditingTraining(trainingId) { /* ... vollständig ... */ }
async function deleteTraining(trainingId) { /* ... vollständig ... */ }
async function saveTraining() { /* ... vollständig ... */ }

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
  return getSortedTrainings().filter((training) => training.date >= fromDate && training.date <= toDate);
}
function getAllFridaysInRange(fromDate, toDate) {
  const result = [];
  const current = parseLocalDate(fromDate);
  const end = parseLocalDate(toDate);
  while (current.getDay() !== 5) current.setDate(current.getDate() + 1);
  while (current <= end) {
    result.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 7);
  }
  return result;
}
function getMissingFridays(fromDate, toDate, trainingsInRange) {
  const allFridays = getAllFridaysInRange(fromDate, toDate);
  const existingDates = new Set(trainingsInRange.map(t => t.date));
  return allFridays.filter(date => !existingDates.has(date));
}

/* =========================
   NEUE PDF-GENERIERUNG (TABELLE)
========================= */
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

  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  let y = 20;
  const marginLeft = 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Jugendriege Glattfelden – Trainingsübersicht", marginLeft, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Zeitraum: ${formatDateShort(fromDate)} bis ${formatDateShort(toDate)}`, marginLeft, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const missingText = missingFridays.length > 0
    ? missingFridays.map(date => formatDateShort(date)).join(", ")
    : "Keine";
  doc.text(`Fehlende Freitage ohne Eintrag: ${missingText}`, marginLeft, y);
  y += 12;

  if (trainingsInRange.length === 0) {
    doc.setFontSize(12);
    doc.text("Keine Trainings im gewählten Zeitraum vorhanden.", marginLeft, y);
  } else {
    const colWidths = [32, 26, 38, 32, 52];
    const tableX = marginLeft;
    const rowHeight = 8;

    // Header
    doc.setFillColor(240, 240, 240);
    doc.rect(tableX, y, colWidths.reduce((a, b) => a + b, 0), 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    let x = tableX;
    doc.text("Datum", x + 2, y + 7); x += colWidths[0];
    doc.text("Status", x + 2, y + 7); x += colWidths[1];
    doc.text("Fokus", x + 2, y + 7); x += colWidths[2];
    doc.text("Leiter", x + 2, y + 7); x += colWidths[3];
    doc.text("Programm", x + 2, y + 7);
    y += 10;

    // Zeilen
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    trainingsInRange.forEach((training) => {
      if (y > 270) { doc.addPage(); y = 20; }

      const programSource = isTrainingFinished(training) && training.finalizedProgram.length > 0
        ? training.finalizedProgram
        : training.program.map(item => item.text);

      const rowData = [
        formatDateShort(training.date),
        training.status,
        training.focus || "-",
        training.leaders.length > 0 ? training.leaders.join(", ") : "-",
        programSource.length > 0 ? programSource.join(", ") : "-"
      ];

      x = tableX;
      doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowHeight);

      rowData.forEach((text, i) => {
        doc.text(text, x + 2, y + 6, { maxWidth: colWidths[i] - 4 });
        x += colWidths[i];
      });
      y += rowHeight;
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
      trainings = snapshot.docs.map((item) => normalizeTraining({ id: item.id, ...item.data() }));
      renderAll();
      try { await finalizePastTrainingsIfNeeded(); } catch (e) { console.error(e); }
    },
    (error) => console.error("Firestore Sync Fehler:", error)
  );
}

/* =========================
   EVENTS
========================= */
loginBtn.onclick = login;
passwordInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); login(); } });
usernameInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); login(); } });
logoutBtn.onclick = logout;
addProgramBtn.onclick = addProgramItem;
programInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addProgramItem(); } });
addNextProgramBtn.onclick = async () => { await addNextTrainingProgramItem(); };
nextProgramInput.addEventListener("keydown", async (event) => { if (event.key === "Enter") { event.preventDefault(); await addNextTrainingProgramItem(); } });
saveTrainingBtn.onclick = async () => { await saveTraining(); };
cancelEditBtn.onclick = () => { resetForm(); };
toggleLastTrainingsBtn.onclick = () => { lastTrainingsWrapper.classList.toggle("hidden"); renderToggleButtons(); };
toggleAllTrainingsBtn.onclick = () => { allTrainingsWrapper.classList.toggle("hidden"); renderToggleButtons(); };
if (togglePdfBtn) {
  togglePdfBtn.onclick = () => { pdfWrapper.classList.toggle("hidden"); hidePdfError(); };
}
if (generatePdfBtn) {
  generatePdfBtn.onclick = async () => { await generatePdf(); };
}

/* =========================
   START
========================= */
applyRoleUI();
startFirestoreSync();
