/* LexiPerch: a local-first vocabulary notebook and practice tool. */
const BASE_WORDS = window.WORD_BUILDER_WORDS;
if (!Array.isArray(BASE_WORDS) || BASE_WORDS.length !== 1000 ||
    new Set(BASE_WORDS.map(word => word.id)).size !== 1000 ||
    new Set(BASE_WORDS.map(word => word.word.toLocaleLowerCase())).size !== 1000) {
  throw new Error("LexiPerch needs vocabulary.js with 1,000 unique entries.");
}

const STORAGE = {
  saved: "wordBuilderSaved",
  explored: "wordBuilderExplored",
  correct: "wordBuilderCorrect",
  custom: "wordBuilderCustomWords",
  name: "wordBuilderName",
  activity: "wordBuilderActivityDates"
};
const $ = id => document.getElementById(id);
const safeLoad = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const normalizeWord = value => String(value ?? "").trim().toLocaleLowerCase();
const normalizeDefinition = value => normalizeWord(value).replace(/\s+/g, " ");
const toCount = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const validTypes = ["noun", "verb", "adjective", "adverb", "other"];
const validLevels = ["Beginner", "Intermediate", "Advanced"];
const makeId = () => `custom-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
const mobileNavigation = window.matchMedia("(max-width: 760px)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const scrollBehavior = () => reducedMotion.matches ? "auto" : "smooth";

function pronunciationLabel(word) {
  const type = String(word.type ?? "").trim();
  return word.pronunciation
    ? `${word.pronunciation} \u00b7 ${type}`
    : `Pronunciation unavailable \u00b7 ${type}`;
}

function setNavigationOpen(open, restoreFocus = false) {
  const sidebar = $("sidebar");
  const button = $("menu-button");
  const wasOpen = sidebar.classList.contains("open");
  const shouldOpen = mobileNavigation.matches && Boolean(open);
  sidebar.classList.toggle("open", shouldOpen);
  sidebar.inert = mobileNavigation.matches && !shouldOpen;
  button.setAttribute("aria-expanded", String(shouldOpen));
  button.setAttribute("aria-label", shouldOpen ? "Close navigation" : "Open navigation");
  if (restoreFocus && wasOpen && mobileNavigation.matches) button.focus();
}

function syncNavigationForViewport() {
  const sidebar = $("sidebar");
  if (!mobileNavigation.matches) sidebar.classList.remove("open");
  sidebar.inert = mobileNavigation.matches && !sidebar.classList.contains("open");
  const isOpen = mobileNavigation.matches && sidebar.classList.contains("open");
  $("menu-button").setAttribute("aria-expanded", String(isOpen));
  $("menu-button").setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

function keepFocusInModal(event) {
  if (event.key !== "Tab") return;
  const modal = $("word-modal");
  if (modal.classList.contains("hidden")) return;
  const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.closest(".hidden"));
  if (!focusable.length) {
    event.preventDefault();
    $("modal-close").focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}

function normalizeCustomWord(entry) {
  if (!entry || typeof entry !== "object") return null;
  const word = String(entry.word ?? "").trim().slice(0, 60);
  const definition = String(entry.definition ?? "").trim().slice(0, 500);
  const example = String(entry.example ?? "").trim().slice(0, 300);
  if (!word || !definition || !example) return null;
  const rawId = String(entry.id ?? "");
  const id = /^[a-z0-9_-]{1,100}$/i.test(rawId) ? rawId : makeId();
  const rawType = String(entry.type ?? "other").toLowerCase();
  const rawLevel = String(entry.level ?? "Beginner");
  return {
    id, word,
    type: validTypes.includes(rawType) ? rawType : "other",
    pronunciation: String(entry.pronunciation ?? "").trim().slice(0, 80),
    level: validLevels.includes(rawLevel) ? rawLevel : "Beginner",
    definition, example
  };
}

function loadCustomWords() {
  const stored = safeLoad(STORAGE.custom, []);
  if (!Array.isArray(stored)) return [];
  const usedNames = new Set(BASE_WORDS.map(item => normalizeWord(item.word)));
  const usedIds = new Set(BASE_WORDS.map(item => item.id));
  return stored.map(normalizeCustomWord).filter(item => {
    if (!item || usedNames.has(normalizeWord(item.word)) || usedIds.has(item.id)) return false;
    usedNames.add(normalizeWord(item.word));
    usedIds.add(item.id);
    return true;
  });
}

let customWords = loadCustomWords();
let WORDS = [...BASE_WORDS, ...customWords];
const validIds = () => new Set(WORDS.map(word => word.id));
let saved = [...new Set((Array.isArray(safeLoad(STORAGE.saved, [])) ? safeLoad(STORAGE.saved, []) : []))].filter(id => validIds().has(id));
let explored = [...new Set((Array.isArray(safeLoad(STORAGE.explored, [])) ? safeLoad(STORAGE.explored, []) : []))].filter(id => validIds().has(id));
let correctTotal = toCount(safeLoad(STORAGE.correct, 0));
let displayName = String(safeLoad(STORAGE.name, "Learner")).trim().slice(0, 30) || "Learner";
let activityDates = [...new Set((Array.isArray(safeLoad(STORAGE.activity, [])) ? safeLoad(STORAGE.activity, []) : []).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
let currentWord = null;
let modalOpener = null;
let editingWordId = null;
let quizIndex = 0, quizScore = 0, quizAnswered = false;
let quizQuestions = [];
let quizCycleIds = new Set();
let visibleDictionaryCount = 60;
let puzzleQuestions = [];
let puzzleRoundIndex = 0;
let puzzleScore = 0;
let puzzleTiles = [];
let puzzleAnswer = [];
let puzzleHintUsed = false;
let puzzleSolved = false;

function persist() {
  try {
    localStorage.setItem(STORAGE.saved, JSON.stringify(saved));
    localStorage.setItem(STORAGE.explored, JSON.stringify(explored));
    localStorage.setItem(STORAGE.correct, JSON.stringify(correctTotal));
    localStorage.setItem(STORAGE.custom, JSON.stringify(customWords));
    localStorage.setItem(STORAGE.name, JSON.stringify(displayName));
    localStorage.setItem(STORAGE.activity, JSON.stringify(activityDates));
    return true;
  } catch {
    showToast("Your browser could not save changes. Export a backup before closing this page.");
    return false;
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDailyWord() {
  const date = new Date();
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return WORDS[((dayNumber % WORDS.length) + WORDS.length) % WORDS.length];
}

let dailyWord = getDailyWord();
function isSaved(id) { return saved.includes(id); }
function isCustom(id) { return customWords.some(word => word.id === id); }

function renderDailyWord() {
  dailyWord = getDailyWord();
  $("daily-word").textContent = dailyWord.word;
  $("daily-pronunciation").textContent = pronunciationLabel(dailyWord);
  $("daily-definition").textContent = dailyWord.definition;
  $("daily-example").textContent = dailyWord.example ? `\u201c${dailyWord.example}\u201d` : "Write your own sentence with this word.";
  $("save-daily").classList.toggle("saved", isSaved(dailyWord.id));
  $("save-daily").textContent = isSaved(dailyWord.id) ? "♥" : "♡";
  $("save-daily").setAttribute("aria-label", `${isSaved(dailyWord.id) ? "Remove" : "Save"} ${dailyWord.word}`);
}

function toggleSave(id) {
  const activeElement = document.activeElement;
  const restoreDailyFocus = activeElement?.id === "save-daily";
  const activeCardView = activeElement?.matches("[data-save-word]") ? activeElement.closest(".view") : null;
  if (isSaved(id)) {
    saved = saved.filter(item => item !== id);
    showToast("Removed from saved words.");
  } else {
    saved.push(id);
    showToast("Word saved to your collection.");
  }
  persist();
  renderStats();
  renderFeatured();
  renderDictionary();
  renderSaved();
  renderDailyWord();
  if (!$("word-modal").classList.contains("hidden") && currentWord?.id === id) updateModal();
  if (restoreDailyFocus) {
    $("save-daily").focus();
  } else if (activeCardView) {
    const visibleCardButtons = [...activeCardView.querySelectorAll("[data-save-word]")];
    const replacement = visibleCardButtons.find(button => button.dataset.saveWord === id)
      || visibleCardButtons[0]
      || activeCardView.querySelector("[data-goto]");
    replacement?.focus();
  }
}

function markActivity() {
  const today = localDateKey();
  if (!activityDates.includes(today)) {
    activityDates.push(today);
    activityDates = activityDates.sort().slice(-365);
    persist();
  }
  renderStreak();
}

function markExplored(id) {
  if (!explored.includes(id)) {
    explored.push(id);
    persist();
    renderStats();
  }
  markActivity();
}

function wordCard(word) {
  const savedClass = isSaved(word.id) ? " saved" : "";
  const levelClass = word.level.toLowerCase();
  const pronunciation = word.pronunciation ? ` · ${word.pronunciation}` : "";
  const ownWord = isCustom(word.id);
  return `<article class="word-card">
    <div class="word-card-top"><div><h3><button type="button" class="word-open" data-open-word="${escapeHTML(word.id)}">${escapeHTML(word.word)}</button></h3><span class="word-type">${escapeHTML(word.type)}${escapeHTML(pronunciation)}</span></div>
    <button type="button" class="save-small${savedClass}" data-save-word="${escapeHTML(word.id)}" aria-label="${isSaved(word.id) ? "Unsave" : "Save"} ${escapeHTML(word.word)}" aria-pressed="${isSaved(word.id)}">${isSaved(word.id) ? "♥" : "♡"}</button></div>
    <p>${escapeHTML(word.definition)}</p><div class="word-card-bottom"><span class="level-badge ${levelClass}">${escapeHTML(word.level)}</span>${ownWord ? '<span class="personal-word-label">MY WORD</span>' : ""}</div></article>`;
}

function attachCardEvents(container) {
  container.querySelectorAll("[data-open-word]").forEach(button => button.addEventListener("click", () => openWord(button.dataset.openWord)));
  container.querySelectorAll("[data-save-word]").forEach(button => button.addEventListener("click", event => {
    event.stopPropagation();
    toggleSave(button.dataset.saveWord);
  }));
  container.querySelectorAll(".word-card").forEach(card => card.addEventListener("click", event => {
    if (event.target.closest("button")) return;
    const wordButton = card.querySelector("[data-open-word]");
    if (wordButton) openWord(wordButton.dataset.openWord, wordButton);
  }));
}

function renderFeatured() {
  const words = WORDS.filter(word => word.id !== dailyWord.id);
  const start = WORDS.length ? (WORDS.indexOf(dailyWord) + 1) % WORDS.length : 0;
  const featured = Array.from({length: Math.min(6, words.length)}, (_, index) => WORDS[(start + index) % WORDS.length]).filter(word => word && word.id !== dailyWord.id);
  $("featured-words").innerHTML = featured.map(wordCard).join("");
  attachCardEvents($("featured-words"));
}

function renderDictionary() {
  if (!$("word-search")) return;
  const query = $("word-search").value.trim().toLocaleLowerCase();
  const level = $("level-filter").value;
  const filtered = WORDS.filter(word => (level === "all" || word.level === level) && [word.word, word.definition, word.example, word.type, word.pronunciation, word.level].some(value => value.toLocaleLowerCase().includes(query)));
  const visibleWords = filtered.slice(0, visibleDictionaryCount);
  $("dictionary-words").innerHTML = visibleWords.map(wordCard).join("");
  $("results-count").textContent = filtered.length > visibleWords.length
    ? `Showing ${visibleWords.length} of ${filtered.length} words`
    : `${filtered.length} word${filtered.length === 1 ? "" : "s"} to explore`;
  $("dictionary-empty").classList.toggle("hidden", filtered.length > 0);
  $("load-more-words").classList.toggle("hidden", filtered.length <= visibleWords.length);
  attachCardEvents($("dictionary-words"));
}

function renderSaved() {
  const words = WORDS.filter(word => isSaved(word.id));
  $("saved-words").innerHTML = words.map(wordCard).join("");
  $("saved-empty").classList.toggle("hidden", words.length > 0);
  attachCardEvents($("saved-words"));
}

function renderStats() {
  $("stat-explored").textContent = explored.length;
  $("stat-saved").textContent = saved.length;
  $("stat-correct").textContent = correctTotal;
  $("saved-count").textContent = saved.length;
}

function renderStreak() {
  const dates = new Set(activityDates);
  const today = new Date();
  const todayKey = localDateKey(today);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  let cursor = dates.has(todayKey) ? today : yesterday;
  let count = 0;
  while (dates.has(localDateKey(cursor))) {
    count++;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  if (count === 0) {
    $("streak-title").textContent = "Start a learning streak";
    $("streak-copy").textContent = "Explore a word or answer a quiz question to record a learning day.";
  } else if (dates.has(todayKey)) {
    $("streak-title").textContent = `${count}-day learning streak`;
    $("streak-copy").textContent = "Great work. Come back tomorrow to keep it going.";
  } else {
    $("streak-title").textContent = `${count}-day streak ready to continue`;
    $("streak-copy").textContent = "Explore a word today to keep your momentum.";
  }
}

function renderProfile() {
  $("profile-name").textContent = displayName;
  $("profile-avatar").textContent = displayName.trim().charAt(0).toLocaleUpperCase() || "L";
}

function renderAll() {
  renderDailyWord();
  renderStats();
  renderStreak();
  renderProfile();
  renderFeatured();
  renderDictionary();
  renderSaved();
}

function openWord(id, opener = document.activeElement) {
  const word = WORDS.find(item => item.id === id);
  if (!word) return;
  currentWord = word;
  modalOpener = opener;
  markExplored(id);
  updateModal();
  $("word-modal").classList.remove("hidden");
  $("app-shell").inert = true;
  $("modal-close").focus();
}

function updateModal() {
  if (!currentWord) return;
  $("modal-word").textContent = currentWord.word;
  $("modal-pronunciation").textContent = pronunciationLabel(currentWord);
  $("modal-level").textContent = currentWord.level;
  $("modal-level").className = `level-badge ${currentWord.level.toLowerCase()}`;
  $("modal-definition").textContent = currentWord.definition;
  $("modal-example").textContent = currentWord.example ? `\u201c${currentWord.example}\u201d` : "Try using this word in a sentence of your own.";
  $("modal-save").textContent = isSaved(currentWord.id) ? "♥ Saved word" : "♡ Save word";
  $("modal-edit").classList.toggle("hidden", !isCustom(currentWord.id));
  $("modal-delete").classList.toggle("hidden", !isCustom(currentWord.id));
}

function closeModal(restoreFocus = true) {
  $("word-modal").classList.add("hidden");
  $("app-shell").inert = false;
  if (restoreFocus) {
    if (modalOpener?.isConnected) modalOpener.focus();
    else if (mobileNavigation.matches) $("menu-button").focus();
    else $("brand-home").focus();
  }
  modalOpener = null;
}

function goTo(view, updateUrl = true) {
  const availableViews = ["dashboard", "dictionary", "practice", "puzzle", "saved"];
  if (!availableViews.includes(view)) view = "dashboard";
  document.querySelectorAll(".view").forEach(element => element.classList.toggle("active", element.id === `view-${view}`));
  document.querySelectorAll(".nav-item").forEach(element => {
    const active = element.dataset.view === view;
    element.classList.toggle("active", active);
    if (active) element.setAttribute("aria-current", "page");
    else element.removeAttribute("aria-current");
  });
  const labels = {dashboard:"Dashboard", dictionary:"Explore words", practice:"Practice quiz", puzzle:"Word puzzle", saved:"Saved words"};
  if (view === "puzzle" && puzzleQuestions.length === 0) startPuzzleGame();
  $("page-crumb").textContent = labels[view];
  setNavigationOpen(false, true);
  window.scrollTo({top:0, behavior:scrollBehavior()});
  if (updateUrl && location.hash !== `#${view}`) {
    try {
      history.pushState({view}, "", `#${view}`);
    } catch {
      location.hash = view;
    }
  }
  if (view === "saved") renderSaved();
}

function speakWord(word) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    showToast("Speech playback is not available in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.word);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getQuizOptions(word) {
  const usedDefinitions = new Set([normalizeDefinition(word.definition)]);
  const distractors = [];
  for (const candidate of shuffle(WORDS.filter(item => item.id !== word.id))) {
    const definition = normalizeDefinition(candidate.definition);
    if (usedDefinitions.has(definition)) continue;
    usedDefinitions.add(definition);
    distractors.push(candidate);
    if (distractors.length === 3) break;
  }
  return shuffle([...distractors, word]);
}

function setupQuiz() {
  let availableWords = WORDS.filter(word => !quizCycleIds.has(word.id));
  if (availableWords.length === 0) {
    quizCycleIds.clear();
    availableWords = [...WORDS];
  }
  const questionCount = Math.min(10, availableWords.length);
  quizQuestions = shuffle(availableWords).slice(0, questionCount);
  quizQuestions.forEach(word => quizCycleIds.add(word.id));
  quizIndex = 0;
  quizScore = 0;
  $("quiz-footer").classList.remove("quiz-finished");
  renderQuestion();
}

function renderQuestion() {
  quizAnswered = false;
  const word = quizQuestions[quizIndex];
  if (!word) return;
  $("quiz-progress").textContent = `QUESTION ${quizIndex + 1} OF ${quizQuestions.length}`;
  $("quiz-progress-fill").style.width = `${(quizIndex / quizQuestions.length) * 100}%`;
  $("quiz-word").textContent = word.word;
  $("quiz-pronunciation").textContent = pronunciationLabel(word);
  $("quiz-score").textContent = `Score: ${quizScore}`;
  $("quiz-feedback").textContent = "";
  $("quiz-feedback").className = "quiz-feedback";
  $("next-question").disabled = true;
  $("next-question").textContent = quizIndex === quizQuestions.length - 1 ? "Finish quiz →" : "Next question →";
  const options = getQuizOptions(word);
  $("answer-list").innerHTML = options.map((option, index) => `<button type="button" class="answer-option" data-answer="${escapeHTML(option.id)}"><span class="answer-letter">${String.fromCharCode(65 + index)}</span><span>${escapeHTML(option.definition)}</span></button>`).join("");
  $("answer-list").querySelectorAll("[data-answer]").forEach(button => button.addEventListener("click", () => chooseAnswer(button.dataset.answer, word.id)));
}

function chooseAnswer(selected, correct) {
  if (quizAnswered) return;
  quizAnswered = true;
  markActivity();
  const right = selected === correct;
  if (right) {
    quizScore++;
    correctTotal++;
    persist();
  }
  $("answer-list").querySelectorAll("[data-answer]").forEach(button => {
    button.disabled = true;
    if (button.dataset.answer === correct) button.classList.add("correct");
    else if (button.dataset.answer === selected) button.classList.add("wrong");
  });
  const answer = WORDS.find(word => word.id === correct);
  $("quiz-feedback").textContent = right ? "Exactly right! Great work — keep it up." : `Not quite. ${answer.word}: ${answer.definition}`;
  $("quiz-feedback").classList.add(right ? "good" : "bad");
  $("quiz-score").textContent = `Score: ${quizScore}`;
  $("quiz-progress-fill").style.width = `${((quizIndex + 1) / quizQuestions.length) * 100}%`;
  $("next-question").disabled = false;
  renderStats();
}

function nextQuestion() {
  if (!quizAnswered) return;
  if (quizIndex < quizQuestions.length - 1) {
    quizIndex++;
    renderQuestion();
    return;
  }
  $("quiz-word").textContent = `${quizScore} / ${quizQuestions.length}`;
  $("quiz-pronunciation").textContent = "Quiz complete · Every attempt helps you learn";
  $("answer-list").innerHTML = `<div class="empty-panel"><div class="empty-icon">✦</div><h3>${quizScore >= Math.ceil(quizQuestions.length * 0.8) ? "Excellent work!" : "Nice effort!"}</h3><p>Review the words you missed, then try again to improve your score.</p><button class="button button-primary" id="restart-quiz" type="button">Try another quiz</button></div>`;
  $("restart-quiz").addEventListener("click", setupQuiz);
  $("quiz-feedback").textContent = `You answered ${quizScore} out of ${quizQuestions.length} correctly.`;
  $("next-question").disabled = true;
  $("next-question").textContent = "Quiz completed";
}

function puzzleWord() {
  return puzzleQuestions[puzzleRoundIndex] || null;
}

function startPuzzleGame() {
  const eligibleWords = WORDS.filter(word => /^[a-z]{4,9}$/i.test(word.word));
  puzzleQuestions = shuffle(eligibleWords).slice(0, Math.min(5, eligibleWords.length));
  puzzleRoundIndex = 0;
  puzzleScore = 0;
  $("puzzle-round-panel").classList.remove("hidden");
  $("puzzle-complete").classList.add("hidden");
  if (!puzzleQuestions.length) {
    $("puzzle-status").textContent = "Add a word with 4 to 9 letters to start a puzzle.";
    return;
  }
  renderPuzzleRound();
}

function renderPuzzleRound() {
  const word = puzzleWord();
  if (!word) return;
  puzzleTiles = shuffle([...word.word.toLocaleUpperCase()].map((letter, id) => ({id, letter})));
  if (puzzleTiles.map(tile => tile.letter).join("") === word.word.toLocaleUpperCase()) {
    puzzleTiles = [...puzzleTiles.slice(1), puzzleTiles[0]];
  }
  puzzleAnswer = [];
  puzzleHintUsed = false;
  puzzleSolved = false;
  $("puzzle-status").textContent = "";
  renderPuzzleBoard();
}

function renderPuzzleBoard() {
  const word = puzzleWord();
  if (!word) return;
  const placedIds = new Set(puzzleAnswer);
  $("puzzle-round-label").textContent = `ROUND ${puzzleRoundIndex + 1} OF ${puzzleQuestions.length}`;
  $("puzzle-score").textContent = `Score: ${puzzleScore}`;
  $("puzzle-definition").textContent = word.definition;
  $("puzzle-type").textContent = `${word.type} - ${word.word.length} letters`;
  const progress = Math.round(((puzzleRoundIndex + (puzzleSolved ? 1 : 0)) / puzzleQuestions.length) * 100);
  $("puzzle-progress-fill").style.width = `${progress}%`;
  $("puzzle-progress-track").setAttribute("aria-valuenow", String(puzzleRoundIndex + (puzzleSolved ? 1 : 0)));
  $("puzzle-answer").innerHTML = Array.from({length: puzzleTiles.length}, (_, slot) => {
    const tileId = puzzleAnswer[slot];
    if (tileId === undefined) return '<span class="puzzle-slot" aria-hidden="true"></span>';
    const tile = puzzleTiles.find(item => item.id === tileId);
    return `<button class="puzzle-slot is-filled" type="button" data-puzzle-remove="${slot}" aria-label="Remove ${escapeHTML(tile.letter)} from position ${slot + 1}">${escapeHTML(tile.letter)}</button>`;
  }).join("");
  $("puzzle-tiles").innerHTML = puzzleTiles.map(tile => `<button class="puzzle-tile" type="button" data-puzzle-tile="${tile.id}" aria-label="Use letter ${escapeHTML(tile.letter)}" ${placedIds.has(tile.id) || puzzleSolved ? "disabled" : ""}>${escapeHTML(tile.letter)}</button>`).join("");
  $("puzzle-tiles").querySelectorAll("[data-puzzle-tile]").forEach(button => button.addEventListener("click", () => placePuzzleTile(Number(button.dataset.puzzleTile))));
  $("puzzle-answer").querySelectorAll("[data-puzzle-remove]").forEach(button => button.addEventListener("click", () => removePuzzleLetter(Number(button.dataset.puzzleRemove))));
  $("puzzle-clear").disabled = puzzleSolved || puzzleAnswer.length === 0;
  $("puzzle-shuffle").disabled = puzzleSolved;
  $("puzzle-hint").disabled = puzzleSolved || puzzleHintUsed;
  $("puzzle-hint").textContent = puzzleHintUsed ? "Hint used" : "Hint (8 pts)";
  $("puzzle-check").textContent = puzzleSolved ? "Next word" : "Check word";
}

function placePuzzleTile(tileId) {
  if (puzzleSolved || puzzleAnswer.includes(tileId) || puzzleAnswer.length >= puzzleTiles.length) return;
  puzzleAnswer.push(tileId);
  $("puzzle-status").textContent = "";
  renderPuzzleBoard();
  const nextTile = $("puzzle-tiles").querySelector("[data-puzzle-tile]:not(:disabled)");
  (nextTile || $("puzzle-check")).focus();
}

function removePuzzleLetter(slot) {
  if (puzzleSolved || slot < 0 || slot >= puzzleAnswer.length) return;
  const returnedTileId = puzzleAnswer[slot];
  puzzleAnswer.splice(slot, 1);
  $("puzzle-status").textContent = "";
  renderPuzzleBoard();
  $("puzzle-tiles").querySelector(`[data-puzzle-tile="${returnedTileId}"]`)?.focus();
}

function usePuzzleHint() {
  const word = puzzleWord();
  if (!word || puzzleSolved || puzzleHintUsed) return;
  puzzleHintUsed = true;
  $("puzzle-status").textContent = `Hint: the word starts with ${word.word.charAt(0).toLocaleUpperCase()}. It is worth 8 points if you solve it.`;
  renderPuzzleBoard();
  $("puzzle-hint").disabled = true;
}

function shufflePuzzleLetters() {
  if (puzzleSolved) return;
  puzzleTiles = shuffle(puzzleTiles);
  $("puzzle-status").textContent = "The remaining letters have been shuffled.";
  renderPuzzleBoard();
}

function clearPuzzleAnswer() {
  if (puzzleSolved) return;
  puzzleAnswer = [];
  $("puzzle-status").textContent = "Letters cleared. Try again.";
  renderPuzzleBoard();
}

function checkPuzzleAnswer() {
  const word = puzzleWord();
  if (!word) return;
  if (puzzleSolved) {
    puzzleRoundIndex++;
    if (puzzleRoundIndex >= puzzleQuestions.length) {
      finishPuzzleGame();
    } else {
      renderPuzzleRound();
    }
    return;
  }
  if (puzzleAnswer.length !== puzzleTiles.length) {
    $("puzzle-status").textContent = "Place every letter before checking your answer.";
    return;
  }
  const answer = puzzleAnswer.map(tileId => puzzleTiles.find(tile => tile.id === tileId).letter).join("");
  if (answer !== word.word.toLocaleUpperCase()) {
    $("puzzle-status").textContent = "Not quite. Rearrange the letters and try again.";
    return;
  }
  puzzleSolved = true;
  const points = puzzleHintUsed ? 8 : 10;
  puzzleScore += points;
  markExplored(word.id);
  renderPuzzleBoard();
  $("puzzle-status").textContent = `Correct! ${word.word} earns ${points} points.`;
}

function finishPuzzleGame() {
  $("puzzle-round-panel").classList.add("hidden");
  $("puzzle-complete").classList.remove("hidden");
  $("puzzle-round-label").textContent = "PUZZLE COMPLETE";
  $("puzzle-score").textContent = `Score: ${puzzleScore}`;
  $("puzzle-progress-fill").style.width = "100%";
  $("puzzle-progress-track").setAttribute("aria-valuenow", String(puzzleQuestions.length));
  $("puzzle-result").textContent = `You scored ${puzzleScore} out of ${puzzleQuestions.length * 10} points across ${puzzleQuestions.length} words.`;
}

function showWordForm(word = null) {
  editingWordId = word?.id ?? null;
  $("word-form").reset();
  $("entry-type").value = "noun";
  $("entry-level").value = "Beginner";
  $("word-form-message").textContent = "";
  $("word-form-title").textContent = word ? `Edit ${word.word}` : "Add a word";
  $("save-word-entry").textContent = word ? "Save changes" : "Add to my dictionary";
  $("cancel-word-edit").classList.toggle("hidden", !word);
  if (word) {
    $("entry-word").value = word.word;
    $("entry-type").value = word.type;
    $("entry-pronunciation").value = word.pronunciation;
    $("entry-level").value = word.level;
    $("entry-definition").value = word.definition;
    $("entry-example").value = word.example;
  }
  $("word-form-panel").classList.remove("hidden");
  $("toggle-word-form").setAttribute("aria-expanded", "true");
  goTo("dictionary");
  $("entry-word").focus();
  $("word-form-panel").scrollIntoView({behavior:scrollBehavior(), block:"start"});
}

function closeWordForm() {
  editingWordId = null;
  $("word-form").reset();
  $("word-form-panel").classList.add("hidden");
  $("toggle-word-form").setAttribute("aria-expanded", "false");
  $("word-form-title").textContent = "Add a word";
  $("save-word-entry").textContent = "Add to my dictionary";
  $("cancel-word-edit").classList.add("hidden");
  $("word-form-message").textContent = "";
}

function submitWordForm(event) {
  event.preventDefault();
  const entry = normalizeCustomWord({
    id: editingWordId || makeId(),
    word: $("entry-word").value,
    type: $("entry-type").value,
    pronunciation: $("entry-pronunciation").value,
    level: $("entry-level").value,
    definition: $("entry-definition").value,
    example: $("entry-example").value
  });
  if (!entry) {
    $("word-form-message").textContent = "Add a word, meaning, and example sentence.";
    return;
  }
  const duplicate = WORDS.find(word => normalizeWord(word.word) === normalizeWord(entry.word) && word.id !== editingWordId);
  if (duplicate) {
    $("word-form-message").textContent = `“${duplicate.word}” is already in your dictionary.`;
    $("entry-word").focus();
    return;
  }
  const wasEditing = Boolean(editingWordId);
  if (wasEditing) customWords = customWords.map(word => word.id === editingWordId ? entry : word);
  else customWords.push(entry);
  WORDS = [...BASE_WORDS, ...customWords];
  closeWordForm();
  persist();
  renderAll();
  showToast(wasEditing ? "Word updated." : "Word added to your dictionary.");
  if (!wasEditing) openWord(entry.id, $("toggle-word-form"));
}

function deleteWord(id) {
  const word = customWords.find(item => item.id === id);
  const activeView = document.querySelector(".view.active");
  if (!word || !window.confirm(`Delete “${word.word}” from your personal dictionary?`)) return;
  customWords = customWords.filter(item => item.id !== id);
  saved = saved.filter(item => item !== id);
  explored = explored.filter(item => item !== id);
  WORDS = [...BASE_WORDS, ...customWords];
  closeModal();
  persist();
  renderAll();
  setupQuiz();
  const nextControl = activeView?.querySelector("[data-open-word], [data-goto]");
  nextControl?.focus();
  showToast("Word deleted.");
}

function exportBackup() {
  const backup = {
    format: "word-builder-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    displayName,
    customWords,
    saved,
    explored,
    correctTotal,
    activityDates
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lexiperch-backup-${localDateKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Backup downloaded.");
}

async function importBackup(file) {
  try {
    const backup = JSON.parse(await file.text());
    if (backup?.format !== "word-builder-backup" || backup.version !== 1 || !Array.isArray(backup.customWords) || !Array.isArray(backup.saved) || !Array.isArray(backup.explored) || !Array.isArray(backup.activityDates)) {
      throw new Error("This file is not a supported LexiPerch backup.");
    }
    if (!window.confirm("Import this backup and replace the words and progress saved in this browser?")) return;
    const baseNames = new Set(BASE_WORDS.map(word => normalizeWord(word.word)));
    const seenNames = new Set(baseNames);
    const seenIds = new Set(BASE_WORDS.map(word => word.id));
    customWords = backup.customWords.map(normalizeCustomWord).filter(word => {
      if (!word || seenNames.has(normalizeWord(word.word)) || seenIds.has(word.id)) return false;
      seenNames.add(normalizeWord(word.word));
      seenIds.add(word.id);
      return true;
    });
    WORDS = [...BASE_WORDS, ...customWords];
    const ids = validIds();
    saved = [...new Set(backup.saved.filter(id => typeof id === "string" && ids.has(id)))];
    explored = [...new Set(backup.explored.filter(id => typeof id === "string" && ids.has(id)))];
    correctTotal = toCount(backup.correctTotal);
    displayName = String(backup.displayName || "Learner").trim().slice(0, 30) || "Learner";
    activityDates = [...new Set(backup.activityDates.filter(date => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort().slice(-365);
    persist();
    closeWordForm();
    renderAll();
    setupQuiz();
    showToast("Backup restored.");
  } catch (error) {
    showToast(error instanceof SyntaxError ? "The selected file is not valid JSON." : error.message || "Could not import that backup.");
  }
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => goTo(button.dataset.view)));
document.querySelectorAll("[data-goto]").forEach(button => button.addEventListener("click", () => goTo(button.dataset.goto)));
$("brand-home").addEventListener("click", event => { event.preventDefault(); goTo("dashboard"); });
$("word-search").addEventListener("input", () => { visibleDictionaryCount = 60; renderDictionary(); });
$("level-filter").addEventListener("change", () => { visibleDictionaryCount = 60; renderDictionary(); });
$("load-more-words").addEventListener("click", () => { visibleDictionaryCount += 60; renderDictionary(); });
$("learn-daily").addEventListener("click", () => openWord(dailyWord.id));
$("speak-daily").addEventListener("click", () => speakWord(dailyWord));
$("save-daily").addEventListener("click", () => toggleSave(dailyWord.id));
$("modal-close").addEventListener("click", () => closeModal());
$("modal-done").addEventListener("click", () => closeModal());
$("word-modal").addEventListener("click", event => { if (event.target === $("word-modal")) closeModal(); });
$("modal-save").addEventListener("click", () => toggleSave(currentWord.id));
$("modal-speak").addEventListener("click", () => speakWord(currentWord));
$("modal-edit").addEventListener("click", () => {
  const word = currentWord;
  closeModal(false);
  showWordForm(word);
});
$("modal-delete").addEventListener("click", () => { if (currentWord) deleteWord(currentWord.id); });
$("next-question").addEventListener("click", nextQuestion);
$("puzzle-hint").addEventListener("click", usePuzzleHint);
$("puzzle-shuffle").addEventListener("click", shufflePuzzleLetters);
$("puzzle-clear").addEventListener("click", clearPuzzleAnswer);
$("puzzle-check").addEventListener("click", checkPuzzleAnswer);
$("puzzle-play-again").addEventListener("click", startPuzzleGame);
$("menu-button").addEventListener("click", () => setNavigationOpen(!$("sidebar").classList.contains("open")));
$("edit-profile").addEventListener("click", () => {
  const nextName = window.prompt("What name should LexiPerch use?", displayName);
  if (nextName === null) return;
  const name = nextName.trim().slice(0, 30);
  if (!name) { showToast("Enter a name to update your profile."); return; }
  displayName = name;
  persist();
  renderProfile();
});
$("toggle-word-form").addEventListener("click", () => {
  if ($( "word-form-panel").classList.contains("hidden")) showWordForm();
  else closeWordForm();
});
$("close-word-form").addEventListener("click", closeWordForm);
$("cancel-word-edit").addEventListener("click", closeWordForm);
$("word-form").addEventListener("submit", submitWordForm);
$("export-data").addEventListener("click", exportBackup);
$("import-data").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", event => {
  const [file] = event.target.files;
  if (file) importBackup(file);
  event.target.value = "";
});
document.addEventListener("keydown", event => {
  const modalOpen = !$("word-modal").classList.contains("hidden");
  if (event.key === "Tab" && modalOpen) {
    keepFocusInModal(event);
    return;
  }
  if (event.key !== "Escape") return;
  if (modalOpen) {
    closeModal();
    return;
  }
  if ($("sidebar").classList.contains("open")) setNavigationOpen(false, true);
});
window.addEventListener("popstate", () => goTo(location.hash.slice(1), false));
window.addEventListener("hashchange", () => goTo(location.hash.slice(1), false));
window.addEventListener("resize", syncNavigationForViewport);

const today = new Date();
$("today-date").textContent = new Intl.DateTimeFormat(undefined, {weekday:"short", month:"short", day:"numeric"}).format(today);
$("year").textContent = today.getFullYear();
syncNavigationForViewport();
renderAll();
setupQuiz();
goTo(location.hash.slice(1) || "dashboard", false);
