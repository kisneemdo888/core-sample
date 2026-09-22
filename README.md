# Core Sample

Flashcards, spaced repetition, and exam simulation for Master's coursework in Agricultural Biotechnology (Turgut Özal University).

Covers:
- Bilimsel Araştırma Teknikleri İle Araştırma ve Yayın Etiği (Research Techniques & Publication Ethics)
- Toprakta Verimlilik Analizleri (Soil Fertility Analysis)
- Toprak Organik Maddesinin Yönetimi (Soil Organic Matter Management)
- Toprak Biyoteknolojisi (Soil Biotechnology)

## Features
- Flashcards reviewed on an SM-2 spaced-repetition schedule, graded Again / Hard / Good / Easy
- Self-graded quizzes per course, with explanations
- Exam Mode: a timed, mixed-course quiz sampled from every course's question bank
- Per-topic mastery tracking (blends flashcard retention with quiz accuracy), on top of per-course stats

## Structure
Static site, no build step. `index.html` is the shell; app logic and content live under `src/`:
- `src/app.js` — rendering and interaction
- `src/sm2.js` — the spaced-repetition scheduler
- `src/storage.js` — `localStorage` persistence and stat aggregation
- `src/courses/*.js` — one ES module per course (flashcards + quiz questions + topic tags)

Progress is stored in the browser's `localStorage`, per device — nothing is sent to a server.

Because course data is loaded as ES modules, opening `index.html` directly (`file://`) won't work — run any local static server from the project root (e.g. `python -m http.server`) and open that instead. Deployment to GitHub Pages is unaffected: it serves the files over `https://` as-is.

Live at: https://louckmanemaster.apexcv.online
