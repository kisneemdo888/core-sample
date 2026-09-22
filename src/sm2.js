// SM-2 spaced-repetition scheduler, graded with 4 Anki-style buttons instead of
// the original 0-5 scale. Each button maps to a quality score; "hard" and "easy"
// additionally nudge the interval growth so the four buttons stay meaningfully
// different (a standard extension — see Anki's "hard interval" / "easy bonus").
export var GRADES = { AGAIN: "again", HARD: "hard", GOOD: "good", EASY: "easy" };

var QUALITY = { again: 1, hard: 3, good: 4, easy: 5 };
var MIN_EASE = 1.3;
var EASY_BONUS = 1.3;
var HARD_INTERVAL_FACTOR = 1.2;
var DAY_MS = 86400000;

export function initCardState(){
  return { repetition:0, ease:2.5, interval:0, due:0, lapses:0, lastGrade:null, lastReviewed:null };
}

export function gradeCard(state, grade, now){
  now = now || Date.now();
  var s = Object.assign({}, state);
  var q = QUALITY[grade];

  if(q < 3){
    s.lapses++;
    s.repetition = 0;
    s.interval = grade === "again" ? 0 : 1;
  } else if(s.repetition === 0){
    s.interval = 1;
    s.repetition = 1;
  } else if(s.repetition === 1){
    s.interval = 6;
    s.repetition = 2;
  } else {
    var base = s.interval * s.ease;
    if(grade === "hard") base = s.interval * HARD_INTERVAL_FACTOR;
    if(grade === "easy") base = s.interval * s.ease * EASY_BONUS;
    s.interval = Math.max(1, Math.round(base));
    s.repetition++;
  }

  s.ease = Math.max(MIN_EASE, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  s.lastGrade = grade;
  s.lastReviewed = now;
  s.due = now + s.interval * DAY_MS;
  return s;
}

export function isDue(state, now){
  now = now || Date.now();
  return !state.due || state.due <= now;
}

export function isNew(state){
  return state.repetition === 0 && !state.lastReviewed;
}

// "Mature" mirrors Anki's convention: an interval of 21+ days means the card
// is well-retained, not just recently learned.
export function isMature(state){
  return state.interval >= 21;
}

export function overdueDays(state, now){
  now = now || Date.now();
  if(!state.due) return 0;
  return Math.max(0, (now - state.due) / DAY_MS);
}
