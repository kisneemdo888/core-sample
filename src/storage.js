import { initCardState, isDue, isNew, isMature } from "./sm2.js";

var KEY = "coreSampleProgress_v2";

function blank(){
  return { cards:{}, quiz:{}, exams:[] };
}

function load(){
  try{
    var raw = JSON.parse(localStorage.getItem(KEY));
    if(!raw || typeof raw !== "object") return blank();
    return Object.assign(blank(), raw, {
      cards: raw.cards || {},
      quiz: raw.quiz || {},
      exams: raw.exams || []
    });
  }catch(e){
    return blank();
  }
}

function save(progress){
  try{ localStorage.setItem(KEY, JSON.stringify(progress)); }catch(e){}
}

// id is "<courseId>:<cardId>" so course modules never need to coordinate on
// globally-unique slugs.
function cardKey(courseId, cardId){ return courseId + ":" + cardId; }
function quizKey(courseId, quizId){ return courseId + ":" + quizId; }

// Pure read: returns a fresh default state for cards never graded, without
// writing it into `progress`. Only setCardState (called from actual grading)
// should cause a new entry to persist — otherwise rendering stats for every
// card on every rail render would silently bloat localStorage with defaults.
function getCardState(progress, courseId, cardId){
  var key = cardKey(courseId, cardId);
  return progress.cards[key] || initCardState();
}

function setCardState(progress, courseId, cardId, state){
  progress.cards[cardKey(courseId, cardId)] = state;
}

function getQuizStat(progress, courseId, quizId){
  return progress.quiz[quizKey(courseId, quizId)] || { seen:0, correct:0 };
}

function recordQuizAnswer(progress, courseId, quizId, correct){
  var key = quizKey(courseId, quizId);
  var stat = progress.quiz[key] || { seen:0, correct:0 };
  stat.seen++;
  if(correct) stat.correct++;
  progress.quiz[key] = stat;
}

function recordExam(progress, result){
  progress.exams.unshift(result);
  progress.exams = progress.exams.slice(0, 20);
}

function courseCardSummary(course, progress, now){
  now = now || Date.now();
  var total = course.cards.length, due = 0, neu = 0, learning = 0, mature = 0;
  course.cards.forEach(function(c){
    var s = getCardState(progress, course.id, c.id);
    if(isNew(s)) neu++;
    else if(isMature(s)) mature++;
    else learning++;
    if(isDue(s, now)) due++;
  });
  return { total:total, due:due, neu:neu, learning:learning, mature:mature };
}

// Blends card retention (SM-2 interval, scaled to the 21-day "mature" mark)
// with quiz accuracy for everything tagged with a topic. Either signal alone
// is used if the other has no data yet; with neither, mastery is null.
function topicMastery(course, progress){
  var byTopic = {};
  (course.topics || []).forEach(function(t){ byTopic[t.id] = { id:t.id, name:t.name, cardScore:null, cardN:0, quizScore:null, quizN:0 }; });

  course.cards.forEach(function(c){
    var t = byTopic[c.topic];
    if(!t) return;
    var s = getCardState(progress, course.id, c.id);
    var score = s.lastReviewed ? Math.min(1, s.interval / 21) : 0;
    t.cardScore = (t.cardScore === null ? 0 : t.cardScore) + score;
    t.cardN++;
  });

  course.quiz.forEach(function(q){
    var t = byTopic[q.topic];
    if(!t) return;
    var stat = getQuizStat(progress, course.id, q.id);
    if(stat.seen > 0){
      t.quizScore = (t.quizScore === null ? 0 : t.quizScore) + stat.correct / stat.seen;
      t.quizN++;
    }
  });

  return Object.keys(byTopic).map(function(id){
    var t = byTopic[id];
    var cardAvg = t.cardN ? t.cardScore / t.cardN : null;
    var quizAvg = t.quizN ? t.quizScore / t.quizN : null;
    var pct = null;
    if(cardAvg !== null && quizAvg !== null) pct = (cardAvg + quizAvg) / 2;
    else if(cardAvg !== null) pct = cardAvg;
    else if(quizAvg !== null) pct = quizAvg;
    return { id:t.id, name:t.name, pct:pct };
  });
}

export {
  load, save, blank,
  getCardState, setCardState,
  getQuizStat, recordQuizAnswer,
  recordExam,
  courseCardSummary, topicMastery
};
