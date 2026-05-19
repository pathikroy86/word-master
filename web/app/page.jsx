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
  Menu,
  PlusCircle,
  Search,
  Settings,
  SlidersHorizontal,
  Volume2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { authClient } from "../lib/auth-client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const pageSize = 20;

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "flashcards", label: "Flashcards", icon: GraduationCap },
  { id: "words", label: "All words", icon: List },
  { id: "add-word", label: "Add word", icon: PlusCircle },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "settings", label: "Settings", icon: Settings }
];

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
  }
];

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

function Sidebar({ activeView, setActiveView, closeMenu }) {
  const learnItems = navItems.filter((item) => ["dashboard", "flashcards", "words", "add-word"].includes(item.id));
  const progressItems = navItems.filter((item) => ["stats", "saved"].includes(item.id));

  function selectView(view) {
    setActiveView(view);
    closeMenu?.();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brandIcon"><BookOpen size={16} /></span>
        <span>WordMaster</span>
      </div>

      <div className="navGroupLabel">Learn</div>
      <nav className="navList">
        {learnItems.map((item) => (
          <button className={activeView === item.id ? "navItem active" : "navItem"} key={item.id} onClick={() => selectView(item.id)}>
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="navGroupLabel">Progress</div>
      <nav className="navList">
        {progressItems.map((item) => (
          <button className={activeView === item.id ? "navItem active" : "navItem"} key={item.id} onClick={() => selectView(item.id)}>
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="navGroupLabel">Account</div>
      <button className={activeView === "settings" ? "navItem active" : "navItem"} onClick={() => selectView("settings")}>
        <Settings size={16} />
        Settings
      </button>
    </aside>
  );
}

function SearchBox({ value, onChange, placeholder = "Search GRE words..." }) {
  return (
    <label className="searchBox">
      <Search size={17} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function WindowFrame({ title, children, className = "" }) {
  return (
    <section className={`windowFrame ${className}`}>
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

function WordDetail({ word, onReview }) {
  if (!word) return <div className="emptyState">Choose a word to see the full detail.</div>;

  return (
    <div className="detailCard">
      <div className="detailTop">
        <div>
          <h2>{word.word}</h2>
          <em>{word.partOfSpeech}</em>
        </div>
        <div className="iconCluster">
          <button title="Pronounce in UK English" onClick={() => speakUkWord(word.word)}><Volume2 size={17} /></button>
          <button title="Save"><Bookmark size={17} /></button>
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

      <div className="reviewActions">
        <button onClick={() => onReview(word, "learning")}><X size={15} /> Don&apos;t know</button>
        <button onClick={() => onReview(word, "mastered")}><Check size={15} /> Got it!</button>
      </div>
    </div>
  );
}

function StatsGrid({ stats }) {
  return (
    <div className="statsGrid">
      <div><strong>{stats.mastered || 0}</strong><span>Mastered</span></div>
      <div><strong className="green">{stats.accuracy || 0}%</strong><span>Accuracy</span></div>
      <div><strong className="red">{stats.learning || 0}</strong><span>Learning</span></div>
      <div><strong className="orange">{stats.streak || 0}</strong><span>Day streak</span></div>
    </div>
  );
}

function Dashboard({ words, stats, setActiveView, onSelect, user }) {
  const today = words.slice(0, 3);
  const displayName = user?.name || user?.email || "there";

  return (
    <WindowFrame title="WordMaster - Dashboard" className="dashboardWindow">
      <div className="dashboardLayout">
        <div className="dashboardMain">
          <div className="topSearchRow">
            <SearchBox value="" onChange={() => {}} placeholder="Search GRE words..." />
            <div className="avatar">AA</div>
          </div>

          <h1>Good morning, {displayName}</h1>
          <p className="lead">{stats.new || 0} new words are waiting. Master words as you review them.</p>

          <div className="streakCard">
            <span><Flame size={14} /> 7-day streak</span>
            <div className="weekdayRow">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                <strong className={index === 5 ? "today" : index === 6 ? "inactive" : ""} key={`${day}-${index}`}>{day}</strong>
              ))}
            </div>
          </div>

          <StatsGrid stats={stats} />

          <div className="sectionHeader">
            <h3>Today&apos;s words</h3>
            <button onClick={() => setActiveView("words")}>See all <ChevronRight size={14} /></button>
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
            <button onClick={() => setActiveView("flashcards")}><GraduationCap size={15} /> Start flashcards</button>
            <button onClick={() => setActiveView("words")}><List size={15} /> Browse all words</button>
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
  onReview
}) {
  const counts = useMemo(() => ({
    all: stats.total || pagination.total || words.length,
    new: stats.new || 0,
    learning: stats.learning || 0,
    mastered: stats.mastered || 0
  }), [pagination.total, stats, words.length]);

  const selectedIndex = words.findIndex((item) => item.id === selectedWord?.id);
  const selectedPosition = selectedIndex >= 0 ? (page - 1) * pageSize + selectedIndex + 1 : 1;

  return (
    <div className="wordsGrid">
      <WindowFrame title="Word detail" className="detailWindow">
        <div className="wordDetailHeader">
          <span>All words</span>
          <span>{selectedPosition} / {pagination.total || counts.all}</span>
        </div>
        <WordDetail word={selectedWord || words[0]} onReview={onReview} />
      </WindowFrame>

      <WindowFrame title="All words" className="listWindow">
        <div className="listToolbar">
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search words..."
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
              onSelect={setSelectedWord}
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
  const deck = words.length ? words : fallbackWords;
  const word = selectedWord || deck[index % deck.length];

  function nextWord() {
    const next = (index + 1) % deck.length;
    setIndex(next);
    setSelectedWord(deck[next]);
  }

  return (
    <WindowFrame title="Flashcards" className="flashcardWindow">
      <div className="flashLayout">
        <WordDetail word={word} onReview={async (item, reviewStatus) => {
          await onReview(item, reviewStatus);
          nextWord();
        }} />
        <aside className="queuePanel">
          <h3>Up next</h3>
          {deck.slice(0, 8).map((item, itemIndex) => (
            <WordRow key={item.id} word={item} index={itemIndex} selected={item.id === word.id} onSelect={setSelectedWord} />
          ))}
        </aside>
      </div>
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
        <div>{[46, 58, 38, 52, 68, 22, 10].map((height, index) => <span className={index === 5 ? "today" : ""} style={{ height }} key={height} />)}</div>
      </section>
    </WindowFrame>
  );
}

function Saved({ words, onSelect, setActiveView }) {
  return (
    <WindowFrame title="Saved words">
      <div className="wordListPanel">
        {words.filter((_, index) => index % 4 === 0).slice(0, 12).map((word, index) => (
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
            {image ? <img src={image} alt="User profile" /> : <span>{(name || email || "U").slice(0, 2).toUpperCase()}</span>}
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

function AuthScreen() {
  const [mode, setMode] = useState("login");
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
    <main className="authShell">
      <section className="authPanel">
        <div className="brand authBrand">
          <span className="brandIcon"><BookOpen size={16} /></span>
          <span>WordMaster</span>
        </div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p>{mode === "login" ? "Log in to continue your GRE study session." : "Register once, then track your words and progress."}</p>

        <form className="authForm" onSubmit={submit}>
          {mode === "register" && (
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your Name" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" required minLength={8} />
          </label>
          {message && <div className="authMessage">{message}</div>}
          <button disabled={pending}>{pending ? "Please wait..." : mode === "login" ? "Log in" : "Register"}</button>
        </form>

        <button className="authSwitch" onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setMessage("");
        }}>
          {mode === "login" ? "Not registered yet? Create an account" : "Already registered? Log in"}
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [activeView, setActiveView] = useState("dashboard");
  const [words, setWords] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedWord, setSelectedWord] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("rank");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const statsData = await fetchJson("/stats");
        setStats(statsData);
      } catch {
        setError("Using sample stats because the API is not reachable yet.");
        setStats({ total: fallbackWords.length, mastered: 1, learning: 1, new: 1, learned: 1, accuracy: 50, dueToday: 1, streak: 0 });
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
        setWords(fallbackWords);
        setPagination({ total: fallbackWords.length, pages: 1 });
        setSelectedWord(fallbackWords[0]);
      } finally {
        setLoading(false);
        setListLoading(false);
      }
    }

    loadWords();
  }, [page, search, sort, status]);

  async function handleReview(word, nextStatus) {
    const previousStatus = normalizeStatus(word.status);

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

  function openAllWords() {
    setSearch("");
    setStatus("all");
    setPage(1);
    setActiveView("words");
  }

  function changeView(view) {
    if (view === "words") {
      openAllWords();
      return;
    }
    setActiveView(view);
  }

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
    dashboard: <Dashboard words={words} stats={stats} setActiveView={changeView} onSelect={setSelectedWord} user={session?.user} />,
    flashcards: <Flashcards words={words} selectedWord={selectedWord} setSelectedWord={setSelectedWord} onReview={handleReview} />,
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
      />
    ),
    "add-word": <AddWordPage onCreated={handleWordCreated} />,
    stats: <StatsPage stats={stats} />,
    saved: <Saved words={words} onSelect={setSelectedWord} setActiveView={changeView} />,
    settings: <SettingsPage session={session} />
  }[activeView];

  if (sessionPending) {
    return <div className="loading authLoading"><Loader2 className="spin" size={28} /> Checking session...</div>;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <main className="appShell">
      <button className="mobileMenuButton" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
      <div className={menuOpen ? "mobileOverlay show" : "mobileOverlay"} onClick={() => setMenuOpen(false)} />
      <div className={menuOpen ? "mobileSidebar show" : "mobileSidebar"}>
        <Sidebar activeView={activeView} setActiveView={changeView} closeMenu={() => setMenuOpen(false)} />
      </div>

      <div className="appFrame">
        <Sidebar activeView={activeView} setActiveView={changeView} />
        <section className="workspace">
          <div className="sessionBar">
            {session.user?.image && <img src={session.user.image} alt="" />}
            <span>{session.user?.name || session.user?.email}</span>
            <button onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.reload() } })}>Sign out</button>
          </div>
          {error && <div className="notice">{error}</div>}
          {loading ? (
            <div className="loading"><Loader2 className="spin" size={28} /> Loading your GRE dataset...</div>
          ) : content}
        </section>
      </div>
    </main>
  );
}
