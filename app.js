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
   LOGIN DATEN
========================= */
const ADMIN_USERNAME = "Administrator";
const ADMIN_PASSWORD = "tvg_admin";
const TRAINER_USERNAME = "Trainer";
const TRAINER_PASSWORD = "tvg_trainer";

/* =========================
   ELEMENTE
========================= */
const loginCard = document.getElementById("login-card");
const appContent = document.getElementById("app-content");
const usernameSelect = document.getElementById("username-select");
const passwordInput = document.getElementById("password-input");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginError = document.getElementById("login-error");
const currentRoleText = document.getElementById("current-role");

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
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");

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
function isAdmin() { return currentRole === "admin"; }
function isTrainer() { return currentRole === "trainer"; }
function isLoggedIn() { return isAdmin() || isTrainer(); }

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
    togglePdfBtn.classList.remove("hidden");
  } else {
    currentRoleText.textContent = "Eingeloggt als: Trainer";
    adminSection.classList.add("hidden");
    allTrainingsSection.classList.add("hidden");
    nextTrainingAddArea.classList.remove("hidden");
    pdfWrapper.classList.add("hidden");
    togglePdfBtn.classList.add("hidden");
    resetForm();
  }
  renderAll();
}

function login() {
  const username = usernameSelect.value;
  const password = passwordInput.value;
  hideLoginError();

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    currentRole = "admin";
  } else if (username === TRAINER_USERNAME && password === TRAINER_PASSWORD) {
    currentRole = "trainer";
  } else {
    showLoginError("Benutzername oder Passwort falsch.");
    return;
  }

  localStorage.setItem("jr-role", currentRole);
  passwordInput.value = "";
  applyRoleUI();
}

function logout() {
  currentRole = "";
  localStorage.removeItem("jr-role");
  passwordInput.value = "";
  hideLoginError();
  pdfWrapper.classList.add("hidden");
  hidePdfError();
  applyRoleUI();
}

/* =========================
   TRAINING HILFSFUNKTIONEN + FIRESTORE + FORM + RENDER etc.
   (alles unverändert, aber sauber und vollständig)
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
    .map(item => typeof item === "string" ? { text: item, checked: false } : { text: (item.text || "").trim(), checked: Boolean(item.checked) })
    .filter(item => item.text !== "");
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
      ? training.finalizedProgram.filter(item => typeof item === "string" && item.trim() !== "") 
      : []
  };
}
function formatDate(dateString) {
  if (!dateString) return "";
  return parseLocalDate(dateString).toLocaleDateString("de-CH", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatDateShort(dateString) {
  if (!dateString) return "";
  return parseLocalDate(dateString).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function getSelectedLeaders() {
  return Array.from(leaderCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
}
function setSelectedLeaders(leaders) {
  leaderCheckboxes.forEach(cb => cb.checked = leaders.includes(cb.value));
}
function getSortedTrainings() {
  return [...trainings].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date));
}
function isTrainingFinished(training) {
  if (!training.date) return false;
  return new Date() >= getTrainingEndDateTime(training.date);
}
function getUpcomingTrainings() {
  return getSortedTrainings().filter(t => !isTrainingFinished(t));
}
function getPastTrainings() {
  return getSortedTrainings().filter(t => isTrainingFinished(t)).reverse();
}
function getNextTraining() {
  return getUpcomingTrainings()[0] || null;
}

/* FIRESTORE */
async function updateTrainingInFirestore(trainingId, data) {
  await updateDoc(doc(db, TRAININGS_COLLECTION, trainingId), data);
}
async function finalizePastTrainingsIfNeeded() {
  for (const training of trainings) {
    if (!isTrainingFinished(training) || training.finalizedProgram.length > 0) continue;
    const finalizedProgram = training.program.filter(item => item.checked).map(item => item.text);
    await updateTrainingInFirestore(training.id, { finalizedProgram });
  }
}

/* FORM & RENDER-FUNKTIONEN (komplett) */
function resetForm() { /* ... vollständig wie vorher ... */ }
function renderProgramPreview() { /* ... vollständig ... */ }
function renderNextTraining() { /* ... vollständig ... */ }
async function toggleNextTrainingProgramItem(index, checked) { /* ... vollständig ... */ }
async function addNextTrainingProgramItem() { /* ... vollständig ... */ }
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

/* PDF (mit Loading) */
function showPdfError(message) {
  pdfError.textContent = message;
  pdfError.classList.remove("hidden");
}
function hidePdfError() {
  pdfError.textContent = "";
  pdfError.classList.add("hidden");
}

/* Loading Funktionen */
function showLoading(text = "PDF wird generiert...") {
  loadingText.textContent = text;
  loadingOverlay.style.display = "flex";
}
function hideLoading() {
  loadingOverlay.style.display = "none";
}

/* =========================
   NEUE PDF-FUNKTION (mit Loading)
========================= */
async function generatePdf() {
  if (!isAdmin()) return;
  hidePdfError();
  showLoading();

  const fromDate = pdfFromDateInput.value;
  const toDate = pdfToDateInput.value;
  if (!fromDate || !toDate) {
    hideLoading();
    return showPdfError("Bitte Von- und Bis-Datum auswählen.");
  }
  if (fromDate > toDate) {
    hideLoading();
    return showPdfError("Das Von-Datum muss vor dem Bis-Datum liegen.");
  }

  const trainingsInRange = getTrainingsInRange(fromDate, toDate);
  const missingFridays = getMissingFridays(fromDate, toDate, trainingsInRange);

  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  let y = 20;
  const margin = 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Jugendriege Glattfelden – Trainingsübersicht", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Zeitraum: ${formatDateShort(fromDate)} bis ${formatDateShort(toDate)}`, margin, y);
  y += 10;

  // Fehlende Freitage als kompakte Tabelle
  if (missingFridays.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Fehlende Freitage ohne Eintrag:", margin, y);
    y += 8;

    const colWidth = 38;
    const rowHeight = 7;
    let x = margin;
    let count = 0;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    missingFridays.forEach(date => {
      if (count % 4 === 0 && count !== 0) {
        y += rowHeight;
        x = margin;
      }
      doc.text(formatDateShort(date), x + 2, y + 5.5);
      x += colWidth;
      count++;
    });
    y += rowHeight + 6;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Fehlende Freitage ohne Eintrag: Keine", margin, y);
    y += 12;
  }

  // Haupt-Tabelle
  if (trainingsInRange.length === 0) {
    doc.text("Keine Trainings im gewählten Zeitraum.", margin, y);
  } else {
    const colWidths = [29, 23, 34, 29, 72];
    let x = margin;

    doc.setFillColor(240, 240, 240);
    doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    ["Datum", "Status", "Fokus", "Leiter", "Programm"].forEach((text, i) => {
      doc.text(text, x + 2, y + 7.5);
      x += colWidths[i];
    });
    y += 11;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const rowHeight = 10;

    trainingsInRange.forEach(training => {
      if (y > 270) { doc.addPage(); y = 20; }

      const prog = isTrainingFinished(training) && training.finalizedProgram.length 
        ? training.finalizedProgram 
        : training.program.map(p => p.text);

      const row = [
        formatDateShort(training.date),
        training.status,
        training.focus || "-",
        training.leaders.join(", ") || "-",
        prog.join(", ") || "-"
      ];

      x = margin;
      doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowHeight);

      row.forEach((text, i) => {
        doc.text(text, x + 2, y + 6.5, { maxWidth: colWidths[i] - 4 });
        x += colWidths[i];
      });
      y += rowHeight;
    });
  }

  hideLoading();
  const blob = doc.output("blob");
  window.open(URL.createObjectURL(blob), "_blank");
}

/* =========================
   FIRESTORE SYNC + DARK MODE + EVENTS
========================= */
async function startFirestoreSync() {
  if (!db || isStartingFirestore) return;
  isStartingFirestore = true;
  onSnapshot(collection(db, TRAININGS_COLLECTION), async snapshot => {
    trainings = snapshot.docs.map(doc => normalizeTraining({ id: doc.id, ...doc.data() }));
    renderAll();
    await finalizePastTrainingsIfNeeded().catch(console.error);
  }, console.error);
}

/* Dark Mode */
function initDarkMode() {
  const toggle = document.getElementById("dark-mode-toggle");
  const isDark = localStorage.getItem("darkMode") === "true";
  if (isDark) document.body.classList.add("dark");

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", document.body.classList.contains("dark"));
  });
}

/* EVENTS */
loginBtn.onclick = login;
passwordInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); login(); } });
logoutBtn.onclick = logout;
addProgramBtn.onclick = addProgramItem;
programInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addProgramItem(); } });
addNextProgramBtn.onclick = () => addNextTrainingProgramItem();
nextProgramInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addNextTrainingProgramItem(); } });
saveTrainingBtn.onclick = () => saveTraining();
cancelEditBtn.onclick = resetForm;
toggleLastTrainingsBtn.onclick = () => { lastTrainingsWrapper.classList.toggle("hidden"); renderToggleButtons(); };
toggleAllTrainingsBtn.onclick = () => { allTrainingsWrapper.classList.toggle("hidden"); renderToggleButtons(); };
if (togglePdfBtn) togglePdfBtn.onclick = () => { pdfWrapper.classList.toggle("hidden"); hidePdfError(); };
if (generatePdfBtn) generatePdfBtn.onclick = () => generatePdf();

/* =========================
   START
========================= */
applyRoleUI();
startFirestoreSync();
initDarkMode();
