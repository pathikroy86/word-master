"use client";

import {
  BarChart3,
  Bookmark,
  BookOpen,
  Check,
  ChevronRight,
  Flame,
  GraduationCap,
  Home,
  List,
  Loader2,
  LogOut,
  Menu,
  PlusCircle,
  Search,
  Settings,
  SlidersHorizontal,
  Lock,
  Volume2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "../lib/auth-client";
import { filterAndSortWords } from "../lib/word-search";
import {
  addQuizEntry,
  getProgressSnapshot,
  getStreakViewModel,
  loadQuizLog,
  recordStudyActivity
} from "../lib/progress-store";
import ThemeToggle from "./components/ThemeToggle";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
const pageSize = 20;
const SAVED_KEY = "wordmaster-saved-ids";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "flashcards", label: "Flashcards", icon: GraduationCap },
  { id: "quiz", label: "Quiz", icon: BookOpen },
  { id: "words", label: "All words", icon: List },
  { id: "add-word", label: "Add word", icon: PlusCircle },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "settings", label: "Settings", icon: Settings }
];

const mobileNavItems = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "flashcards", label: "Cards", icon: GraduationCap },
  { id: "quiz", label: "Quiz", icon: BookOpen },
  { id: "words", label: "Words", icon: List },
  { id: "stats", label: "Stats", icon: BarChart3 }
];

const guestMobileNavItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "flashcards", label: "Cards", icon: GraduationCap },
  { id: "quiz", label: "Quiz", icon: BookOpen },
  { id: "words", label: "Words", icon: List },
  { id: "stats", label: "Stats", icon: BarChart3 }
];

const viewLabels = {
  dashboard: "Dashboard",
  home: "Home",
  flashcards: "Flashcards",
  quiz: "Quiz mode",
  words: "All words",
  "add-word": "Add word",
  stats: "Progress & stats",
  saved: "Saved words",
  settings: "Account settings"
};

const demoStats = {
  total: 847,
  mastered: 124,
  learning: 38,
  new: 12,
  learned: 124,
  accuracy: 76,
  streak: 7,
  dueToday: 12
};

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function loadSavedIds() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function persistSavedIds(ids) {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]));
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function paginateWords(words, page, limit = pageSize) {
  const skip = (page - 1) * limit;
  const items = words.slice(skip, skip + limit);
  return {
    items,
    total: words.length,
    pages: Math.max(Math.ceil(words.length / limit), 1)
  };
}

function getUserInitials(name, email) {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  if (email?.trim()) {
    return email.trim().charAt(0).toUpperCase();
  }
  return "U";
}

const fallbackWords = [
  {
    id: "fallback-abate",
    word: "Abate",
    partOfSpeech: "verb",
    pronunciation: "/uh-BAYT/",
    meaning: "to reduce in intensity or degree",
    bangla: "কমে যাওয়া, হ্রাস পাওয়া",
    synonyms: ["lessen", "subside", "diminish"],
    antonyms: ["intensify", "increase"],
    example: "The storm began to abate after midnight.",
    status: "mastered",
    frequencyRank: 1
  },
  {
    id: "fallback-bellicose",
    word: "Bellicose",
    partOfSpeech: "adjective",
    pronunciation: "/BEL-i-kohs/",
    meaning: "eager or quick to argue or fight",
    bangla: "যুদ্ধংদেহী, আক্রমণাত্মক",
    synonyms: ["aggressive", "belligerent", "combative", "pugnacious"],
    antonyms: ["peaceful", "pacifist", "conciliatory"],
    example: "His bellicose rhetoric alarmed the diplomats.",
    status: "learning",
    frequencyRank: 2
  },
  {
    id: "fallback-cacophony",
    word: "Cacophony",
    partOfSpeech: "noun",
    pronunciation: "/kuh-KAH-fuh-nee/",
    meaning: "a harsh discordant mixture of sounds",
    bangla: "কর্কশ শব্দের মিশ্রণ",
    synonyms: ["noise", "din", "racket"],
    antonyms: ["harmony", "quiet"],
    example: "The market opened with a cacophony of voices.",
    status: "new",
    frequencyRank: 3
  },
  {
    id: "demo-ebullient",
    word: "Ebullient",
    partOfSpeech: "adjective",
    pronunciation: "/ih-BUHL-yunt/",
    meaning: "cheerful and full of energy",
    bangla: "উচ্ছ্বসিত, প্রাণবন্ত",
    synonyms: ["exuberant", "buoyant", "lively"],
    antonyms: ["gloomy", "morose", "dejected"],
    example: "Her ebullient mood lifted everyone's spirits.",
    status: "learning",
    frequencyRank: 4
  },
  {
    id: "demo-enervate",
    word: "Enervate",
    partOfSpeech: "verb",
    pronunciation: "/EN-er-vayt/",
    meaning: "to weaken or drain energy from",
    bangla: "দুর্বল করা, শক্তিহীন করা",
    synonyms: ["debilitate", "exhaust", "sap"],
    antonyms: ["invigorate", "energize", "strengthen"],
    example: "The humid heat enervated the hikers by noon.",
    status: "new",
    frequencyRank: 5
  },
  {
    id: "demo-fervid",
    word: "Fervid",
    partOfSpeech: "adjective",
    pronunciation: "/FER-vid/",
    meaning: "intensely enthusiastic or passionate",
    bangla: "উত্সাহী, উত্তেজিত",
    synonyms: ["ardent", "fervent", "impassioned"],
    antonyms: ["apathetic", "indifferent", "cool"],
    example: "The fervid debate continued well past midnight.",
    status: "mastered",
    frequencyRank: 6
  }
];

const demoWords = fallbackWords;

function normalizeStatus(status) {
  if (status === "review") return "learning";
  if (["new", "learning", "mastered"].includes(status)) return status;
  return "new";
}

function statusDot(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "mastered") return "var(--teal)";
  if (normalized === "learning") return "var(--amber)";
  return "var(--purple-soft)";
}

function speakUkWord(word) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(word);
  const voices = synth.getVoices();
  const ukVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith("en-gb"))
    || voices.find((voice) => voice.lang?.toLowerCase().startsWith("en"));

  synth.cancel();
  utterance.lang = "en-GB";
  utterance.rate = 0.86;
  utterance.pitch = 1;
  if (ukVoice) utterance.voice = ukVoice;
  synth.speak(utterance);
}

async function fetchJson(path, options) {
  const response = await fetch(`${apiUrl}${path}`, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function ToastStack({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="toastStack show" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast ${toast.type}`} key={toast.id}>{toast.message}</div>
      ))}
    </div>
  );
}

function BottomNav({ activeView, setActiveView, isGuest = false }) {
  const items = isGuest ? guestMobileNavItems : mobileNavItems;

  return (
    <nav className="bottomNav" aria-label="Main navigation">
      {items.map((item) => (
        <button
          className={activeView === item.id ? "active" : ""}
          key={item.id}
          onClick={() => setActiveView(item.id)}
          type="button"
        >
          <item.icon size={18} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Sidebar({ activeView, setActiveView, closeMenu, isGuest = false, user, onSignOut }) {
  const learnItems = isGuest
    ? [
        { id: "home", label: "Home", icon: Home },
        ...navItems.filter((item) => ["flashcards", "quiz", "words", "add-word"].includes(item.id))
      ]
    : navItems.filter((item) => ["dashboard", "flashcards", "quiz", "words", "add-word"].includes(item.id));
  const progressItems = navItems.filter((item) => ["stats", "saved"].includes(item.id));
  const displayName = user?.name || user?.email || "Account";

  function selectView(view) {
    setActiveView(view);
    closeMenu?.();
  }

  function navClass(view) {
    const active = activeView === view;
    const locked = isGuest && view !== "home";
    return [active ? "navItem active" : "navItem", locked ? "locked" : ""].filter(Boolean).join(" ");
  }

  function handleSignOut() {
    closeMenu?.();
    onSignOut?.();
  }

  return (
    <aside className="sidebar">
      {!isGuest && user && (
        <div className="sidebarAccount">
          <div className="sidebarAccountAvatar">
            {user.image ? (
              <img src={user.image} alt="" />
            ) : (
              <span>{getUserInitials(user.name, user.email)}</span>
            )}
          </div>
          <div className="sidebarAccountMeta">
            <strong>{displayName}</strong>
            {user.email && user.name && <span>{user.email}</span>}
          </div>
        </div>
      )}

      <div className="brand">
        <span className="brandIcon"><BookOpen size={16} /></span>
        <span>WordMaster</span>
      </div>

      {isGuest && <p className="sidebarDemoNote">Demo mode — log in to unlock menu features</p>}

      <div className="navGroupLabel">Learn</div>
      <nav className="navList">
        {learnItems.map((item) => (
          <button className={navClass(item.id)} key={item.id} type="button" onClick={() => selectView(item.id)}>
            <item.icon size={16} />
            {item.label}
            {isGuest && item.id !== "home" && <Lock size={12} className="navLock" />}
          </button>
        ))}
      </nav>

      <div className="navGroupLabel">Progress</div>
      <nav className="navList">
        {progressItems.map((item) => (
          <button className={navClass(item.id)} key={item.id} type="button" onClick={() => selectView(item.id)}>
            <item.icon size={16} />
            {item.label}
            {isGuest && <Lock size={12} className="navLock" />}
          </button>
        ))}
      </nav>

      <div className="navGroupLabel">Account</div>
      <nav className="navList">
        <button className={navClass("settings")} type="button" onClick={() => selectView("settings")}>
          <Settings size={16} />
          Settings
          {isGuest && <Lock size={12} className="navLock" />}
        </button>
        {!isGuest && onSignOut && (
          <button className="navItem navSignOut" type="button" onClick={handleSignOut}>
            <LogOut size={16} />
            Sign out
          </button>
        )}
      </nav>
    </aside>
  );
}

function SearchBox({ value, onChange, placeholder = "Search words..." }) {
  return (
    <label className="searchBox">
      <Search size={16} strokeWidth={2.25} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}

function WindowFrame({ title, children, className = "", animate = true }) {
  return (
    <section className={`windowFrame ${animate ? "animate-panel-rise" : ""} ${className}`.trim()}>
      <div className="windowBar">
        <span />
        <span />
        <span />
        <strong>{title}</strong>
      </div>
      {children}
    </section>
  );
}

function WordRow({ word, index, selected, onSelect }) {
  return (
    <button className={selected ? "wordRow selected" : "wordRow"} onClick={() => onSelect(word)}>
      <span className="wordIndex">{index + 1}</span>
      <span className="wordMeta">
        <strong>{word.word}</strong>
        <small>{word.meaning || "Meaning unavailable"}</small>
      </span>
      <span className="masteryDot" style={{ background: statusDot(word.status) }} />
    </button>
  );
}

function ChipSection({ title, items, type }) {
  return (
    <section className="chipSection">
      <div className={`fieldLabel ${type}`}>{title}</div>
      <div className="chips">
        {(items?.length ? items : ["Not listed"]).map((item) => (
          <span className={`chip ${type}`} key={item}>{item}</span>
        ))}
      </div>
    </section>
  );
}

function WordDetail({ word, onReview, savedIds, onToggleSave, guestMode = false, onRequireAuth }) {
  if (!word) return <div className="emptyState">Choose a word to see the full detail.</div>;

  const isSaved = savedIds?.has(word.id);

  return (
    <div className="detailCard">
      <div className="detailTop">
        <div>
          <h2>{word.word}</h2>
          <em>{word.partOfSpeech}</em>
        </div>
        <div className="iconCluster">
          <button type="button" title="Pronounce in UK English" onClick={() => speakUkWord(word.word)}><Volume2 size={17} /></button>
          <button
            type="button"
            className={isSaved ? "saved" : ""}
            title={guestMode ? "Log in to save words" : isSaved ? "Remove bookmark" : "Save word"}
            onClick={() => (guestMode ? onRequireAuth?.("saved") : onToggleSave?.(word))}
          >
            <Bookmark size={17} fill={isSaved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      {word.pronunciation && <strong className="pronunciation">{word.pronunciation}</strong>}
      <div className="fieldLabel">English</div>
      <p className="meaning">{word.meaning || "No English definition was found for this record."}</p>

      {word.bangla && (
        <>
          <div className="fieldLabel">Bangla</div>
          <p className="bangla">{word.bangla}</p>
        </>
      )}

      <div className="divider" />
      <ChipSection title="Synonyms" items={word.synonyms} type="synonym" />
      <ChipSection title="Antonyms" items={word.antonyms} type="antonym" />

      <div className="divider" />
      <div className="fieldLabel">Example sentence</div>
      <p className="example">"{word.example || `Use ${word.word} in a sentence during your next review.`}"</p>

      {guestMode ? (
        <div className="reviewActions guestLocked">
          <button type="button" onClick={() => onRequireAuth?.("words")}><Lock size={15} /> Log in to track progress</button>
        </div>
      ) : (
        <div className="reviewActions">
          <button type="button" onClick={() => onReview(word, "learning")}><X size={15} /> Don&apos;t know</button>
          <button type="button" onClick={() => onReview(word, "mastered")}><Check size={15} /> Got it!</button>
        </div>
      )}
    </div>
  );
}

function StatsGrid({ stats, activePanel, onSelectPanel }) {
  const cells = [
    { id: "mastered", value: stats.mastered || 0, label: "Mastered", className: "" },
    { id: "accuracy", value: `${stats.accuracy || 0}%`, label: "Accuracy", className: "green" },
    { id: "learning", value: stats.learning || 0, label: "Learning", className: "red" },
    { id: "streak", value: stats.streak || 0, label: "Day streak", className: "orange" }
  ];

  return (
    <div className="statsGrid statsGridInteractive">
      {cells.map((cell, index) => (
        <button
          type="button"
          className={activePanel === cell.id ? "statCell statCellButton active" : "statCell statCellButton"}
          key={cell.id}
          style={{ animationDelay: `${index * 0.07}s` }}
          onClick={() => onSelectPanel(activePanel === cell.id ? null : cell.id)}
        >
          <strong className={cell.className}>{cell.value}</strong>
          <span>{cell.label}</span>
        </button>
      ))}
    </div>
  );
}

function StreakPanel({ streakInfo, onClose }) {
  const maxCount = Math.max(...streakInfo.week.map((day) => day.count), 1);

  return (
    <div className="dashboardStatPanel streakPanel animate-view-in">
      <div className="statPanelHeader">
        <h3>Your streak</h3>
        <button type="button" className="statPanelClose" onClick={onClose}>Close</button>
      </div>
      <div className="streakPanelHero">
        <div className="streakFlameWrap">
          <Flame size={28} className="streakFlameIcon" />
        </div>
        <div>
          <h3>{streakInfo.streak}-day streak</h3>
          <p>{streakInfo.todayCount} reviews today · {streakInfo.weekTotal} this week</p>
        </div>
      </div>
      <div className="streakWeekGrid">
        {streakInfo.week.map((day, index) => (
          <div
            className={[
              "streakDay",
              day.isToday ? "today" : "",
              day.active ? "active" : "inactive"
            ].filter(Boolean).join(" ")}
            key={day.key}
            style={{ animationDelay: `${index * 0.08}s` }}
            title={`${day.fullLabel}: ${day.count} reviews`}
          >
            <span className="streakDayBar" style={{ height: `${Math.max((day.count / maxCount) * 100, day.active ? 18 : 8)}%` }} />
            <strong>{day.label}</strong>
            <em>{day.count || "—"}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatWordsPanel({ title, status, onSelectWord, setActiveView, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status, limit: "200", sort: "alpha-asc" });
        const data = await fetchJson(`/words?${params.toString()}`);
        setItems(data.items?.length ? data.items : fallbackWords.filter((w) => normalizeStatus(w.status) === status));
      } catch {
        setItems(fallbackWords.filter((w) => normalizeStatus(w.status) === status));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [status]);

  return (
    <div className="dashboardStatPanel animate-view-in">
      <div className="statPanelHeader">
        <h3>{title}</h3>
        <button type="button" className="statPanelClose" onClick={onClose}>Close</button>
      </div>
      {loading && <div className="inlineLoading">Loading {title.toLowerCase()}...</div>}
      {!loading && !items.length && <div className="emptyState">No words in this group yet.</div>}
      {!loading && (
        <div className="wordListPanel statPanelList">
          {items.map((word, index) => (
            <WordRow
              key={word.id}
              word={word}
              index={index}
              onSelect={(item) => {
                onSelectWord(item);
                setActiveView("words");
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AccuracyPanel({ quizLog, onClose }) {
  const correct = quizLog.filter((entry) => entry.correct);
  const wrong = quizLog.filter((entry) => !entry.correct);

  return (
    <div className="dashboardStatPanel animate-view-in">
      <div className="statPanelHeader">
        <h3>Quiz accuracy</h3>
        <button type="button" className="statPanelClose" onClick={onClose}>Close</button>
      </div>
      <div className="accuracySummary">
        <div className="accuracyPill correct"><Check size={16} /> {correct.length} correct</div>
        <div className="accuracyPill wrong"><X size={16} /> {wrong.length} wrong</div>
      </div>
      {!quizLog.length && <div className="emptyState">Take a quiz to see your right and wrong answers here.</div>}
      {correct.length > 0 && (
        <>
          <div className="fieldLabel">Correct answers</div>
          <div className="quizResultList">
            {correct.map((entry) => (
              <div className="quizResultRow correct" key={entry.id}>
                <strong>{entry.word}</strong>
                <span>{entry.answer}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {wrong.length > 0 && (
        <>
          <div className="fieldLabel">Wrong answers</div>
          <div className="quizResultList">
            {wrong.map((entry) => (
              <div className="quizResultRow wrong" key={entry.id}>
                <strong>{entry.word}</strong>
                <span>You chose: {entry.picked}</span>
                <span>Correct: {entry.answer}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DashboardStatDetail({ panel, stats, quizLog, streakInfo, onSelectWord, setActiveView, onClose }) {
  if (!panel) return null;
  if (panel === "streak") return <StreakPanel streakInfo={streakInfo} onClose={onClose} />;
  if (panel === "mastered") {
    return (
      <StatWordsPanel
        title="Mastered words"
        status="mastered"
        onSelectWord={onSelectWord}
        setActiveView={setActiveView}
        onClose={onClose}
      />
    );
  }
  if (panel === "learning") {
    return (
      <StatWordsPanel
        title="Learning words"
        status="learning"
        onSelectWord={onSelectWord}
        setActiveView={setActiveView}
        onClose={onClose}
      />
    );
  }
  if (panel === "accuracy") return <AccuracyPanel quizLog={quizLog} onClose={onClose} />;
  return null;
}

function FlipFlashcard({ word, flipped, onFlip, onReview, onNext }) {
  if (!word) return <div className="emptyState">No words in this deck yet.</div>;

  return (
    <>
      <div className="flashcardFlip">
        <button
          type="button"
          className="flashcardSpeak"
          onClick={(event) => {
            event.stopPropagation();
            speakUkWord(word.word);
          }}
          aria-label={`Pronounce ${word.word}`}
          title="Listen in UK English"
        >
          <Volume2 size={18} />
        </button>
        <div
          className={flipped ? "flashcardInner flipped" : "flashcardInner"}
          onClick={onFlip}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onFlip();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={flipped ? "Hide definition" : "Reveal definition"}
        >
          <div className="flashcardFace front">
            <span className="fieldLabel">GRE word</span>
            <h2>{word.word}</h2>
            <em>{word.partOfSpeech}</em>
            {word.pronunciation && <p className="pronunciation">{word.pronunciation}</p>}
            <p className="flashcardHint">Tap card to {flipped ? "hide" : "reveal"} meaning</p>
          </div>
          <div className="flashcardFace back">
            <div className="fieldLabel">English</div>
            <p className="meaning">{word.meaning}</p>
            {word.bangla && (
              <>
                <div className="fieldLabel">Bangla</div>
                <p className="bangla">{word.bangla}</p>
              </>
            )}
            <div className="divider" />
            <p className="example">"{word.example || `Use ${word.word} in a sentence.`}"</p>
          </div>
        </div>
      </div>
      <div className="flashcardControls">
        <button type="button" onClick={() => onReview(word, "learning")}><X size={15} /> Don&apos;t know</button>
        <button type="button" className="primary" onClick={() => onReview(word, "mastered")}><Check size={15} /> Got it</button>
        <button type="button" className="primary" onClick={onNext}>Next word</button>
      </div>
    </>
  );
}

function Dashboard({ words, stats, quizLog, streakInfo, setActiveView, onSelect, user, dashboardSearch, onSearch, onBrowseAll }) {
  const today = words.slice(0, 3);
  const displayName = user?.name || user?.email || "there";
  const [activePanel, setActivePanel] = useState(null);

  return (
    <WindowFrame title="WordMaster - Dashboard" className="dashboardWindow">
      <div className="dashboardLayout">
        <div className="dashboardMain">
          <div className="topSearchRow">
            <SearchBox value={dashboardSearch} onChange={onSearch} placeholder="Search words..." />
            <div className="avatar">
              {user?.image ? (
                <img src={user.image} alt="" />
              ) : (
                getUserInitials(user?.name, user?.email)
              )}
            </div>
          </div>

          <h1>Welcome, {displayName}</h1>
          <p className="lead">{stats.new || 0} new words are waiting. Master words as you review them.</p>

          <StatsGrid stats={stats} activePanel={activePanel} onSelectPanel={setActivePanel} />

          <DashboardStatDetail
            panel={activePanel}
            stats={stats}
            quizLog={quizLog}
            streakInfo={streakInfo}
            onSelectWord={onSelect}
            setActiveView={setActiveView}
            onClose={() => setActivePanel(null)}
          />

          <div className="sectionHeader">
            <h3>Today&apos;s words</h3>
            <button type="button" onClick={onBrowseAll}>See all <ChevronRight size={14} /></button>
          </div>
          <div className="todayList">
            {today.map((word, index) => (
              <WordRow key={word.id} word={word} index={index} onSelect={(item) => {
                onSelect(item);
                setActiveView("words");
              }} />
            ))}
          </div>

          <div className="actionRow">
            <button type="button" onClick={() => setActiveView("flashcards")}><GraduationCap size={15} /> Start flashcards</button>
            <button type="button" onClick={() => setActiveView("quiz")}><BookOpen size={15} /> Take a quiz</button>
            <button type="button" onClick={onBrowseAll}><List size={15} /> Browse all words</button>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

function WordsView({
  words,
  selectedWord,
  setSelectedWord,
  search,
  setSearch,
  status,
  setStatus,
  sort,
  setSort,
  page,
  setPage,
  pagination,
  stats,
  listLoading,
  onReview,
  isMobile,
  savedIds,
  onToggleSave
}) {
  const [mobilePanel, setMobilePanel] = useState("list");
  const counts = useMemo(() => ({
    all: stats.total || pagination.total || words.length,
    new: stats.new || 0,
    learning: stats.learning || 0,
    mastered: stats.mastered || 0
  }), [pagination.total, stats, words.length]);

  const selectedIndex = words.findIndex((item) => item.id === selectedWord?.id);
  const selectedPosition = selectedIndex >= 0 ? (page - 1) * pageSize + selectedIndex + 1 : 1;

  function selectWord(word) {
    setSelectedWord(word);
    if (isMobile) setMobilePanel("detail");
  }

  return (
    <div className="wordsGrid">
      {isMobile && (
        <div className="mobilePanelTabs">
          <button className={mobilePanel === "list" ? "active" : ""} type="button" onClick={() => setMobilePanel("list")}>Word list</button>
          <button className={mobilePanel === "detail" ? "active" : ""} type="button" onClick={() => setMobilePanel("detail")}>Details</button>
        </div>
      )}

      <WindowFrame title="Word detail" className={isMobile && mobilePanel !== "detail" ? "detailWindow mobileHidden" : "detailWindow"}>
        {isMobile && (
          <button className="backToList show" type="button" onClick={() => setMobilePanel("list")}>
            ← Back to list
          </button>
        )}
        <div className="wordDetailHeader">
          <span>All words</span>
          <span>{selectedPosition} / {pagination.total || counts.all}</span>
        </div>
        <WordDetail
          word={selectedWord || words[0]}
          onReview={onReview}
          savedIds={savedIds}
          onToggleSave={onToggleSave}
        />
      </WindowFrame>

      <WindowFrame title="All words" className={isMobile && mobilePanel !== "list" ? "listWindow mobileHidden" : "listWindow"}>
        <div className="listToolbar">
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search words in your list..."
          />
          <label className="sortSelect">
            <SlidersHorizontal size={16} />
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="rank">Default order</option>
              <option value="alpha-asc">Alphabetic A-Z</option>
              <option value="alpha-desc">Alphabetic Z-A</option>
            </select>
          </label>
        </div>

        <div className="filterChips">
          {[
            ["all", `All (${counts.all})`],
            ["new", `New (${counts.new})`],
            ["learning", `Learning (${counts.learning})`],
            ["mastered", `Mastered (${counts.mastered})`]
          ].map(([id, label]) => (
            <button
              className={status === id ? `active ${id}` : id}
              key={id}
              onClick={() => {
                setStatus(id);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="wordListPanel">
          {listLoading && <div className="inlineLoading">Loading page {page}...</div>}
          {!listLoading && words.map((word, index) => (
            <WordRow
              key={word.id}
              word={word}
              index={(page - 1) * pageSize + index}
              selected={selectedWord?.id === word.id}
              onSelect={selectWord}
            />
          ))}
        </div>

        <div className="paginationBar">
          <button disabled={page <= 1 || listLoading} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
            Previous
          </button>
          <span>Page {page} of {pagination.pages || 1}</span>
          <button disabled={page >= (pagination.pages || 1) || listLoading} onClick={() => setPage((current) => current + 1)}>
            Next
          </button>
        </div>
      </WindowFrame>
    </div>
  );
}

function Flashcards({ words, selectedWord, setSelectedWord, onReview }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const touchStart = useRef(null);
  const deck = words.length ? words : fallbackWords;
  const word = selectedWord || deck[index % deck.length];

  function nextWord() {
    const next = (index + 1) % deck.length;
    setIndex(next);
    setSelectedWord(deck[next]);
    setFlipped(false);
  }

  function prevWord() {
    const next = (index - 1 + deck.length) % deck.length;
    setIndex(next);
    setSelectedWord(deck[next]);
    setFlipped(false);
  }

  async function reviewAndAdvance(item, reviewStatus) {
    await onReview(item, reviewStatus);
    nextWord();
  }

  function handleTouchStart(event) {
    touchStart.current = event.changedTouches[0].clientX;
  }

  function handleTouchEnd(event) {
    if (touchStart.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) nextWord();
    else prevWord();
  }

  return (
    <WindowFrame title="Flashcards" className="flashcardWindow">
      <div
        className="flashLayout"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div>
          <FlipFlashcard
            word={word}
            flipped={flipped}
            onFlip={() => setFlipped((current) => !current)}
            onReview={reviewAndAdvance}
            onNext={nextWord}
          />
        </div>
        <aside className="queuePanel">
          <h3>Up next</h3>
          {deck.slice(0, 8).map((item, itemIndex) => (
            <WordRow
              key={item.id}
              word={item}
              index={itemIndex}
              selected={item.id === word.id}
              onSelect={(item) => {
                setSelectedWord(item);
                setIndex(deck.findIndex((entry) => entry.id === item.id));
                setFlipped(false);
              }}
            />
          ))}
        </aside>
      </div>
    </WindowFrame>
  );
}

function QuizPage({ words, onReview, onToast, onQuizAnswer }) {
  const deck = words.length >= 4 ? words : fallbackWords;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const word = deck[index % deck.length];
  const options = useMemo(() => {
    const distractors = deck
      .filter((item) => item.id !== word.id)
      .map((item) => item.meaning)
      .filter(Boolean);
    return shuffle([word.meaning, ...shuffle(distractors).slice(0, 3)]).slice(0, 4);
  }, [deck, word]);

  function choose(option) {
    if (picked) return;
    const correct = option === word.meaning;
    setPicked(option);
    setScore((current) => ({
      correct: current.correct + (correct ? 1 : 0),
      total: current.total + 1
    }));
    onToast(correct ? `Correct — ${word.word}` : `Not quite — ${word.word}`, correct ? "success" : "error");
    onQuizAnswer?.({
      wordId: word.id,
      word: word.word,
      correct,
      picked: option,
      answer: word.meaning
    });
    if (correct) onReview(word, "mastered", { silent: true });
    else onReview(word, "learning", { silent: true });
  }

  function nextQuestion() {
    setPicked(null);
    setIndex((current) => (current + 1) % deck.length);
  }

  const progress = ((index % deck.length) + 1) / deck.length;

  return (
    <WindowFrame title="Quiz mode" className="quizWindow">
      <div className="quizProgress">
        <span><i style={{ width: `${progress * 100}%`, display: "block", height: "100%", background: "var(--primary)" }} /></span>
        <em>{score.correct}/{Math.max(score.total, 1)} correct</em>
      </div>
      <div className="quizPrompt">
        <span>What does this mean?</span>
        <h2>{word.word}</h2>
        <em>{word.partOfSpeech}</em>
        <button
          type="button"
          className="quizSpeak"
          onClick={() => speakUkWord(word.word)}
          aria-label={`Pronounce ${word.word}`}
          title="Listen in UK English"
        >
          <Volume2 size={18} />
        </button>
      </div>
      <div className="answers">
        {options.map((option) => {
          let className = "";
          if (picked) {
            if (option === word.meaning) className = "correct";
            else if (option === picked) className = "wrong";
          }
          return (
            <button className={className} key={option} type="button" onClick={() => choose(option)} disabled={Boolean(picked)}>
              {option}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="feedback">
          <strong>{picked === word.meaning ? "Nice work!" : "Keep going"}</strong>
          <p>{word.meaning}{word.bangla ? ` · ${word.bangla}` : ""}</p>
          <button type="button" className="primary" style={{ marginTop: 10, width: "100%", minHeight: 44 }} onClick={nextQuestion}>
            Next question
          </button>
        </div>
      )}
    </WindowFrame>
  );
}

function ProgressBar({ label, value, color = "var(--primary)" }) {
  return (
    <div className="progressBlock">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <i><b style={{ width: `${Math.min(value, 100)}%`, background: color }} /></i>
    </div>
  );
}

function StatsPage({ stats }) {
  const total = stats.total || 1;
  const masteredPercent = Math.round(((stats.mastered || 0) / total) * 100);

  return (
    <WindowFrame title="Progress & Stats" className="statsWindow">
      <h2>Your progress</h2>
      <div className="statsGrid two">
        <div><strong>{stats.learned || 0}</strong><span>Learned</span></div>
        <div><strong className="red">{Math.max((stats.total || 0) - (stats.learned || 0), 0)}</strong><span>Remaining</span></div>
      </div>
      <ProgressBar label="Overall mastery" value={masteredPercent} />
      <section className="breakdown">
        <h3>Mastery breakdown</h3>
        <ProgressBar label="Mastered" value={Math.round(((stats.mastered || 0) / total) * 100)} />
        <ProgressBar label="Learning" value={Math.round(((stats.learning || 0) / total) * 100)} color="var(--amber)" />
        <ProgressBar label="New" value={Math.round(((stats.new || 0) / total) * 100)} color="var(--purple-soft)" />
      </section>
      <section className="weekly">
        <h3>Weekly activity</h3>
        <div>{[46, 58, 38, 52, 68, 22, 10].map((height, index) => (
          <span
            className={index === 5 ? "today" : ""}
            style={{ height }}
            key={`day-${index}`}
            title={`Day ${index + 1}: ${height} reviews`}
            role="img"
            aria-label={`Day ${index + 1}, ${height} reviews`}
          />
        ))}</div>
      </section>
    </WindowFrame>
  );
}

function Saved({ words, savedIds, onSelect, setActiveView }) {
  const savedWords = words.filter((word) => savedIds.has(word.id));

  return (
    <WindowFrame title="Saved words">
      <div className="wordListPanel">
        {!savedWords.length && (
          <div className="emptyState">Bookmark words with the save icon to see them here.</div>
        )}
        {savedWords.map((word, index) => (
          <WordRow key={word.id} word={word} index={index} onSelect={(item) => {
            onSelect(item);
            setActiveView("words");
          }} />
        ))}
      </div>
    </WindowFrame>
  );
}

function AddWordPage({ onCreated }) {
  const [form, setForm] = useState({
    word: "",
    partOfSpeech: "adjective",
    pronunciation: "",
    meaning_en: "",
    meaning_bn: "",
    synonyms: "",
    antonyms: "",
    example: ""
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitWord(event) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    try {
      const created = await fetchJson("/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      setMessage(`${created.word} was added to the word list.`);
      setForm({
        word: "",
        partOfSpeech: "adjective",
        pronunciation: "",
        meaning_en: "",
        meaning_bn: "",
        synonyms: "",
        antonyms: "",
        example: ""
      });
      onCreated?.(created);
    } catch (error) {
      setMessage(error?.message || "Could not add this word.");
    } finally {
      setPending(false);
    }
  }

  return (
    <WindowFrame title="Add word" className="settingsWindow">
      <form className="accountForm addWordForm" onSubmit={submitWord}>
        <div className="accountFields">
          <label>
            Word
            <input value={form.word} onChange={(event) => updateField("word", event.target.value)} placeholder="e.g. Ebullient" required />
          </label>
          <label>
            Part of speech
            <select value={form.partOfSpeech} onChange={(event) => updateField("partOfSpeech", event.target.value)}>
              <option value="adjective">Adjective</option>
              <option value="noun">Noun</option>
              <option value="verb">Verb</option>
              <option value="adverb">Adverb</option>
              <option value="phrase">Phrase</option>
            </select>
          </label>
          <label>
            Pronunciation
            <input value={form.pronunciation} onChange={(event) => updateField("pronunciation", event.target.value)} placeholder="/ih-BUHL-yunt/" />
          </label>
          <label>
            English meaning
            <input value={form.meaning_en} onChange={(event) => updateField("meaning_en", event.target.value)} placeholder="Cheerful and full of energy" required />
          </label>
          <label>
            Bangla meaning
            <input value={form.meaning_bn} onChange={(event) => updateField("meaning_bn", event.target.value)} placeholder="উচ্ছ্বসিত, প্রাণবন্ত" required />
          </label>
          <label>
            Synonyms
            <input value={form.synonyms} onChange={(event) => updateField("synonyms", event.target.value)} placeholder="cheerful, buoyant, lively" required />
          </label>
          <label>
            Antonyms
            <input value={form.antonyms} onChange={(event) => updateField("antonyms", event.target.value)} placeholder="gloomy, morose, sad" required />
          </label>
          <label>
            Example sentence
            <input value={form.example} onChange={(event) => updateField("example", event.target.value)} placeholder="Her ebullient speech energized the room." />
          </label>
        </div>

        {message && <div className="authMessage">{message}</div>}
        <div className="settingsActions">
          <button disabled={pending}>{pending ? "Adding..." : "Add word"}</button>
        </div>
      </form>
    </WindowFrame>
  );
}

function SettingsPage({ session }) {
  const [name, setName] = useState(session.user?.name || "");
  const [email, setEmail] = useState(session.user?.email || "");
  const [image, setImage] = useState(session.user?.image || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function readImage(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file.");
      return;
    }
    if (file.size > 900 * 1024) {
      setMessage("Please choose an image under 900 KB.");
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setImage(dataUrl);
    setMessage("");
  }

  async function saveProfile(event) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const updates = {};
    if (name.trim()) updates.name = name.trim();
    updates.image = image || null;

    const profileResult = await authClient.updateUser(updates);
    if (profileResult.error) {
      setPending(false);
      setMessage(profileResult.error.message || "Could not update profile.");
      return;
    }

    if (email && email !== session.user?.email) {
      const emailResult = await authClient.changeEmail({ newEmail: email });
      if (emailResult.error) {
        setPending(false);
        setMessage(emailResult.error.message || "Profile saved, but email could not be changed.");
        return;
      }
    }

    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) {
        setPending(false);
        setMessage("Enter both current password and new password to change your password.");
        return;
      }

      const passwordResult = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true
      });
      if (passwordResult.error) {
        setPending(false);
        setMessage(passwordResult.error.message || "Profile saved, but password could not be changed.");
        return;
      }
    }

    setPending(false);
    setMessage("Account updated.");
    setTimeout(() => window.location.reload(), 700);
  }

  return (
    <WindowFrame title="Account Settings" className="settingsWindow">
      <form className="accountForm" onSubmit={saveProfile}>
        <div className="profilePhotoBlock">
          <div className="profilePhoto">
            {image ? <img src={image} alt="User profile" /> : <span>{getUserInitials(name, email)}</span>}
          </div>
          <label className="uploadButton">
            Upload picture
            <input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0])} />
          </label>
        </div>

        <div className="accountFields">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            Current password
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Required only for password change" />
          </label>
          <label>
            New password
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Minimum 8 characters" minLength={8} />
          </label>
        </div>

        {message && <div className="authMessage">{message}</div>}
        <div className="settingsActions">
          <button disabled={pending}>{pending ? "Saving..." : "Save account"}</button>
        </div>
      </form>
    </WindowFrame>
  );
}

function AuthPanel({ compact = false, featureLabel, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();

    if (mode === "register" && !name.trim()) {
      setMessage("Enter your name to register.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setPending(true);
    setMessage("");

    try {
      const payload = { email: email.trim(), password };
      const result = mode === "login"
        ? await authClient.signIn.email({ ...payload, rememberMe: true })
        : await authClient.signUp.email({ ...payload, name: name.trim() });

      if (result.error) {
        setMessage(result.error.message || "Authentication failed. Please try again.");
        setPending(false);
        return;
      }

      setMessage(mode === "login" ? "Logged in." : "Account created.");
      window.location.reload();
    } catch (error) {
      setMessage(error?.message || "Could not reach the authentication server.");
      setPending(false);
    }
  }

  return (
    <section className={`authPanel ${compact ? "authPanelCompact" : ""}`}>
      <div className="authPanelShine" aria-hidden="true" />
      {!compact && (
        <div className="brand authBrand animate-auth-in" style={{ animationDelay: "0.02s" }}>
          <span className="brandIcon"><BookOpen size={16} /></span>
          <span>WordMaster</span>
        </div>
      )}

      <div key={mode} className="authPanelBody">
        <h1 className="animate-auth-in" style={{ animationDelay: "0.06s" }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="animate-auth-in" style={{ animationDelay: "0.1s" }}>
          {featureLabel
            ? `Log in to use ${featureLabel} and save your GRE progress.`
            : mode === "login"
              ? "Log in to continue your GRE study session."
              : "Register once, then track your words and progress."}
        </p>

        <form className="authForm" onSubmit={submit}>
          {mode === "register" && (
            <label className="authField animate-auth-in" style={{ animationDelay: "0.14s" }}>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your Name" />
            </label>
          )}
          <label className="authField animate-auth-in" style={{ animationDelay: mode === "register" ? "0.18s" : "0.14s" }}>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          <label className="authField animate-auth-in" style={{ animationDelay: mode === "register" ? "0.22s" : "0.18s" }}>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" required minLength={8} />
          </label>
          {message && <div className="authMessage animate-auth-pop">{message}</div>}
          <button className="authSubmit animate-auth-in" style={{ animationDelay: mode === "register" ? "0.28s" : "0.22s" }} type="submit" disabled={pending}>
            {pending ? "Please wait..." : mode === "login" ? "Log in" : "Register"}
          </button>
        </form>

        <button
          className="authSwitch animate-auth-in"
          style={{ animationDelay: mode === "register" ? "0.32s" : "0.26s" }}
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setMessage("");
          }}
        >
          {mode === "login" ? "Not registered yet? Create an account" : "Already registered? Log in"}
        </button>
      </div>
    </section>
  );
}

function GuestHomePage({ words, stats, selectedWord, setSelectedWord, search, setSearch, onRequireAuth, isMobile }) {
  const filteredWords = useMemo(() => {
    if (!search.trim()) return words;
    return filterAndSortWords(words, { search, status: "all", sort: "rank" });
  }, [search, words]);

  useEffect(() => {
    if (!filteredWords.find((word) => word.id === selectedWord?.id)) {
      setSelectedWord(filteredWords[0] || null);
    }
  }, [filteredWords, selectedWord?.id, setSelectedWord]);

  return (
    <>
      <div className="guestBanner animate-view-in">
        <span className="guestBadge">Demo preview</span>
        <p>Browse sample GRE words below. Log in to unlock flashcards, quizzes, and your personal word list.</p>
      </div>

      <WindowFrame title="WordMaster — Demo home" className="dashboardWindow guestHomeWindow animate-view-in">
        <div className="dashboardLayout">
          <div className="dashboardMain">
            <h1>Master GRE vocabulary</h1>
            <p className="lead">Explore {words.length} sample words. Create a free account to track mastery, run quizzes, and sync your list.</p>

            <div className="streakCard">
              <span><Flame size={14} /> {stats.streak}-day streak (demo)</span>
              <div className="weekdayRow">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <strong className={index === 5 ? "today" : index === 6 ? "inactive" : ""} key={`${day}-${index}`}>{day}</strong>
                ))}
              </div>
            </div>

            <StatsGrid stats={stats} />

            <SearchBox value={search} onChange={setSearch} placeholder="Search demo words..." />

            <div className={isMobile ? "guestHomeGrid guestHomeGridStacked" : "guestHomeGrid"}>
              <div className="guestWordList">
                <div className="sectionHeader">
                  <h3>Sample words</h3>
                  <span className="guestCount">{filteredWords.length} shown</span>
                </div>
                <div className="wordListPanel">
                  {filteredWords.map((word, index) => (
                    <WordRow
                      key={word.id}
                      word={word}
                      index={index}
                      selected={selectedWord?.id === word.id}
                      onSelect={setSelectedWord}
                    />
                  ))}
                </div>
              </div>

              <div className="guestWordDetail">
                <WordDetail
                  word={selectedWord || filteredWords[0]}
                  guestMode
                  onRequireAuth={onRequireAuth}
                />
              </div>
            </div>

            <div className="actionRow">
              <button type="button" onClick={() => onRequireAuth("flashcards")}><GraduationCap size={15} /> Start flashcards</button>
              <button type="button" onClick={() => onRequireAuth("quiz")}><BookOpen size={15} /> Take a quiz</button>
              <button type="button" onClick={() => onRequireAuth("words")}><List size={15} /> Browse full word list</button>
            </div>
          </div>
        </div>
      </WindowFrame>
    </>
  );
}

function LockedFeatureView({ viewId, onBack, authMode = "login" }) {
  const label = viewLabels[viewId] || "this feature";

  return (
    <div className="authScene">
      <div className="authSceneOrb authSceneOrbA" aria-hidden="true" />
      <div className="authSceneOrb authSceneOrbB" aria-hidden="true" />
      <WindowFrame title={`${label} — sign in required`} className="lockedWindow animate-view-in">
        <div className="lockedFeature">
          <div className="lockedIcon animate-auth-pop"><Lock size={28} /></div>
          <h2 className="animate-auth-in" style={{ animationDelay: "0.04s" }}>{label} requires an account</h2>
          <p className="animate-auth-in" style={{ animationDelay: "0.08s" }}>
            You&apos;re viewing the demo home. Log in or register to use {label.toLowerCase()}, save words, and sync progress across devices.
          </p>
          <AuthPanel key={authMode} compact featureLabel={label} initialMode={authMode} />
          <button className="backToDemo animate-auth-in" style={{ animationDelay: "0.12s" }} type="button" onClick={onBack}>← Back to demo home</button>
        </div>
      </WindowFrame>
    </div>
  );
}

function PublicApp() {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [activeView, setActiveView] = useState("home");
  const [selectedWord, setSelectedWord] = useState(demoWords[0]);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  function changeView(view) {
    setActiveView(view);
    setMenuOpen(false);
  }

  function openAuth(view, mode = "login") {
    setAuthMode(mode);
    setActiveView(view === "home" ? "dashboard" : view);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, menuOpen]);

  const content = activeView === "home"
    ? (
      <GuestHomePage
        words={demoWords}
        stats={demoStats}
        selectedWord={selectedWord}
        setSelectedWord={setSelectedWord}
        search={search}
        setSearch={setSearch}
        onRequireAuth={openAuth}
        isMobile={isMobile}
      />
    )
    : <LockedFeatureView viewId={activeView} onBack={() => changeView("home")} authMode={authMode} />;

  return (
    <main className="appShell">
      <div className={menuOpen ? "mobileOverlay show" : "mobileOverlay"} onClick={() => setMenuOpen(false)} />
      <div className={menuOpen ? "mobileSidebar show" : "mobileSidebar"}>
        <Sidebar activeView={activeView} setActiveView={changeView} closeMenu={() => setMenuOpen(false)} isGuest />
      </div>

      <div className="appFrame">
        <Sidebar activeView={activeView} setActiveView={changeView} isGuest />
        <section className="workspace">
          <div className="sessionBar guestSessionBar mobileTopBar">
            <button className="mobileMenuButton mobileMenuButtonInline" type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
              <Menu size={18} />
            </button>
            <span className="guestModeLabel">Demo mode</span>
            <div className="sessionBarActions">
              <button className="authCta" type="button" onClick={() => openAuth(activeView === "home" ? "dashboard" : activeView, "login")}>Log in</button>
              <button className="authCta primary" type="button" onClick={() => openAuth(activeView === "home" ? "dashboard" : activeView, "register")}>Sign up</button>
              <ThemeToggle />
            </div>
          </div>
          <div key={activeView} className="viewTransition">
            {content}
          </div>
        </section>
      </div>

      {isMobile && <BottomNav activeView={activeView} setActiveView={changeView} isGuest />}
    </main>
  );
}

export default function App() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [activeView, setActiveView] = useState("dashboard");
  const [words, setWords] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedWord, setSelectedWord] = useState(null);
  const [search, setSearch] = useState("");
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("rank");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedIds, setSavedIds] = useState(() => loadSavedIds());
  const [toasts, setToasts] = useState([]);
  const [quizLog, setQuizLog] = useState([]);
  const [streakInfo, setStreakInfo] = useState({ streak: 0, week: [], weekTotal: 0, todayCount: 0 });

  const refreshProgress = useCallback(() => {
    const log = loadQuizLog();
    const streak = getStreakViewModel();
    setQuizLog(log);
    setStreakInfo(streak);
    setStats((current) => getProgressSnapshot(current, log));
  }, []);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  const pushToast = useCallback((message, type = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2800);
  }, []);

  const toggleSave = useCallback((word) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(word.id)) {
        next.delete(word.id);
        pushToast(`Removed “${word.word}” from saved`, "success");
      } else {
        next.add(word.id);
        pushToast(`Saved “${word.word}”`, "success");
      }
      persistSavedIds(next);
      return next;
    });
  }, [pushToast]);

  useEffect(() => {
    async function loadStats() {
      try {
        const statsData = await fetchJson("/stats");
        setStats(getProgressSnapshot(statsData));
        setStreakInfo(getStreakViewModel());
        setQuizLog(loadQuizLog());
      } catch {
        setError("Using sample stats because the API is not reachable yet.");
        setStats(getProgressSnapshot({
          total: fallbackWords.length,
          mastered: 1,
          learning: 1,
          new: 1,
          learned: 1,
          dueToday: 1
        }));
        setStreakInfo(getStreakViewModel());
        setQuizLog(loadQuizLog());
      }
    }

    loadStats();
  }, []);

  useEffect(() => {
    async function loadWords() {
      try {
        setListLoading(true);
        const params = new URLSearchParams({
          limit: String(pageSize),
          skip: String((page - 1) * pageSize),
          status,
          sort
        });
        if (search.trim()) params.set("search", search.trim());

        const wordData = await fetchJson(`/words?${params.toString()}`);
        const items = wordData.items?.length ? wordData.items : [];
        setWords(items);
        setPagination({ total: wordData.total || items.length, pages: wordData.pages || 1 });
        setSelectedWord((current) => items.find((item) => item.id === current?.id) || items[0] || null);
        setError("");
      } catch {
        setError("Using sample words because the API is not reachable yet.");
        const filtered = filterAndSortWords(fallbackWords, { search, status, sort });
        const paged = paginateWords(filtered, page);
        setWords(paged.items);
        setPagination({ total: paged.total, pages: paged.pages });
        setSelectedWord((current) => paged.items.find((item) => item.id === current?.id) || paged.items[0] || null);
      } finally {
        setLoading(false);
        setListLoading(false);
      }
    }

    loadWords();
  }, [page, search, sort, status]);

  async function handleReview(word, nextStatus, options = {}) {
    const previousStatus = normalizeStatus(word.status);
    const label = nextStatus === "mastered" ? "Mastered" : "Marked for review";

    setWords((current) => current.map((item) => item.id === word.id ? { ...item, status: nextStatus } : item));
    setSelectedWord((current) => current?.id === word.id ? { ...current, status: nextStatus } : current);
    setStats((current) => {
      if (previousStatus === nextStatus) return current;
      const updated = {
        ...current,
        [previousStatus]: Math.max((current[previousStatus] || 0) - 1, 0),
        [nextStatus]: (current[nextStatus] || 0) + 1
      };
      const reviewed = (updated.mastered || 0) + (updated.learning || 0);
      return {
        ...updated,
        learned: updated.mastered || 0,
        accuracy: reviewed ? Math.round(((updated.mastered || 0) / reviewed) * 100) : 0,
        dueToday: updated.learning || 0
      };
    });

    recordStudyActivity();
    refreshProgress();

    if (!options.silent) {
      pushToast(`${word.word}: ${label}`, "success");
    }

    if (!word.id?.startsWith("fallback")) {
      try {
        await fetchJson(`/words/${word.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus })
        });
      } catch {
        setError("Review saved locally, but MongoDB update failed.");
      }
    }
  }

  function handleSearch(value) {
    setDashboardSearch(value);
    setSearch(value);
    setPage(1);
    if (value.trim()) {
      setActiveView("words");
    }
  }

  function openAllWords(clearSearch = true) {
    if (clearSearch) {
      setSearch("");
      setDashboardSearch("");
    }
    setStatus("all");
    setPage(1);
    setActiveView("words");
  }

  function changeView(view) {
    if (view === "words") {
      setStatus("all");
      setPage(1);
      setActiveView("words");
      setMenuOpen(false);
      return;
    }
    setActiveView(view);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, menuOpen]);

  function handleWordCreated(word) {
    setSelectedWord(word);
    setStats((current) => ({
      ...current,
      total: (current.total || pagination.total || 0) + 1,
      new: (current.new || 0) + 1
    }));
    setPagination((current) => ({
      ...current,
      total: (current.total || 0) + 1,
      pages: Math.max(Math.ceil(((current.total || 0) + 1) / pageSize), 1)
    }));
  }

  const content = {
    dashboard: (
      <Dashboard
        words={words}
        stats={stats}
        quizLog={quizLog}
        streakInfo={streakInfo}
        setActiveView={changeView}
        onSelect={setSelectedWord}
        user={session?.user}
        dashboardSearch={dashboardSearch}
        onSearch={handleSearch}
        onBrowseAll={() => openAllWords(true)}
      />
    ),
    flashcards: (
      <Flashcards
        words={words}
        selectedWord={selectedWord}
        setSelectedWord={setSelectedWord}
        onReview={handleReview}
      />
    ),
    quiz: (
      <QuizPage
        words={words}
        onReview={handleReview}
        onToast={pushToast}
        onQuizAnswer={(entry) => {
          addQuizEntry(entry);
          recordStudyActivity();
          refreshProgress();
        }}
      />
    ),
    words: (
      <WordsView
        words={words}
        selectedWord={selectedWord}
        setSelectedWord={setSelectedWord}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        sort={sort}
        setSort={setSort}
        page={page}
        setPage={setPage}
        pagination={pagination}
        stats={stats}
        listLoading={listLoading}
        onReview={handleReview}
        isMobile={isMobile}
        savedIds={savedIds}
        onToggleSave={toggleSave}
      />
    ),
    "add-word": <AddWordPage onCreated={handleWordCreated} />,
    stats: <StatsPage stats={stats} />,
    saved: <Saved words={words} savedIds={savedIds} onSelect={setSelectedWord} setActiveView={changeView} />,
    settings: <SettingsPage session={session} />
  }[activeView];

  if (sessionPending) {
    return <div className="loading authLoading"><Loader2 className="spin" size={28} /> Checking session...</div>;
  }

  if (!session) {
    return <PublicApp />;
  }

  return (
    <main className="appShell">
      <div className={menuOpen ? "mobileOverlay show" : "mobileOverlay"} onClick={() => setMenuOpen(false)} />
      <div className={menuOpen ? "mobileSidebar show" : "mobileSidebar"}>
        <Sidebar
          activeView={activeView}
          setActiveView={changeView}
          closeMenu={() => setMenuOpen(false)}
          user={session.user}
          onSignOut={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}
        />
      </div>

      <ToastStack toasts={toasts} />

      <div className="appFrame">
        <Sidebar
          activeView={activeView}
          setActiveView={changeView}
          user={session.user}
          onSignOut={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}
        />
        <section className="workspace">
          <div className="sessionBar mobileTopBar">
            <button className="mobileMenuButton mobileMenuButtonInline" type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
              <Menu size={18} />
            </button>
            <div className="sessionBarActions">
              <ThemeToggle />
            </div>
          </div>
          {error && <div className="notice animate-view-in">{error}</div>}
          {loading ? (
            <div className="loading"><Loader2 className="spin" size={28} /> Loading your GRE dataset...</div>
          ) : (
            <div key={activeView} className="viewTransition">
              {content}
            </div>
          )}
        </section>
      </div>

      {isMobile && <BottomNav activeView={activeView} setActiveView={changeView} isGuest={false} />}
    </main>
  );
}
