// EECE 503Q — Final Exam Prep (interactive)
// QUESTIONS is loaded globally from questions-data.js

const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ---------- constants ---------- */

// Sections are derived dynamically from QUESTIONS so the same engine
// works for any course's question bank.
const SECTIONS = [...new Set(QUESTIONS.map(q => q.s))];

// A palette of (accent, tint) pairs — assigned to sections by index.
const PALETTE = [
  { accent: "#4F46E5", tint: "#EEF0FF" },
  { accent: "#0E7490", tint: "#E0F2F7" },
  { accent: "#7C3AED", tint: "#F1ECFD" },
  { accent: "#15803D", tint: "#E5F4EA" },
  { accent: "#B91C1C", tint: "#FBE9E9" },
  { accent: "#B45309", tint: "#FAEEDC" },
  { accent: "#0F766E", tint: "#DFFBF7" },
  { accent: "#6D28D9", tint: "#EDE9FE" },
  { accent: "#1D4ED8", tint: "#DBEAFE" },
];

// Fall back to cycling the palette for any section name.
const SECTION_META_MAP = Object.fromEntries(
  SECTIONS.map((s, i) => [
    s,
    { short: s.replace(/&.*/,"").trim().split(" ")[0], ...PALETTE[i % PALETTE.length] },
  ])
);

function getSectionMeta(section) {
  return SECTION_META_MAP[section] || { short: section, accent: "#555", tint: "#f0f0f0" };
}

// Course config — override by defining window.COURSE_CONFIG before loading this script.
const COURSE_CONFIG = (typeof window !== "undefined" && window.COURSE_CONFIG) || {
  name: "EECE 503Q",
  displayTitle: "DevOps, Cloud<br/>&amp; Web Security",
  subtitle: "170 questions — 110 official + 60 harder, drawn from the course final.",
  storageKey: "eece503q-exam-state-v1",
  themeKey: "eece503q-theme",
  footnote: "Questions sourced from the official Final_Exam_MCQ.pdf + lecture material.",
};

const SUBJECTIVE_BANK = (typeof window !== "undefined" && window.SUBJECTIVE_QUESTIONS)
  || ((typeof SUBJECTIVE_QUESTIONS !== "undefined") ? SUBJECTIVE_QUESTIONS : []);
const ADDED_EXAM_SETS = (typeof window !== "undefined" && window.EXAM_SETS)
  || ((typeof EXAM_SETS !== "undefined") ? EXAM_SETS : []);
const EXTREME_BANK = (typeof window !== "undefined" && window.EXTREME_QUESTIONS)
  || ((typeof EXTREME_QUESTIONS !== "undefined") ? EXTREME_QUESTIONS : []);

/* ---------- helpers ---------- */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Sample N questions proportionally from each section.
function sampleProportional(pool, targetCount) {
  if (pool.length === 0) return [];
  if (targetCount >= pool.length) return shuffle(pool);
  const bySection = {};
  for (const q of pool) (bySection[q.s] ??= []).push(q);
  const total = pool.length;
  const out = [];
  let allocated = 0;
  const sectionNames = Object.keys(bySection);
  sectionNames.forEach((s, i) => {
    const isLast = i === sectionNames.length - 1;
    const want = isLast
      ? targetCount - allocated
      : Math.round((bySection[s].length / total) * targetCount);
    const take = Math.min(want, bySection[s].length);
    const picked = shuffle(bySection[s]).slice(0, take);
    out.push(...picked);
    allocated += take;
  });
  return shuffle(out);
}

// Shuffle answer choices for one question; returns options + new correct index.
function shuffleOptions(q) {
  const labelled = q.o.map((text, i) => ({ text, isCorrect: i === q.a }));
  const shuffled = shuffle(labelled);
  return {
    id: q.id,
    section: q.s,
    question: q.q,
    difficulty: q.d,
    source: q.src,
    options: shuffled.map(o => o.text),
    correctIdx: shuffled.findIndex(o => o.isCorrect),
  };
}

function prepareQuestion(q, { shuffleChoices = true } = {}) {
  if (shuffleChoices) return shuffleOptions(q);
  return {
    id: q.id,
    section: q.s,
    question: q.q,
    difficulty: q.d,
    source: q.src,
    options: [...q.o],
    correctIdx: q.a,
  };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ---------- top-level App ---------- */

// Theme management — sets data-theme on <html> and persists to localStorage
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(COURSE_CONFIG.themeKey) || "dark"; }
    catch { return "dark"; }
  });
  useEffect(() => {
    // dark is the CSS baseline — only set attribute when light is needed
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try { localStorage.setItem(COURSE_CONFIG.themeKey, theme); } catch {}
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => t === "dark" ? "light" : "dark"), []);
  return [theme, toggle];
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      {isDark
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      }
    </button>
  );
}

function App() {
  const [theme, toggleTheme] = useTheme();
  // Persist mode key so refresh resumes properly
  const [view, setView] = useState("home");        // home | quiz | results | review | subjective
  const [examConfig, setExamConfig] = useState(null); // { mode, label, questions, startedAt, immediateFeedback }
  const [answers, setAnswers] = useState({});      // { [qIdx]: selectedOptionIdx }
  const [flagged, setFlagged] = useState({});      // { [qIdx]: true }
  const [currentIdx, setCurrentIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [reviewFilter, setReviewFilter] = useState("all");

  /* ---- restore from localStorage ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COURSE_CONFIG.storageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.examConfig && s.view) {
        setView(s.view);
        setExamConfig(s.examConfig);
        setAnswers(s.answers || {});
        setFlagged(s.flagged || {});
        setCurrentIdx(s.currentIdx || 0);
        setElapsed(s.elapsed || 0);
        setSubmittedAt(s.submittedAt || null);
      }
    } catch (e) { /* ignore */ }
  }, []);

  /* ---- persist on every change ---- */
  useEffect(() => {
    if (view === "home") {
      localStorage.removeItem(COURSE_CONFIG.storageKey);
      return;
    }
    localStorage.setItem(COURSE_CONFIG.storageKey, JSON.stringify({
      view, examConfig, answers, flagged, currentIdx, elapsed, submittedAt,
    }));
  }, [view, examConfig, answers, flagged, currentIdx, elapsed, submittedAt]);

  /* ---- timer ---- */
  useEffect(() => {
    if (view !== "quiz") return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [view]);

  const startExam = useCallback(({ count, sectionFilter, difficulty, sourceFilter, customQuestions, label, immediateFeedback, preserveOrder }) => {
    let pool = customQuestions || QUESTIONS;
    if (sectionFilter) pool = pool.filter(q => q.s === sectionFilter);
    if (sourceFilter) pool = pool.filter(q => q.src === sourceFilter);
    if (difficulty === "hard")     pool = pool.filter(q => q.d === "h");
    if (difficulty === "standard") pool = pool.filter(q => q.d === "s");
    const sample = preserveOrder
      ? [...pool].sort((a, b) => a.id - b.id)
      : count >= pool.length
      ? shuffle(pool)
      : sampleProportional(pool, count);
    const prepared = sample.map(q => prepareQuestion(q, { shuffleChoices: !preserveOrder }));
    setExamConfig({
      mode: sourceFilter ? "source" : sectionFilter ? "section" : "mixed",
      label,
      questions: prepared,
      sectionFilter,
      sourceFilter,
      customSet: customQuestions ? label : null,
      difficulty: difficulty || "mixed",
      immediateFeedback: !!immediateFeedback,
      preserveOrder: !!preserveOrder,
      startedAt: Date.now(),
    });
    setAnswers({});
    setFlagged({});
    setCurrentIdx(0);
    setElapsed(0);
    setSubmittedAt(null);
    setView("quiz");
  }, []);

  const submitExam = useCallback(() => {
    setSubmittedAt(Date.now());
    setView("results");
  }, []);

  const goHome = useCallback(() => {
    setView("home");
    setExamConfig(null);
    setAnswers({});
    setFlagged({});
    setCurrentIdx(0);
    setElapsed(0);
    setSubmittedAt(null);
  }, []);

  /* ---- render ---- */
  const themeProps = { theme, onToggle: toggleTheme };
  if (view === "home") {
    const resumeAvailable = (() => {
      try {
        const raw = localStorage.getItem(COURSE_CONFIG.storageKey);
        if (!raw) return null;
        const s = JSON.parse(raw);
        return s.view === "quiz" ? s : null;
      } catch { return null; }
    })();
    return <Home themeProps={themeProps} onStart={startExam} onSubjective={() => setView("subjective")} resumeState={resumeAvailable} onResume={() => {
      const s = JSON.parse(localStorage.getItem(COURSE_CONFIG.storageKey));
      setView(s.view);
      setExamConfig(s.examConfig);
      setAnswers(s.answers || {});
      setFlagged(s.flagged || {});
      setCurrentIdx(s.currentIdx || 0);
      setElapsed(s.elapsed || 0);
      setSubmittedAt(s.submittedAt || null);
    }} />;
  }

  if (view === "quiz") {
    return <Quiz
      themeProps={themeProps}
      examConfig={examConfig}
      answers={answers}
      setAnswers={setAnswers}
      flagged={flagged}
      setFlagged={setFlagged}
      currentIdx={currentIdx}
      setCurrentIdx={setCurrentIdx}
      elapsed={elapsed}
      onSubmit={submitExam}
      onExit={goHome}
    />;
  }

  if (view === "results") {
    return <Results
      themeProps={themeProps}
      examConfig={examConfig}
      answers={answers}
      flagged={flagged}
      elapsed={elapsed}
      onReview={(filter) => { setReviewFilter(filter); setCurrentIdx(0); setView("review"); }}
      onRetake={() => startExam({
        count: examConfig.questions.length,
        sectionFilter: examConfig.sectionFilter,
        sourceFilter: examConfig.sourceFilter,
        customQuestions: examConfig.customSet === "Extremely Difficult MCQs" ? EXTREME_BANK : null,
        difficulty: examConfig.difficulty,
        label: examConfig.label,
        immediateFeedback: examConfig.immediateFeedback,
        preserveOrder: examConfig.preserveOrder,
      })}
      onHome={goHome}
    />;
  }

  if (view === "review") {
    return <Review
      themeProps={themeProps}
      examConfig={examConfig}
      answers={answers}
      flagged={flagged}
      filter={reviewFilter}
      onFilterChange={setReviewFilter}
      onBack={() => setView("results")}
    />;
  }

  if (view === "subjective") {
    return <SubjectiveAnswers themeProps={themeProps} onBack={goHome} />;
  }

  return null;
}

/* ---------- Home ---------- */

function Home({ themeProps, onStart, onSubjective, resumeState, onResume }) {
  const [showSections, setShowSections] = useState(false);
  const [immediateFeedback, setImmediateFeedback] = useState(false);

  const hardCount = useMemo(() => QUESTIONS.filter(q => q.d === "h").length, []);

  const presetModes = [
    { key: "quick",    count: 25,               difficulty: "standard", label: "Quick Quiz",    desc: "25 questions · ~15 min",  hint: "A fast sampler across all topics." },
    { key: "standard", count: 50,               difficulty: "standard", label: "Standard Exam", desc: "50 questions · ~30 min",  hint: "Proportional sample from the full bank.", primary: true },
    ...(hardCount > 0 ? [{ key: "hard", count: 50, difficulty: "hard", label: "Hard Mode", desc: `${Math.min(50, hardCount)} harder questions · ~40 min`, hint: "Deep-dive: scenarios, numbers, gotchas.", hard: true }] : []),
    { key: "full",     count: QUESTIONS.length,  difficulty: null,       label: "Full Bank",     desc: `All ${QUESTIONS.length} questions`,           hint: "Every question in the bank, randomised." },
  ];

  const sectionCounts = useMemo(() => {
    const c = {};
    for (const q of QUESTIONS) c[q.s] = (c[q.s] || 0) + 1;
    return c;
  }, []);

  const hardCounts = useMemo(() => {
    const c = {};
    for (const q of QUESTIONS) if (q.d === "h") c[q.s] = (c[q.s] || 0) + 1;
    return c;
  }, []);

  return (
    <div className="home">
      <div className="top-right-controls"><ThemeToggle {...themeProps} /></div>
      <header className="home-hero">
        <div className="kicker">{COURSE_CONFIG.name} · Final Exam Prep</div>
        <h1 className="display" dangerouslySetInnerHTML={{__html: COURSE_CONFIG.displayTitle}} />
        <p className="subtitle">
          {COURSE_CONFIG.subtitle}
        </p>

        <div className="topic-strip">
          {SECTIONS.map(s => (
            <span key={s} className="topic-chip" style={{ background: getSectionMeta(s).tint, color: getSectionMeta(s).accent }}>
              <span className="dot" style={{ background: getSectionMeta(s).accent }} />
              {getSectionMeta(s).short}
              <span className="topic-count">{sectionCounts[s]}</span>
            </span>
          ))}
        </div>
      </header>

      {resumeState && (
        <div className="resume-card">
          <div>
            <div className="resume-label">Continue where you left off</div>
            <div className="resume-meta">
              {resumeState.examConfig?.label} · Q{(resumeState.currentIdx ?? 0) + 1} of {resumeState.examConfig?.questions?.length}
              {" · "}{Object.keys(resumeState.answers || {}).length} answered
            </div>
          </div>
          <button className="btn btn-primary" onClick={onResume}>Resume →</button>
        </div>
      )}

      <section className="modes">
        {presetModes.map(m => (
          <button key={m.key} className={`mode-card ${m.primary ? "mode-card-primary" : ""} ${m.hard ? "mode-card-hard" : ""}`}
            onClick={() => onStart({ count: m.count, difficulty: m.difficulty, label: m.label, immediateFeedback })}>
            {m.hard && <span className="hard-badge">Hard</span>}
            <div className="mode-count">{m.count}</div>
            <div className="mode-label">{m.label}</div>
            <div className="mode-desc">{m.desc}</div>
            <div className="mode-hint">{m.hint}</div>
          </button>
        ))}
      </section>

      {ADDED_EXAM_SETS.length > 0 && (
        <section className="exam-additions">
          <div className="section-title-row">
            <div>
              <div className="section-eyebrow">Added exams</div>
              <h2>Full PDF exams</h2>
            </div>
            <button className="btn btn-ghost" onClick={onSubjective}>
              Subjective answers
            </button>
          </div>
          <div className="exam-mode-grid">
            {ADDED_EXAM_SETS.map(exam => (
              <button key={exam.key} className="exam-mode-card"
                onClick={() => onStart({
                  count: exam.mcqCount,
                  sourceFilter: exam.key,
                  label: exam.label,
                  immediateFeedback,
                  preserveOrder: true,
                })}>
                <div className="mode-count">{exam.mcqCount}</div>
                <div className="mode-label">{exam.label}</div>
                <div className="mode-desc">{exam.mcqCount} MCQs in original order</div>
                <div className="mode-hint">{exam.subjectiveCount} subjective questions with model answers</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {EXTREME_BANK.length > 0 && (
        <section className="exam-additions extreme-additions">
          <div className="section-title-row">
            <div>
              <div className="section-eyebrow">Standalone challenge</div>
              <h2>Extremely Difficult MCQs</h2>
            </div>
          </div>
          <button className="exam-mode-card extreme-mode-card"
            onClick={() => onStart({
              count: EXTREME_BANK.length,
              customQuestions: EXTREME_BANK,
              label: "Extremely Difficult MCQs",
              immediateFeedback,
              preserveOrder: true,
            })}>
            <div className="mode-count">{EXTREME_BANK.length}</div>
            <div className="mode-label">Extreme Lab Challenge</div>
            <div className="mode-desc">50 advanced MCQs in their own set</div>
            <div className="mode-hint">Terraform, EKS, CI/CD, Docker, Swarm, AWS routing, and security edge cases.</div>
          </button>
        </section>
      )}

      <div className="row-center">
        <label className="toggle">
          <input type="checkbox" checked={immediateFeedback} onChange={e => setImmediateFeedback(e.target.checked)} />
          <span className="toggle-track"><span className="toggle-thumb" /></span>
          <span className="toggle-label">
            <strong>Practice mode</strong>
            <span className="toggle-sub">Reveal the correct answer right after you select one</span>
          </span>
        </label>
      </div>

      <div className="section-drill">
        <button className="section-drill-header" onClick={() => setShowSections(s => !s)}>
          <span>Or drill a single topic</span>
          <span className="chev" style={{ transform: showSections ? "rotate(180deg)" : "none" }}>⌄</span>
        </button>
        {showSections && (
          <div className="section-drill-grid">
            {SECTIONS.map(s => (
              <div key={s} className="section-drill-card-wrap" style={{ borderColor: getSectionMeta(s).accent }}>
                <div className="section-drill-card-head">
                  <span className="section-drill-name" style={{ color: getSectionMeta(s).accent }}>{s}</span>
                </div>
                <div className="section-drill-card-actions">
                  <button className="section-drill-btn"
                    onClick={() => onStart({ count: sectionCounts[s], sectionFilter: s, label: getSectionMeta(s).short + " drill", immediateFeedback })}>
                    All <span className="section-drill-btn-count">{sectionCounts[s]}</span>
                  </button>
                  {hardCounts[s] > 0 && (
                    <button className="section-drill-btn section-drill-btn-hard"
                      onClick={() => onStart({ count: hardCounts[s], sectionFilter: s, difficulty: "hard", label: getSectionMeta(s).short + " — hard", immediateFeedback })}>
                      Hard only <span className="section-drill-btn-count">{hardCounts[s]}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="footnote">
        {COURSE_CONFIG.footnote}<br/>
        Your progress is saved locally in this browser.
      </footer>
    </div>
  );
}

/* ---------- Subjective Answers ---------- */

function SubjectiveAnswers({ themeProps, onBack }) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState({});

  const sourceLabels = Object.fromEntries(ADDED_EXAM_SETS.map(exam => [exam.key, exam.label]));
  const filtered = SUBJECTIVE_BANK.filter(item => filter === "all" || item.src === filter);

  const toggleOpen = (id) => setOpen(state => ({ ...state, [id]: !state[id] }));
  const revealAll = () => setOpen(Object.fromEntries(filtered.map(item => [item.id, true])));

  return (
    <div className="review subjective-page">
      <header className="review-header">
        <button className="icon-btn" onClick={onBack}>←</button>
        <h2>Subjective Answers</h2>
        <ThemeToggle {...themeProps} />
      </header>

      <div className="review-filters subjective-filters">
        <FilterBtn cur={filter} value="all" label="All" count={SUBJECTIVE_BANK.length} onClick={setFilter} />
        {ADDED_EXAM_SETS.map(exam => (
          <FilterBtn key={exam.key} cur={filter} value={exam.key} label={exam.label.replace(" Final", "")} count={SUBJECTIVE_BANK.filter(item => item.src === exam.key).length} onClick={setFilter} />
        ))}
        <button className="filter-btn filter-btn-action" onClick={revealAll}>Reveal all</button>
      </div>

      <ol className="review-list">
        {filtered.map((item, i) => {
          const meta = getSectionMeta(item.s);
          const isOpen = !!open[item.id];
          return (
            <li key={item.id} className="review-item subjective-item">
              <div className="review-item-header">
                <span className="review-num">Q{i + 1}</span>
                <span className="section-pill" style={{ background: meta.tint, color: meta.accent }}>
                  <span className="dot" style={{ background: meta.accent }} /> {item.s}
                </span>
                <span className="review-tag tag-skip">{sourceLabels[item.src] || item.title}</span>
                <span className="review-tag tag-flag">{item.marks} marks</span>
              </div>
              <h3 className="review-q">{item.q}</h3>
              {isOpen ? (
                <div className="subjective-answer">
                  <div className="subjective-answer-label">Model answer</div>
                  <p>{item.answer}</p>
                </div>
              ) : (
                <button className="btn btn-ghost subjective-reveal" onClick={() => toggleOpen(item.id)}>Reveal answer</button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="review-footer">
        <button className="btn btn-ghost" onClick={onBack}>← Back home</button>
      </div>
    </div>
  );
}

/* ---------- Quiz ---------- */

function Quiz({ themeProps, examConfig, answers, setAnswers, flagged, setFlagged, currentIdx, setCurrentIdx, elapsed, onSubmit, onExit }) {
  const [showGrid, setShowGrid] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const total = examConfig.questions.length;
  const current = examConfig.questions[currentIdx];
  const meta = getSectionMeta(current.section);
  const selected = answers[currentIdx];
  const isFlagged = !!flagged[currentIdx];

  const answeredCount = Object.keys(answers).length;
  const flaggedCount = Object.keys(flagged).filter(k => flagged[k]).length;

  const select = (optIdx) => {
    if (examConfig.immediateFeedback && answers[currentIdx] !== undefined) return; // locked after first selection in practice mode
    setAnswers({ ...answers, [currentIdx]: optIdx });
  };

  const toggleFlag = () => {
    const next = { ...flagged };
    if (next[currentIdx]) delete next[currentIdx]; else next[currentIdx] = true;
    setFlagged(next);
  };

  const go = (delta) => {
    const next = currentIdx + delta;
    if (next < 0 || next >= total) return;
    setCurrentIdx(next);
  };

  // Keyboard shortcuts: 1-4 / A-D, arrows, F (flag), Enter (next)
  useEffect(() => {
    const handler = (e) => {
      if (confirmSubmit || confirmExit) return;
      if (e.target.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (["1","2","3","4"].includes(k)) { select(parseInt(k) - 1); e.preventDefault(); }
      else if (["a","b","c","d"].includes(k)) { select("abcd".indexOf(k)); e.preventDefault(); }
      else if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
      else if (k === "f") { toggleFlag(); e.preventDefault(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIdx, answers, flagged, confirmSubmit, confirmExit, examConfig]);

  const showFeedback = examConfig.immediateFeedback && selected !== undefined;

  return (
    <div className="quiz">
      <header className="quiz-header">
        <button className="icon-btn" onClick={() => setConfirmExit(true)} aria-label="Exit">✕</button>
        <div className="quiz-header-center">
          <div className="quiz-label">{examConfig.label}</div>
          <div className="quiz-progress-text">
            Question <strong>{currentIdx + 1}</strong> of {total}
            <span className="sep">·</span>
            <span style={{ color: meta.accent }}>{current.section}</span>
          </div>
        </div>
        <div className="quiz-header-right">
          <div className="quiz-timer" title="Elapsed time">⏱ {formatTime(elapsed)}</div>
          <ThemeToggle {...themeProps} />
        </div>
      </header>

      <div className="quiz-progressbar">
        <div className="quiz-progressbar-fill" style={{
          width: `${((currentIdx + 1) / total) * 100}%`,
          background: meta.accent
        }} />
      </div>

      <main className="quiz-main">
        <div className="question-meta-row">
          <span className="section-pill" style={{ background: meta.tint, color: meta.accent }}>
            <span className="dot" style={{ background: meta.accent }} /> {current.section}
          </span>
          {current.difficulty === "h" && <span className="diff-pill">Hard</span>}
          <span style={{ flex: 1 }} />
          <button className={`flag-btn ${isFlagged ? "flag-on" : ""}`} onClick={toggleFlag} title="Flag for review (F)">
            <span className="flag-icon">⚑</span> {isFlagged ? "Flagged" : "Flag"}
          </button>
        </div>

        <h2 className="question-text">{current.question}</h2>

        <ol className="options">
          {current.options.map((opt, i) => {
            const letter = "ABCD"[i];
            const isSelected = selected === i;
            const isCorrect = i === current.correctIdx;
            let stateClass = "";
            if (showFeedback) {
              if (isCorrect) stateClass = "opt-correct";
              else if (isSelected) stateClass = "opt-wrong";
            } else if (isSelected) stateClass = "opt-selected";
            return (
              <li key={i}>
                <button
                  className={`option ${stateClass}`}
                  style={isSelected && !showFeedback ? { borderColor: meta.accent, background: meta.tint } : null}
                  onClick={() => select(i)}
                  disabled={showFeedback && !isSelected && !isCorrect}
                >
                  <span className="opt-letter" style={isSelected && !showFeedback ? { background: meta.accent, color: "white" } : null}>{letter}</span>
                  <span className="opt-text">{opt}</span>
                  {showFeedback && isCorrect && <span className="opt-mark">✓</span>}
                  {showFeedback && isSelected && !isCorrect && <span className="opt-mark">✗</span>}
                </button>
              </li>
            );
          })}
        </ol>

        {showFeedback && (
          <div className={`feedback ${selected === current.correctIdx ? "feedback-good" : "feedback-bad"}`}>
            {selected === current.correctIdx
              ? <><strong>Correct.</strong> Nice — the right answer is {"ABCD"[current.correctIdx]}.</>
              : <><strong>Not quite.</strong> The correct answer is {"ABCD"[current.correctIdx]}: <em>{current.options[current.correctIdx]}</em></>}
          </div>
        )}
      </main>

      <footer className="quiz-footer">
        <button className="btn btn-ghost" onClick={() => go(-1)} disabled={currentIdx === 0}>← Prev</button>
        <button className="btn btn-ghost" onClick={() => setShowGrid(true)}>
          ▦ Grid · {answeredCount}/{total}
          {flaggedCount > 0 && <span className="flag-count">⚑{flaggedCount}</span>}
        </button>
        {currentIdx === total - 1
          ? <button className="btn btn-primary" onClick={() => setConfirmSubmit(true)}>Submit Exam →</button>
          : <button className="btn btn-primary" onClick={() => go(1)}>Next →</button>
        }
      </footer>

      {showGrid && (
        <QuestionGrid
          questions={examConfig.questions}
          answers={answers}
          flagged={flagged}
          currentIdx={currentIdx}
          onJump={(i) => { setCurrentIdx(i); setShowGrid(false); }}
          onClose={() => setShowGrid(false)}
          onSubmit={() => { setShowGrid(false); setConfirmSubmit(true); }}
        />
      )}

      {confirmSubmit && (
        <ConfirmModal
          title="Submit exam?"
          body={
            answeredCount < total
              ? `You've answered ${answeredCount} of ${total} questions. ${total - answeredCount} will be marked unanswered.`
              : `You've answered all ${total} questions. Ready to see your score?`
          }
          confirmLabel="Submit & see results"
          onConfirm={() => { setConfirmSubmit(false); onSubmit(); }}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}

      {confirmExit && (
        <ConfirmModal
          title="Exit exam?"
          body="Your progress will be lost and you'll return to the home screen."
          confirmLabel="Exit"
          danger
          onConfirm={() => { setConfirmExit(false); onExit(); }}
          onCancel={() => setConfirmExit(false)}
        />
      )}
    </div>
  );
}

/* ---------- Question Grid (jumper) ---------- */

function QuestionGrid({ questions, answers, flagged, currentIdx, onJump, onClose, onSubmit }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Question navigator</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="legend">
            <span><span className="legend-swatch legend-current" /> Current</span>
            <span><span className="legend-swatch legend-answered" /> Answered</span>
            <span><span className="legend-swatch legend-flagged" /> Flagged</span>
            <span><span className="legend-swatch legend-empty" /> Unanswered</span>
          </div>
          <div className="grid">
            {questions.map((q, i) => {
              const isCur = i === currentIdx;
              const isAns = answers[i] !== undefined;
              const isFlag = !!flagged[i];
              return (
                <button key={i} className={`grid-cell ${isCur ? "cur" : ""} ${isAns ? "ans" : ""} ${isFlag ? "flag" : ""}`}
                  onClick={() => onJump(i)}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Back to exam</button>
          <button className="btn btn-primary" onClick={onSubmit}>Submit Exam →</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- ConfirmModal ---------- */

function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>{title}</h3></div>
        <div className="modal-body"><p>{body}</p></div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Results ---------- */

function Results({ themeProps, examConfig, answers, flagged, elapsed, onReview, onRetake, onHome }) {
  const total = examConfig.questions.length;
  const correct = examConfig.questions.filter((q, i) => answers[i] === q.correctIdx).length;
  const wrong = examConfig.questions.filter((q, i) => answers[i] !== undefined && answers[i] !== q.correctIdx).length;
  const unanswered = total - correct - wrong;
  const pct = Math.round((correct / total) * 100);
  const grade = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
  const message = pct >= 90 ? "Outstanding."
    : pct >= 80 ? "Solid work."
    : pct >= 70 ? "Passing — review the misses."
    : pct >= 60 ? "Below the bar — keep grinding."
    : "Time to hit the slides.";

  // Section breakdown
  const bySection = {};
  for (let i = 0; i < total; i++) {
    const q = examConfig.questions[i];
    bySection[q.section] ??= { total: 0, correct: 0 };
    bySection[q.section].total++;
    if (answers[i] === q.correctIdx) bySection[q.section].correct++;
  }

  const radius = 84;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const goodColor = getComputedStyle(document.documentElement).getPropertyValue('--good').trim() || "#15803D";
  const warnColor = getComputedStyle(document.documentElement).getPropertyValue('--warn').trim() || "#B45309";
  const badColor = getComputedStyle(document.documentElement).getPropertyValue('--bad').trim() || "#B91C1C";
  const ringColor = pct >= 80 ? goodColor : pct >= 60 ? warnColor : badColor;
  const ringBg = getComputedStyle(document.documentElement).getPropertyValue('--rule').trim() || "#EAE4D7";

  const flaggedCount = Object.keys(flagged).filter(k => flagged[k]).length;

  return (
    <div className="results">
      <div className="top-right-controls"><ThemeToggle {...themeProps} /></div>
      <header className="results-hero">
        <div className="kicker">Exam Complete</div>
        <h1 className="display">{message}</h1>
      </header>

      <div className="results-card">
        <div className="score-ring">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={radius} fill="none" stroke={ringBg} strokeWidth="14" />
            <circle cx="100" cy="100" r={radius} fill="none" stroke={ringColor} strokeWidth="14"
              strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
              transform="rotate(-90 100 100)" style={{ transition: "stroke-dasharray 1.2s ease" }} />
          </svg>
          <div className="score-center">
            <div className="score-pct">{pct}<span>%</span></div>
            <div className="score-grade">Grade · {grade}</div>
          </div>
        </div>

        <div className="score-stats">
          <Stat label="Correct"     value={correct}     color="var(--good)" />
          <Stat label="Wrong"       value={wrong}       color="var(--bad)" />
          <Stat label="Unanswered"  value={unanswered}  color="var(--ink-3)" />
          <Stat label="Time"        value={formatTime(elapsed)} color="var(--ink)" muted />
        </div>
      </div>

      <section className="breakdown">
        <h2 className="breakdown-title">By topic</h2>
        {Object.entries(bySection).map(([sec, { total: t, correct: c }]) => {
          const p = Math.round((c / t) * 100);
          const meta = getSectionMeta(sec);
          return (
            <div key={sec} className="breakdown-row">
              <div className="breakdown-row-head">
                <span className="breakdown-name">
                  <span className="dot" style={{ background: meta.accent }} /> {sec}
                </span>
                <span className="breakdown-score">{c}/{t} · {p}%</span>
              </div>
              <div className="breakdown-bar">
                <div className="breakdown-bar-fill" style={{ width: `${p}%`, background: meta.accent }} />
              </div>
            </div>
          );
        })}
      </section>

      <div className="results-actions">
        {wrong > 0 && <button className="btn btn-primary" onClick={() => onReview("wrong")}>Review {wrong} wrong →</button>}
        {flaggedCount > 0 && <button className="btn btn-ghost" onClick={() => onReview("flagged")}>Review {flaggedCount} flagged</button>}
        <button className="btn btn-ghost" onClick={() => onReview("all")}>Review all</button>
        <button className="btn btn-ghost" onClick={onRetake}>Retake</button>
        <button className="btn btn-ghost" onClick={onHome}>Home</button>
      </div>
    </div>
  );
}

function Stat({ label, value, color, muted }) {
  return (
    <div className="stat">
      <div className="stat-value" style={{ color: muted ? "var(--ink)" : color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ---------- Review ---------- */

function Review({ themeProps, examConfig, answers, flagged, filter, onFilterChange, onBack }) {
  const items = examConfig.questions.map((q, i) => ({
    q, i,
    user: answers[i],
    flag: !!flagged[i],
    correct: answers[i] === q.correctIdx,
  }));
  const filtered = items.filter(it => {
    if (filter === "wrong") return it.user !== undefined && !it.correct;
    if (filter === "flagged") return it.flag;
    if (filter === "unanswered") return it.user === undefined;
    return true;
  });

  const wrongCount = items.filter(it => it.user !== undefined && !it.correct).length;
  const flaggedCount = items.filter(it => it.flag).length;
  const unansweredCount = items.filter(it => it.user === undefined).length;

  return (
    <div className="review">
      <header className="review-header">
        <button className="icon-btn" onClick={onBack}>←</button>
        <h2>Review</h2>
        <ThemeToggle {...themeProps} />
      </header>

      <div className="review-filters">
        <FilterBtn cur={filter} value="all"        label="All"        count={items.length}     onClick={onFilterChange} />
        <FilterBtn cur={filter} value="wrong"      label="Wrong"      count={wrongCount}       onClick={onFilterChange} />
        <FilterBtn cur={filter} value="flagged"    label="Flagged"    count={flaggedCount}     onClick={onFilterChange} />
        <FilterBtn cur={filter} value="unanswered" label="Unanswered" count={unansweredCount}  onClick={onFilterChange} />
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">No questions match this filter.</div>
      )}

      <ol className="review-list">
        {filtered.map(({ q, i, user, correct, flag }) => {
          const meta = getSectionMeta(q.section);
          return (
            <li key={i} className="review-item">
              <div className="review-item-header">
                <span className="review-num">Q{i + 1}</span>
                <span className="section-pill" style={{ background: meta.tint, color: meta.accent }}>
                  <span className="dot" style={{ background: meta.accent }} /> {q.section}
                </span>
                {q.difficulty === "h" && <span className="diff-pill">Hard</span>}
                {flag && <span className="review-tag tag-flag">⚑ flagged</span>}
                {user === undefined
                  ? <span className="review-tag tag-skip">Unanswered</span>
                  : correct
                    ? <span className="review-tag tag-good">✓ Correct</span>
                    : <span className="review-tag tag-bad">✗ Wrong</span>}
              </div>
              <h3 className="review-q">{q.question}</h3>
              <ul className="review-opts">
                {q.options.map((opt, j) => {
                  const isUser = user === j;
                  const isCorrect = j === q.correctIdx;
                  let cls = "review-opt";
                  if (isCorrect) cls += " review-opt-correct";
                  else if (isUser) cls += " review-opt-wrong";
                  return (
                    <li key={j} className={cls}>
                      <span className="opt-letter">{"ABCD"[j]}</span>
                      <span className="opt-text">{opt}</span>
                      {isCorrect && <span className="review-opt-tag">Correct answer</span>}
                      {isUser && !isCorrect && <span className="review-opt-tag">Your answer</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <div className="review-footer">
        <button className="btn btn-ghost" onClick={onBack}>← Back to results</button>
      </div>
    </div>
  );
}

function FilterBtn({ cur, value, label, count, onClick }) {
  return (
    <button className={`filter-btn ${cur === value ? "filter-btn-active" : ""}`} onClick={() => onClick(value)}>
      {label} <span className="filter-count">{count}</span>
    </button>
  );
}

/* ---------- mount ---------- */

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
