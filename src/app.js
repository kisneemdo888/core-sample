import COURSES from "./courses/index.js";
import * as sm2 from "./sm2.js";
import * as storage from "./storage.js";

var LETTERS = ["A", "B", "C", "D"];

var state = {
  courseIdx: 0,
  mode: "cards", // cards | quiz | progress
  queue: [],
  queuePos: 0,
  quizIdx: 0,
  quizScore: 0,
  exam: null // null | { phase:'setup'|'running'|'done', ... }
};
var progress = storage.load();

var railEl = document.getElementById("rail");
var overallEl = document.getElementById("overallStats");
var codeEl = document.getElementById("courseCode");
var nameTREl = document.getElementById("courseNameTR");
var nameENEl = document.getElementById("courseNameEN");
var coursePanelEl = document.getElementById("coursePanel");
var examPanelEl = document.getElementById("examPanel");
var examBodyEl = document.getElementById("examBody");
var cardsViewEl = document.getElementById("cardsView");
var quizViewEl = document.getElementById("quizView");
var progressViewEl = document.getElementById("progressView");
var cardsEmptyEl = document.getElementById("cardsEmpty");
var cardsActiveEl = document.getElementById("cardsActive");
var flashcardEl = document.getElementById("flashcard");
var cardTermTR = document.getElementById("cardTermTR");
var cardTermEN = document.getElementById("cardTermEN");
var cardDef = document.getElementById("cardDef");
var cardDefEnText = document.getElementById("cardDefEnText");
var cardProgressEl = document.getElementById("cardProgress");
var queueTagEl = document.getElementById("queueTag");
var gradeBtnsEl = document.getElementById("gradeBtns");
var quizProgressEl = document.getElementById("quizProgress");
var quizBodyEl = document.getElementById("quizBody");

function currentCourse(){ return COURSES[state.courseIdx]; }
function cardById(course, id){ return course.cards.filter(function(c){ return c.id === id; })[0]; }
function topicName(course, topicId){
  var t = (course.topics || []).filter(function(x){ return x.id === topicId; })[0];
  return t ? t.name : topicId;
}
function shuffle(arr){
  for(var j = arr.length - 1; j > 0; j--){
    var k = Math.floor(Math.random() * (j + 1));
    var t = arr[j]; arr[j] = arr[k]; arr[k] = t;
  }
  return arr;
}

// ---------- review queue ----------

function buildQueue(course, now){
  now = now || Date.now();
  var due = [];
  course.cards.forEach(function(c){
    var s = storage.getCardState(progress, course.id, c.id);
    if(sm2.isDue(s, now)) due.push({ id: c.id, overdue: sm2.overdueDays(s, now), isNew: sm2.isNew(s) });
  });
  due.sort(function(a, b){
    if(a.isNew !== b.isNew) return a.isNew ? 1 : -1;
    if(!a.isNew) return b.overdue - a.overdue;
    return Math.random() - 0.5;
  });
  return due.map(function(d){ return d.id; });
}

function buildAllQueue(course){
  return shuffle(course.cards.map(function(c){ return c.id; }));
}

// ---------- rail ----------

function renderRail(){
  railEl.innerHTML = "";
  var totalMature = 0, totalCards = 0;
  COURSES.forEach(function(course, idx){
    var summary = storage.courseCardSummary(course, progress);
    totalMature += summary.mature; totalCards += summary.total;
    var pct = summary.total ? Math.round((summary.mature / summary.total) * 100) : 0;
    var btn = document.createElement("button");
    btn.className = "stratum" + (idx === state.courseIdx && !state.exam ? " active" : "");
    btn.style.setProperty("--bar", course.bar);
    btn.style.setProperty("--tint", course.tint);
    btn.style.setProperty("--pct", pct);
    btn.innerHTML =
      '<div class="code">' + course.code + '</div>' +
      '<div class="name">' + course.nameTR + '</div>' +
      '<div class="meta"><span>' + summary.mature + '/' + summary.total + ' kalıcı' + (summary.due ? ' · ' + summary.due + ' bekleyen' : '') + '</span><span class="ring"></span></div>';
    btn.addEventListener("click", function(){
      state.courseIdx = idx;
      state.mode = "cards";
      state.queue = [];
      state.queuePos = 0;
      render();
    });
    railEl.appendChild(btn);
  });
  var pctOverall = totalCards ? Math.round((totalMature / totalCards) * 100) : 0;
  overallEl.innerHTML = '<div class="num">%' + pctOverall + '</div><div class="lbl">kalıcı kart</div>';
}

// ---------- panel head / tabs ----------

function setCourseAccent(course){
  coursePanelEl.style.setProperty("--bar", course.bar);
  coursePanelEl.style.setProperty("--tint", course.tint);
}

function renderPanelHead(course){
  codeEl.textContent = course.code;
  nameTREl.textContent = course.nameTR;
  nameENEl.textContent = course.nameEN;
  setCourseAccent(course);
  document.querySelectorAll(".mode-btn").forEach(function(b){
    b.classList.toggle("active", b.dataset.mode === state.mode);
  });
  cardsViewEl.hidden = state.mode !== "cards";
  quizViewEl.hidden = state.mode !== "quiz";
  progressViewEl.hidden = state.mode !== "progress";
}

function renderCurrentView(){
  if(state.mode === "cards") renderCardsView();
  else if(state.mode === "quiz") renderQuizView();
  else renderProgressView();
}

// ---------- flashcards ----------

function renderCardsView(){
  var course = currentCourse();
  if(state.queue.length === 0){
    state.queue = buildQueue(course);
    state.queuePos = 0;
  }
  if(state.queue.length === 0){
    cardsEmptyEl.hidden = false;
    cardsActiveEl.hidden = true;
    return;
  }
  cardsEmptyEl.hidden = true;
  cardsActiveEl.hidden = false;
  if(state.queuePos >= state.queue.length) state.queuePos = 0;

  var c = cardById(course, state.queue[state.queuePos]);
  flashcardEl.classList.remove("flipped");
  gradeBtnsEl.hidden = true;
  cardTermTR.textContent = c.tr;
  cardTermEN.textContent = c.en;
  cardDef.textContent = c.def;
  cardDefEnText.textContent = c.defEn || "";
  cardProgressEl.textContent = (state.queuePos + 1) + " / " + state.queue.length;

  var s = storage.getCardState(progress, course.id, c.id);
  queueTagEl.textContent = sm2.isNew(s) ? "yeni" : sm2.isDue(s) ? "sırada" : "erken";
}

flashcardEl.addEventListener("click", function(){
  var flipped = flashcardEl.classList.toggle("flipped");
  gradeBtnsEl.hidden = !flipped;
});

document.getElementById("prevCard").addEventListener("click", function(){
  if(state.queue.length === 0) return;
  state.queuePos = (state.queuePos - 1 + state.queue.length) % state.queue.length;
  renderCardsView();
});
document.getElementById("nextCard").addEventListener("click", function(){
  if(state.queue.length === 0) return;
  state.queuePos = (state.queuePos + 1) % state.queue.length;
  renderCardsView();
});
document.getElementById("shuffleBtn").addEventListener("click", function(){
  shuffle(state.queue);
  state.queuePos = 0;
  renderCardsView();
});
document.getElementById("studyAheadBtn").addEventListener("click", function(){
  state.queue = buildAllQueue(currentCourse());
  state.queuePos = 0;
  renderCardsView();
});

gradeBtnsEl.addEventListener("click", function(e){
  var btn = e.target.closest(".grade-btn");
  if(!btn) return;
  var grade = btn.dataset.grade;
  var course = currentCourse();
  var cardId = state.queue[state.queuePos];
  var s = storage.getCardState(progress, course.id, cardId);
  storage.setCardState(progress, course.id, cardId, sm2.gradeCard(s, grade, Date.now()));
  storage.save(progress);

  state.queue.splice(state.queuePos, 1);
  if(grade === "again"){
    var reinsertAt = Math.min(state.queue.length, state.queuePos + 4);
    state.queue.splice(reinsertAt, 0, cardId);
  }
  if(state.queuePos >= state.queue.length) state.queuePos = 0;

  renderRail();
  renderCardsView();
});

// ---------- quiz ----------

function renderQuizView(){
  var course = currentCourse();

  if(state.quizIdx >= course.quiz.length){
    var pct = Math.round((state.quizScore / course.quiz.length) * 100);
    quizProgressEl.innerHTML = "";
    quizBodyEl.innerHTML =
      '<div class="quiz-done">' +
        '<div class="score">' + state.quizScore + '/' + course.quiz.length + '</div>' +
        '<div class="score-lbl">%' + pct + ' doğru</div>' +
        '<p>' + (pct >= 80 ? "Bu konuya hakimsin." : pct >= 50 ? "Yolun yarısındasın — yanlışları tekrar gözden geçirmekte fayda var." : "Bu ders için bilgi kartlarını tekrar et, sonra yeniden dene.") + '</p>' +
        '<button class="retry-btn" id="retryBtn">Quizi tekrar dene</button>' +
      '</div>';
    renderRail();
    document.getElementById("retryBtn").addEventListener("click", function(){
      state.quizIdx = 0; state.quizScore = 0; renderQuizView();
    });
    return;
  }

  var q = course.quiz[state.quizIdx];
  var answered = false;

  quizProgressEl.innerHTML = "";
  course.quiz.forEach(function(_, i){
    var d = document.createElement("div");
    d.className = "dot" + (i === state.quizIdx ? " current" : i < state.quizIdx ? " done-correct" : "");
    quizProgressEl.appendChild(d);
  });

  var optsHtml = q.opts.map(function(opt, i){
    return '<button class="opt" data-i="' + i + '"><span class="letter">' + LETTERS[i] + '</span><span>' + opt + '</span></button>';
  }).join("");

  quizBodyEl.innerHTML =
    '<div class="q-eyebrow">Soru ' + (state.quizIdx + 1) + ' / ' + course.quiz.length + ' · ' + topicName(course, q.topic) + '</div>' +
    '<div class="q-text">' + q.q + '</div>' +
    (q.qEn ? '<div class="q-text-en">' + q.qEn + '</div>' : '') +
    '<div class="options">' + optsHtml + '</div>' +
    '<div class="explain" id="explainBox"></div>' +
    '<button class="quiz-next" id="quizNextBtn">Sonraki soru</button>';

  var optButtons = quizBodyEl.querySelectorAll(".opt");
  optButtons.forEach(function(btn){
    btn.addEventListener("click", function(){
      if(answered) return;
      answered = true;
      var chosen = parseInt(btn.dataset.i, 10);
      var correct = chosen === q.a;
      optButtons.forEach(function(b){ b.disabled = true; });
      if(correct){
        btn.classList.add("correct");
        state.quizScore++;
      } else {
        btn.classList.add("wrong");
        optButtons[q.a].classList.add("correct");
      }
      storage.recordQuizAnswer(progress, course.id, q.id, correct);
      storage.save(progress);

      var ex = document.getElementById("explainBox");
      ex.innerHTML = "<b>" + (correct ? "Doğru. " : "Yanlış. ") + "</b>" + q.ex + (q.exEn ? '<div class="explain-en">' + q.exEn + '</div>' : '');
      ex.classList.add("show");
      var nb = document.getElementById("quizNextBtn");
      nb.classList.add("show");
      nb.textContent = state.quizIdx === course.quiz.length - 1 ? "Sonuçları gör" : "Sonraki soru";
      nb.addEventListener("click", function(){ state.quizIdx++; renderQuizView(); }, { once: true });
    });
  });
}

// ---------- progress tab ----------

function statChip(label, n){
  return '<div class="stat-chip"><div class="stat-num">' + n + '</div><div class="stat-lbl">' + label + '</div></div>';
}

function barRow(label, pct, sub){
  return '<div class="topic-row">' +
    '<div class="topic-name">' + label + '</div>' +
    '<div class="topic-bar"><div class="topic-bar-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="topic-pct">' + sub + '</div>' +
  '</div>';
}

function renderProgressView(){
  var course = currentCourse();
  var summary = storage.courseCardSummary(course, progress);
  var topics = storage.topicMastery(course, progress);

  var statsHtml = '<div class="stat-chips">' +
    statChip("Yeni", summary.neu) +
    statChip("Öğreniliyor", summary.learning) +
    statChip("Kalıcı", summary.mature) +
    statChip("Bekleyen", summary.due) +
  '</div>';

  var topicsHtml = topics.map(function(t){
    var pct = t.pct === null ? null : Math.round(t.pct * 100);
    return barRow(t.name, pct === null ? 0 : pct, pct === null ? "başlanmadı" : "%" + pct);
  }).join("");

  progressViewEl.innerHTML = statsHtml + '<h3 class="breakdown-title">Konuya göre</h3><div class="topic-list">' + topicsHtml + '</div>';
}

// ---------- tab switching ----------

document.getElementById("modeToggle").addEventListener("click", function(e){
  var btn = e.target.closest(".mode-btn");
  if(!btn) return;
  state.mode = btn.dataset.mode;
  renderPanelHead(currentCourse());
  if(state.mode === "quiz"){ state.quizIdx = 0; state.quizScore = 0; }
  renderCurrentView();
});

// ---------- exam mode ----------

function allQuizPool(){
  var pool = [];
  COURSES.forEach(function(course){
    course.quiz.forEach(function(q){
      pool.push({ courseId: course.id, courseName: course.nameTR, topicId: q.topic, topicName: topicName(course, q.topic), q: q });
    });
  });
  return pool;
}

function segBtn(val, label, active){
  return '<button class="seg-btn' + (active ? " active" : "") + '" data-val="' + val + '">' + label + '</button>';
}

function showExamPanel(active){
  railEl.hidden = active;
  coursePanelEl.hidden = active;
  examPanelEl.hidden = !active;
}

function renderExam(){
  if(!state.exam) return;
  if(state.exam.phase === "setup") renderExamSetup();
  else if(state.exam.phase === "running") renderExamRunning();
  else renderExamDone();
}

function renderExamSetup(){
  var totalQ = allQuizPool().length;
  examBodyEl.innerHTML =
    '<div class="exam-setup">' +
      '<span class="eyebrow">Sınav Simülasyonu</span>' +
      '<h2 class="exam-title">Karma, süreli sınav</h2>' +
      '<p class="exam-desc">Sorular tüm derslerin soru bankasından rastgele seçilir. Gönderene kadar doğru/yanlış geri bildirimi verilmez — gerçek sınav gibi.</p>' +
      '<div class="config-group"><span class="config-label">Soru Sayısı</span><div class="segmented" id="examCountSeg">' +
        segBtn("20", "20", state.exam.count === 20) +
        segBtn("40", "40", state.exam.count === 40) +
        segBtn("all", "Tümü (" + totalQ + ")", state.exam.count === "all") +
      '</div></div>' +
      '<div class="config-group"><span class="config-label">Süre</span><div class="segmented" id="examTimerSeg">' +
        segBtn("on-timer", "60sn / soru", state.exam.timerOn === true) +
        segBtn("off-timer", "Süresiz", state.exam.timerOn === false) +
      '</div></div>' +
      '<div class="exam-setup-actions">' +
        '<button class="ghost-btn" id="examCancelBtn">İptal</button>' +
        '<button class="primary-btn" id="examStartBtn">Sınavı Başlat</button>' +
      '</div>' +
    '</div>';

  document.getElementById("examCountSeg").addEventListener("click", function(e){
    var btn = e.target.closest(".seg-btn"); if(!btn) return;
    state.exam.count = btn.dataset.val === "all" ? "all" : parseInt(btn.dataset.val, 10);
    renderExamSetup();
  });
  document.getElementById("examTimerSeg").addEventListener("click", function(e){
    var btn = e.target.closest(".seg-btn"); if(!btn) return;
    state.exam.timerOn = btn.dataset.val === "on-timer";
    renderExamSetup();
  });
  document.getElementById("examCancelBtn").addEventListener("click", exitExam);
  document.getElementById("examStartBtn").addEventListener("click", startExam);
}

function startExam(){
  var pool = shuffle(allQuizPool().slice());
  var n = state.exam.count === "all" ? pool.length : Math.min(state.exam.count, pool.length);
  var questions = pool.slice(0, n);
  var timerOn = state.exam.timerOn;

  state.exam = {
    phase: "running",
    timerOn: timerOn,
    questions: questions,
    answers: new Array(questions.length).fill(null),
    idx: 0,
    deadline: timerOn ? Date.now() + questions.length * 60000 : null,
    timerId: null
  };

  if(timerOn){
    state.exam.timerId = setInterval(function(){
      if(!state.exam || state.exam.phase !== "running") return;
      if(state.exam.deadline - Date.now() <= 0){
        finishExam();
      } else {
        updateExamTimerDisplay();
      }
    }, 1000);
  }
  renderExam();
}

function updateExamTimerDisplay(){
  var el = document.getElementById("examTimer");
  if(!el || !state.exam || !state.exam.deadline) return;
  var remaining = Math.max(0, state.exam.deadline - Date.now());
  var mm = Math.floor(remaining / 60000);
  var ss = Math.floor((remaining % 60000) / 1000);
  el.textContent = mm + ":" + (ss < 10 ? "0" : "") + ss;
}

function renderExamRunning(){
  var ex = state.exam;
  var item = ex.questions[ex.idx];

  var optsHtml = item.q.opts.map(function(opt, i){
    var chosen = ex.answers[ex.idx] === i;
    return '<button class="opt' + (chosen ? " chosen" : "") + '" data-i="' + i + '"><span class="letter">' + LETTERS[i] + '</span><span>' + opt + '</span></button>';
  }).join("");

  var dots = ex.questions.map(function(_, i){
    var cls = i === ex.idx ? "current" : (ex.answers[i] !== null ? "done-correct" : "");
    return '<div class="dot ' + cls + '"></div>';
  }).join("");

  examBodyEl.innerHTML =
    '<div class="exam-topbar">' +
      '<span class="exam-qcount">Soru ' + (ex.idx + 1) + ' / ' + ex.questions.length + '</span>' +
      (ex.timerOn ? '<span class="exam-timer" id="examTimer"></span>' : '') +
    '</div>' +
    '<div class="quiz-progress">' + dots + '</div>' +
    '<div class="q-eyebrow">' + item.courseName + ' · ' + item.topicName + '</div>' +
    '<div class="q-text">' + item.q.q + '</div>' +
    (item.q.qEn ? '<div class="q-text-en">' + item.q.qEn + '</div>' : '') +
    '<div class="options">' + optsHtml + '</div>' +
    '<div class="exam-nav">' +
      '<button class="ghost-btn" id="examPrevBtn"' + (ex.idx === 0 ? " disabled" : "") + '>‹ Önceki</button>' +
      (ex.idx === ex.questions.length - 1 ?
        '<button class="primary-btn" id="examSubmitBtn">Sınavı Gönder</button>' :
        '<button class="ghost-btn" id="examNextBtn">Sonraki ›</button>') +
    '</div>';

  if(ex.timerOn) updateExamTimerDisplay();

  examBodyEl.querySelectorAll(".opt").forEach(function(btn){
    btn.addEventListener("click", function(){
      ex.answers[ex.idx] = parseInt(btn.dataset.i, 10);
      renderExamRunning();
    });
  });
  var prevBtn = document.getElementById("examPrevBtn");
  if(prevBtn) prevBtn.addEventListener("click", function(){ ex.idx = Math.max(0, ex.idx - 1); renderExamRunning(); });
  var nextBtn = document.getElementById("examNextBtn");
  if(nextBtn) nextBtn.addEventListener("click", function(){ ex.idx = Math.min(ex.questions.length - 1, ex.idx + 1); renderExamRunning(); });
  var submitBtn = document.getElementById("examSubmitBtn");
  if(submitBtn) submitBtn.addEventListener("click", function(){
    var unanswered = ex.answers.filter(function(a){ return a === null; }).length;
    if(unanswered > 0 && !confirm(unanswered + " soru boş bırakıldı. Yine de gönderilsin mi?")) return;
    finishExam();
  });
}

function finishExam(){
  var ex = state.exam;
  if(ex.timerId) clearInterval(ex.timerId);

  var correct = 0;
  var byCourse = {}, byTopic = {};
  ex.questions.forEach(function(item, i){
    var chosen = ex.answers[i];
    var isCorrect = chosen === item.q.a;
    if(isCorrect) correct++;
    storage.recordQuizAnswer(progress, item.courseId, item.q.id, isCorrect);

    if(!byCourse[item.courseId]) byCourse[item.courseId] = { correct: 0, total: 0 };
    byCourse[item.courseId].total++;
    if(isCorrect) byCourse[item.courseId].correct++;

    var tKey = item.courseId + ":" + item.topicId;
    if(!byTopic[tKey]) byTopic[tKey] = { correct: 0, total: 0 };
    byTopic[tKey].total++;
    if(isCorrect) byTopic[tKey].correct++;
  });

  var result = { date: Date.now(), total: ex.questions.length, correct: correct, byCourse: byCourse, byTopic: byTopic };
  storage.recordExam(progress, result);
  storage.save(progress);

  state.exam = { phase: "done", result: result, questions: ex.questions, answers: ex.answers };
  renderExam();
}

function renderExamDone(){
  var ex = state.exam;
  var r = ex.result;
  var pct = Math.round((r.correct / r.total) * 100);

  var courseRows = COURSES.map(function(course){
    var c = r.byCourse[course.id];
    if(!c) return "";
    return barRow(course.nameTR, Math.round((c.correct / c.total) * 100), c.correct + "/" + c.total);
  }).join("");

  var topicRows = [];
  COURSES.forEach(function(course){
    (course.topics || []).forEach(function(t){
      var stat = r.byTopic[course.id + ":" + t.id];
      if(!stat) return;
      topicRows.push(barRow(course.nameTR + " · " + t.name, Math.round((stat.correct / stat.total) * 100), stat.correct + "/" + stat.total));
    });
  });

  var missedRows = ex.questions.map(function(item, i){
    var chosen = ex.answers[i];
    if(chosen === item.q.a) return "";
    return '<div class="review-item">' +
      '<div class="q-eyebrow">' + item.courseName + '</div>' +
      '<div class="review-q">' + item.q.q + '</div>' +
      '<div class="review-answer wrong">Senin cevabın: ' + (chosen === null ? "— (boş bırakıldı)" : LETTERS[chosen] + ". " + item.q.opts[chosen]) + '</div>' +
      '<div class="review-answer correct">Doğru cevap: ' + LETTERS[item.q.a] + '. ' + item.q.opts[item.q.a] + '</div>' +
      '<div class="explain show">' + item.q.ex + (item.q.exEn ? '<div class="explain-en">' + item.q.exEn + '</div>' : '') + '</div>' +
    '</div>';
  }).join("");

  var historyRows = progress.exams.slice(0, 6).map(function(h){
    var hp = Math.round((h.correct / h.total) * 100);
    return '<div class="history-row"><span>' + new Date(h.date).toLocaleDateString("tr-TR") + '</span><span>' + h.correct + '/' + h.total + ' · %' + hp + '</span></div>';
  }).join("");

  examBodyEl.innerHTML =
    '<div class="quiz-done">' +
      '<div class="score">' + r.correct + '/' + r.total + '</div>' +
      '<div class="score-lbl">%' + pct + ' doğru</div>' +
    '</div>' +
    '<h3 class="breakdown-title">Derse göre</h3><div class="topic-list">' + courseRows + '</div>' +
    '<h3 class="breakdown-title">Konuya göre</h3><div class="topic-list">' + topicRows.join("") + '</div>' +
    (missedRows ? '<h3 class="breakdown-title">Yanlışları gözden geçir</h3><div class="exam-review">' + missedRows + '</div>' : '') +
    (historyRows ? '<h3 class="breakdown-title">Önceki denemeler</h3><div class="exam-history">' + historyRows + '</div>' : '') +
    '<div class="exam-setup-actions">' +
      '<button class="ghost-btn" id="examExitBtn">Derslere dön</button>' +
      '<button class="primary-btn" id="examRetakeBtn">Yeni sınav</button>' +
    '</div>';

  document.getElementById("examExitBtn").addEventListener("click", exitExam);
  document.getElementById("examRetakeBtn").addEventListener("click", function(){
    state.exam = { phase: "setup", count: 20, timerOn: true };
    renderExam();
  });
  renderRail();
}

function exitExam(){
  if(state.exam && state.exam.timerId) clearInterval(state.exam.timerId);
  state.exam = null;
  showExamPanel(false);
  render();
}

document.getElementById("examModeBtn").addEventListener("click", function(){
  state.exam = { phase: "setup", count: 20, timerOn: true };
  showExamPanel(true);
  renderExam();
});

// ---------- boot ----------

function render(){
  renderRail();
  var course = currentCourse();
  renderPanelHead(course);
  renderCurrentView();
}

render();
