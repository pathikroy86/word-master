import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import * as Speech from "expo-speech";
import {
  BarChart3,
  Bookmark,
  BookOpen,
  Check,
  ArrowUpDown,
  GraduationCap,
  Home,
  List,
  Plus,
  RotateCcw,
  Search,
  Settings,
  LogOut,
  Menu,
  Moon,
  Sun,
  Volume2,
  X
} from "lucide-react-native";
import { sampleWords } from "./src/data/words";
import { filterAndSortWords, normalizeStatusValue } from "./src/lib/word-search";
import { readJson, writeJson } from "./src/lib/storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";
const WORDS_KEY = "wordmaster.words";
const SAVED_KEY = "wordmaster.saved";
const QUIZ_KEY = "wordmaster.quizLog";
const ACTIVITY_KEY = "wordmaster.activity";
const TOKEN_KEY = "wordmaster.authToken";
const USER_KEY = "wordmaster.user";
const THEME_KEY = "wordmaster.theme";
const useNativeAnimationDriver = Platform.OS !== "web";

const tabs = [
  { id: "dashboard", label: "Home", icon: Home },
  { id: "flashcards", label: "Cards", icon: GraduationCap },
  { id: "quiz", label: "Quiz", icon: BookOpen },
  { id: "words", label: "Words", icon: List },
  { id: "stats", label: "Stats", icon: BarChart3 }
];

const facebookFonts = Platform.select({
  ios: {
    regular: "System",
    medium: "System",
    bold: "System"
  },
  android: {
    regular: "Roboto",
    medium: "Roboto",
    bold: "Roboto"
  },
  default: {
    regular: "Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    medium: "Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    bold: "Segoe UI, Roboto, Helvetica, Arial, sans-serif"
  }
});

const palettes = {
  light: {
    bg: "#f0f2f5",
    panel: "#ffffff",
    panelSoft: "#f7f8fa",
    panelSofter: "#e7f0ff",
    text: "#050505",
    muted: "#65676b",
    line: "#dadde1",
    primary: "#1877f2",
    primaryDark: "#166fe5",
    teal: "#00a884",
    amber: "#f5a400",
    coral: "#e41e3f",
    white: "#ffffff",
    activeBg: "#e7f3ff",
    savedBg: "#fff4d6",
    successBg: "#e6f6f1",
    dangerBg: "#fdecef",
    overlay: "rgba(5, 5, 5, 0.42)"
  },
  dark: {
    bg: "#18191a",
    panel: "#242526",
    panelSoft: "#303031",
    panelSofter: "#3a3b3c",
    text: "#e4e6eb",
    muted: "#b0b3b8",
    line: "#3e4042",
    primary: "#2d88ff",
    primaryDark: "#1b74e4",
    teal: "#31c7a3",
    amber: "#f7b928",
    coral: "#ff5c77",
    white: "#ffffff",
    activeBg: "#263951",
    savedBg: "#3b311d",
    successBg: "#183d34",
    dangerBg: "#43252b",
    overlay: "rgba(0, 0, 0, 0.62)"
  }
};

function createTheme(mode) {
  return {
    mode,
    colors: palettes[mode] || palettes.light,
    fonts: facebookFonts,
    radius: {
      sm: 8,
      md: 10
    }
  };
}

let appTheme = createTheme("light");
let colors = appTheme.colors;
let styles;

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function statusColor(status) {
  const normalized = normalizeStatusValue(status);
  if (normalized === "mastered") return colors.teal;
  if (normalized === "learning") return colors.amber;
  return colors.primary;
}

function statusLabel(status) {
  const normalized = normalizeStatusValue(status);
  return normalized === "new" ? "New" : normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getStats(words, quizLog, activity) {
  const mastered = words.filter((word) => normalizeStatusValue(word.status) === "mastered").length;
  const learning = words.filter((word) => normalizeStatusValue(word.status) === "learning").length;
  const fresh = words.filter((word) => normalizeStatusValue(word.status) === "new").length;
  const correct = quizLog.filter((entry) => entry.correct).length;
  const accuracy = quizLog.length ? Math.round((correct / quizLog.length) * 100) : 0;

  let streak = 0;
  const cursor = new Date();
  while (activity[todayKey(cursor)] > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    total: words.length,
    mastered,
    learning,
    new: fresh,
    accuracy,
    streak,
    dueToday: learning + fresh
  };
}

function uniqueOptions(answer, words) {
  const options = new Set([answer]);
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  for (const word of shuffled) {
    if (options.size >= 4) break;
    if (word.meaning) options.add(word.meaning);
  }
  return [...options].sort(() => Math.random() - 0.5);
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readApiResponse(response, fallbackMessage) {
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }

  return data;
}

function IconButton({ children, onPress, label, active = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        active && styles.iconButtonActive,
        pressed && styles.pressed,
        style
      ]}
    >
      {children}
    </Pressable>
  );
}

function ActionButton({ children, onPress, tone = "primary", disabled = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        tone === "secondary" && styles.secondaryButton,
        tone === "danger" && styles.dangerButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <Text style={[styles.actionButtonText, tone === "secondary" && styles.secondaryButtonText]}>
        {children}
      </Text>
    </Pressable>
  );
}

function LoadingAnimation() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 780,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNativeAnimationDriver
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 780,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: useNativeAnimationDriver
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.12]
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.38, 0.84]
  });

  return (
    <View style={styles.loadingMark}>
      <Animated.View style={[styles.loadingRing, { opacity, transform: [{ scale }] }]} />
      <View style={styles.loadingCore}>
        <BookOpen size={24} color={colors.white} />
      </View>
    </View>
  );
}

function AnimatedScreen({ children, trigger }) {
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNativeAnimationDriver
    }).start();
  }, [progress, trigger]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0]
  });

  return (
    <Animated.View style={[styles.content, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function StatTile({ value, label, color = colors.primary, onPress, active = false }) {
  const content = (
    <>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.statTile, active && styles.statTileActive, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.statTile}>
      {content}
    </View>
  );
}

function WordRow({ word, selected, onPress }) {
  const currentStatus = statusLabel(word.status);

  return (
    <Pressable
      onPress={() => onPress(word)}
      style={({ pressed }) => [
        styles.wordRow,
        selected && styles.wordRowSelected,
        pressed && styles.pressed
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: statusColor(word.status) }]} />
      <View style={styles.wordRowText}>
        <View style={styles.wordRowTitleLine}>
          <Text style={styles.wordRowTitle} numberOfLines={1}>{word.word}</Text>
          <Text style={[styles.wordStatusPill, { color: statusColor(word.status) }]} numberOfLines={1}>{currentStatus}</Text>
        </View>
        <Text style={styles.wordRowMeaning} numberOfLines={2}>{word.meaning}</Text>
        <Text style={styles.wordRowMeta} numberOfLines={1}>
          #{word.frequencyRank || "-"} {word.partOfSpeech ? `- ${word.partOfSpeech}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

function WordDetail({ word, saved, onSave, onReview }) {
  if (!word) {
    return (
      <View style={styles.emptyPanel}>
        <Text style={styles.mutedText}>Choose a word to see its definition.</Text>
      </View>
    );
  }

  return (
    <View style={styles.detailCard}>
      <View style={styles.detailTop}>
        <View style={styles.detailTitleWrap}>
          <Text style={styles.detailWord} numberOfLines={1}>{word.word}</Text>
          <Text style={styles.partOfSpeech}>{word.partOfSpeech} {word.pronunciation}</Text>
        </View>
        <View style={styles.iconCluster}>
          <IconButton label="Hear pronunciation" onPress={() => Speech.speak(word.word, { language: "en-GB", rate: 0.86 })}>
            <Volume2 size={19} color={colors.text} />
          </IconButton>
          <IconButton label="Save word" active={saved} onPress={() => onSave(word.id)}>
            <Bookmark size={19} color={saved ? colors.amber : colors.text} fill={saved ? colors.amber : "transparent"} />
          </IconButton>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Meaning</Text>
      <Text style={styles.definition}>{word.meaning}</Text>

      <Text style={styles.sectionLabel}>Example</Text>
      <Text style={styles.example}>{word.example}</Text>

      <Text style={styles.sectionLabel}>Synonyms</Text>
      <View style={styles.chipRow}>
        {(word.synonyms || []).map((item) => <Text key={item} style={styles.chip}>{item}</Text>)}
      </View>

      <Text style={styles.sectionLabel}>Antonyms</Text>
      <View style={styles.chipRow}>
        {(word.antonyms || []).map((item) => <Text key={item} style={[styles.chip, styles.coralChip]}>{item}</Text>)}
      </View>

      <View style={styles.reviewRow}>
        <ActionButton tone="danger" onPress={() => onReview(word.id, "learning")} style={styles.reviewButton}>Still learning</ActionButton>
        <ActionButton onPress={() => onReview(word.id, "mastered")} style={styles.reviewButton}>Mastered</ActionButton>
      </View>
    </View>
  );
}

function Dashboard({ words, stats, savedCount, streakGoal, onOpenWords, onOpenCards }) {
  const [activeMetric, setActiveMetric] = useState(null);
  const nextWords = words.filter((word) => normalizeStatusValue(word.status) !== "mastered").slice(0, 3);
  const masteredWords = words.filter((word) => normalizeStatusValue(word.status) === "mastered");
  const dueWords = words.filter((word) => normalizeStatusValue(word.status) !== "mastered").slice(0, 12);

  function toggleMetric(metric) {
    setActiveMetric((current) => current === metric ? null : metric);
  }

  function metricPanel() {
    if (activeMetric === "mastered") {
      return (
        <DashboardMetricPanel title="Mastered words" meta={`${masteredWords.length} completed`} words={masteredWords} empty="No mastered words yet." onClose={() => setActiveMetric(null)} />
      );
    }
    if (activeMetric === "accuracy") {
      return (
        <DashboardMetricModal title="Accuracy" onClose={() => setActiveMetric(null)}>
          <Text style={styles.panelTitle}>Accuracy</Text>
          <Text style={styles.metricBig}>{stats.accuracy}%</Text>
          <Text style={styles.panelCopy}>Accuracy is based on quiz answers saved on this device.</Text>
        </DashboardMetricModal>
      );
    }
    if (activeMetric === "due") {
      return (
        <DashboardMetricPanel title="Due today" meta={`${stats.dueToday} words pending`} words={dueWords} empty="Nothing due right now." onClose={() => setActiveMetric(null)} />
      );
    }
    if (activeMetric === "streak") {
      return (
        <DashboardMetricModal title="Streak" onClose={() => setActiveMetric(null)}>
          <Text style={styles.panelTitle}>Streak</Text>
          <Text style={styles.metricBig}>{stats.streak} days</Text>
          <Text style={styles.panelCopy}>Goal: {streakGoal} days. You are {Math.min(stats.streak, streakGoal)} / {streakGoal} days toward your streak goal.</Text>
          <View style={styles.goalTrack}>
            <View style={[styles.goalFill, { width: `${Math.min((stats.streak / Math.max(streakGoal, 1)) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.panelCopy}>Review words or answer quiz questions each day to grow your streak.</Text>
        </DashboardMetricModal>
      );
    }
    return null;
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.eyebrow}>GRE vocabulary</Text>
      <Text style={styles.heroTitle}>WordMaster</Text>
      <Text style={styles.heroCopy}>Review, quiz, save, and track your GRE word list across iOS, Android, and web.</Text>

      <View style={styles.statsGrid}>
        <StatTile value={stats.mastered} label="Mastered" color={colors.teal} active={activeMetric === "mastered"} onPress={() => toggleMetric("mastered")} />
        <StatTile value={`${stats.accuracy}%`} label="Accuracy" color={colors.primary} active={activeMetric === "accuracy"} onPress={() => toggleMetric("accuracy")} />
        <StatTile value={stats.dueToday} label="Due today" color={colors.amber} active={activeMetric === "due"} onPress={() => toggleMetric("due")} />
        <StatTile value={stats.streak} label="Streak" color={colors.coral} active={activeMetric === "streak"} onPress={() => toggleMetric("streak")} />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Next review</Text>
          <Text style={styles.panelMeta}>{savedCount} saved</Text>
        </View>
        {nextWords.map((word) => (
          <View key={word.id} style={styles.reviewItem}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(word.status) }]} />
            <View style={styles.reviewItemText}>
              <Text style={styles.reviewWord}>{word.word}</Text>
              <Text style={styles.reviewMeaning} numberOfLines={1}>{word.meaning}</Text>
            </View>
          </View>
        ))}
        <View style={styles.dashboardActions}>
          <ActionButton onPress={onOpenCards} style={styles.dashboardAction}>Start cards</ActionButton>
          <ActionButton tone="secondary" onPress={onOpenWords} style={styles.dashboardAction}>Browse words</ActionButton>
        </View>
      </View>

      {metricPanel()}
    </ScrollView>
  );
}

function DashboardMetricModal({ title, onClose, children }) {
  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.metricModal}>
        <View style={styles.modalHeader}>
          <Text style={styles.panelTitle}>{title}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalCloseButton}>
            <X size={18} color={colors.text} />
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  );
}

function DashboardMetricPanel({ title, meta, words, empty, onClose }) {
  return (
    <DashboardMetricModal title={title} onClose={onClose}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelMeta}>{meta}</Text>
      </View>
      {words.length ? words.slice(0, 10).map((word) => (
        <View key={word.id} style={styles.reviewItem}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(word.status) }]} />
          <View style={styles.reviewItemText}>
            <Text style={styles.reviewWord}>{word.word}</Text>
            <Text style={styles.reviewMeaning} numberOfLines={1}>{word.meaning}</Text>
          </View>
        </View>
      )) : <Text style={styles.mutedText}>{empty}</Text>}
    </DashboardMetricModal>
  );
}

function Flashcards({ words, onReview, initialWordId }) {
  const reviewWords = words.length ? words : sampleWords;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const flipProgress = useRef(new Animated.Value(0)).current;
  const cardMotion = useRef(new Animated.Value(1)).current;
  const word = reviewWords[index % reviewWords.length];

  useEffect(() => {
    if (!initialWordId) return;
    const nextIndex = reviewWords.findIndex((item) => item.id === initialWordId);
    if (nextIndex >= 0) {
      setFlipped(false);
      setIndex(nextIndex);
    }
  }, [initialWordId, reviewWords]);

  useEffect(() => {
    Animated.timing(flipProgress, {
      toValue: flipped ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNativeAnimationDriver
    }).start();
  }, [flipProgress, flipped]);

  useEffect(() => {
    cardMotion.setValue(0);
    Animated.spring(cardMotion, {
      toValue: 1,
      friction: 8,
      tension: 72,
      useNativeDriver: useNativeAnimationDriver
    }).start();
  }, [cardMotion, index]);

  const rotateY = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "0deg"]
  });
  const flipScale = flipProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.94, 1]
  });
  const cardScale = cardMotion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1]
  });
  const cardOpacity = cardMotion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1]
  });

  function next() {
    setFlipped(false);
    setIndex((current) => (current + 1) % reviewWords.length);
  }

  function review(status) {
    onReview(word.id, status);
    next();
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.cardTopRow}>
        <Text style={styles.screenTitle}>Flashcards</Text>
        <Text style={styles.panelMeta}>{index + 1} / {reviewWords.length}</Text>
      </View>

      <Pressable onPress={() => setFlipped((value) => !value)} style={({ pressed }) => [styles.flashcardShell, pressed && styles.pressed]}>
        <Animated.View
          style={[
            styles.flashcard,
            {
              opacity: cardOpacity,
              transform: [{ perspective: 900 }, { rotateY }, { scale: cardScale }, { scaleX: flipScale }]
            }
          ]}
        >
          {!flipped ? (
            <>
              <Text style={styles.flashHint}>Tap to reveal</Text>
              <Text style={styles.flashWord}>{word.word}</Text>
              <Text style={styles.partOfSpeech}>{word.partOfSpeech} {word.pronunciation}</Text>
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Meaning</Text>
              <Text style={styles.flashMeaning}>{word.meaning}</Text>
              <Text style={styles.sectionLabel}>Example</Text>
              <Text style={styles.example}>{word.example}</Text>
            </>
          )}
        </Animated.View>
      </Pressable>

      <View style={styles.reviewRow}>
        <ActionButton tone="danger" onPress={() => review("learning")} style={styles.reviewButton}>Missed it</ActionButton>
        <ActionButton onPress={() => review("mastered")} style={styles.reviewButton}>Got it</ActionButton>
      </View>
      <ActionButton tone="secondary" onPress={next}>Skip</ActionButton>
    </ScrollView>
  );
}

function Quiz({ words, onAnswer }) {
  const quizWords = words.length >= 4 ? words : sampleWords;
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState(null);
  const word = quizWords[round % quizWords.length];
  const options = useMemo(() => uniqueOptions(word.meaning, quizWords), [word, quizWords]);
  const answered = Boolean(picked);
  const correct = picked === word.meaning;

  function choose(option) {
    if (answered) return;
    setPicked(option);
    onAnswer({ wordId: word.id, word: word.word, correct: option === word.meaning, picked: option, answer: word.meaning });
  }

  function next() {
    setPicked(null);
    setRound((current) => current + 1);
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.cardTopRow}>
        <Text style={styles.screenTitle}>Quiz</Text>
        <Text style={styles.panelMeta}>Round {round + 1}</Text>
      </View>
      <View style={styles.quizPrompt}>
        <Text style={styles.flashHint}>Choose the meaning</Text>
        <Text style={styles.flashWord}>{word.word}</Text>
        <IconButton label="Hear pronunciation" onPress={() => Speech.speak(word.word, { language: "en-GB", rate: 0.86 })} style={styles.quizSpeaker}>
          <Volume2 size={20} color={colors.text} />
        </IconButton>
      </View>
      <View style={styles.answerList}>
        {options.map((option) => {
          const isPicked = picked === option;
          const isAnswer = answered && option === word.meaning;
          return (
            <Pressable
              key={option}
              onPress={() => choose(option)}
              style={({ pressed }) => [
                styles.answerButton,
                isAnswer && styles.answerCorrect,
                isPicked && !isAnswer && styles.answerWrong,
                pressed && !answered && styles.pressed
              ]}
            >
              <Text style={styles.answerText}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {answered && (
        <View style={[styles.feedback, correct ? styles.feedbackGood : styles.feedbackBad]}>
          <Text style={styles.feedbackTitle}>{correct ? "Correct" : "Review this one"}</Text>
          <Text style={styles.feedbackText}>{word.example}</Text>
          <ActionButton onPress={next} style={styles.feedbackButton}>Next word</ActionButton>
        </View>
      )}
    </ScrollView>
  );
}

function AddWordForm({ onAddWord }) {
  const [addPending, setAddPending] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const [draft, setDraft] = useState({
    word: "",
    meaning: "",
    bangla: "",
    synonyms: "",
    antonyms: "",
    partOfSpeech: "",
    pronunciation: "",
    example: ""
  });

  async function submitWord() {
    setAddPending(true);
    setAddMessage("");
    try {
      const added = await onAddWord(draft);
      setDraft({
        word: "",
        meaning: "",
        bangla: "",
        synonyms: "",
        antonyms: "",
        partOfSpeech: "",
        pronunciation: "",
        example: ""
      });
      setAddMessage("Word added to the shared database.");
    } catch (error) {
      setAddMessage(error.message);
    } finally {
      setAddPending(false);
    }
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <View style={styles.addWordForm}>
      <TextInput
        value={draft.word}
        onChangeText={(value) => updateDraft("word", value)}
        placeholder="Word"
        placeholderTextColor={colors.muted}
        style={styles.authInput}
        autoCapitalize="none"
      />
      <TextInput
        value={draft.meaning}
        onChangeText={(value) => updateDraft("meaning", value)}
        placeholder="English meaning"
        placeholderTextColor={colors.muted}
        style={styles.authInput}
        multiline
      />
      <TextInput
        value={draft.bangla}
        onChangeText={(value) => updateDraft("bangla", value)}
        placeholder="Bangla meaning"
        placeholderTextColor={colors.muted}
        style={styles.authInput}
        multiline
      />
      <TextInput
        value={draft.synonyms}
        onChangeText={(value) => updateDraft("synonyms", value)}
        placeholder="Synonyms, comma separated"
        placeholderTextColor={colors.muted}
        style={styles.authInput}
      />
      <TextInput
        value={draft.antonyms}
        onChangeText={(value) => updateDraft("antonyms", value)}
        placeholder="Antonyms, comma separated"
        placeholderTextColor={colors.muted}
        style={styles.authInput}
      />
      <TextInput
        value={draft.partOfSpeech}
        onChangeText={(value) => updateDraft("partOfSpeech", value)}
        placeholder="Part of speech"
        placeholderTextColor={colors.muted}
        style={styles.authInput}
      />
      <TextInput
        value={draft.pronunciation}
        onChangeText={(value) => updateDraft("pronunciation", value)}
        placeholder="Pronunciation"
        placeholderTextColor={colors.muted}
        style={styles.authInput}
      />
      <TextInput
        value={draft.example}
        onChangeText={(value) => updateDraft("example", value)}
        placeholder="Example sentence"
        placeholderTextColor={colors.muted}
        style={styles.authInput}
        multiline
      />
      {addMessage ? <Text style={styles.authMessage}>{addMessage}</Text> : null}
      <ActionButton disabled={addPending} onPress={submitWord}>
        {addPending ? "Adding..." : "Save to database"}
      </ActionButton>
    </View>
  );
}

function Words({ words, onOpenFlashcard }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("rank");
  const filtered = useMemo(() => filterAndSortWords(words, { search, status, sort }), [words, search, status, sort]);
  const [selectedId, setSelectedId] = useState(filtered[0]?.id);
  const selected = filtered.find((word) => word.id === selectedId) || filtered[0];
  const statusCounts = useMemo(() => getStats(words, [], {}), [words]);
  const sortOptions = [
    { id: "rank", label: "Rank" },
    { id: "alpha-asc", label: "A-Z" },
    { id: "alpha-desc", label: "Z-A" }
  ];

  useEffect(() => {
    if (filtered.length && !filtered.some((word) => word.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <View style={styles.screenContent}>
        <View style={styles.wordSummaryRow}>
          <View style={styles.wordSummaryItem}>
            <Text style={styles.wordSummaryValue}>{statusCounts.total}</Text>
            <Text style={styles.wordSummaryLabel}>Total</Text>
          </View>
          <View style={styles.wordSummaryItem}>
            <Text style={styles.wordSummaryValue}>{statusCounts.new}</Text>
            <Text style={styles.wordSummaryLabel}>New</Text>
          </View>
          <View style={styles.wordSummaryItem}>
            <Text style={styles.wordSummaryValue}>{statusCounts.learning}</Text>
            <Text style={styles.wordSummaryLabel}>Learning</Text>
          </View>
          <View style={styles.wordSummaryItem}>
            <Text style={styles.wordSummaryValue}>{statusCounts.mastered}</Text>
            <Text style={styles.wordSummaryLabel}>Mastered</Text>
          </View>
        </View>

        <View style={styles.wordControls}>
          <View style={styles.searchBox}>
            <Search size={18} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by word, meaning, synonym"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
          <View style={styles.controlGroup}>
            <Text style={styles.controlLabel}>Status</Text>
            <View style={styles.filterRow}>
              {["all", "new", "learning", "mastered"].map((item) => (
                <Pressable key={item} onPress={() => setStatus(item)} style={[styles.filterChip, status === item && styles.filterChipActive]}>
                  <Text style={[styles.filterText, status === item && styles.filterTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.controlGroup}>
            <View style={styles.controlLabelRow}>
              <ArrowUpDown size={15} color={colors.muted} />
              <Text style={styles.controlLabel}>Sort</Text>
            </View>
            <View style={styles.filterRow}>
              {sortOptions.map((item) => (
                <Pressable key={item.id} onPress={() => setSort(item.id)} style={[styles.filterChip, sort === item.id && styles.filterChipActive]}>
                  <Text style={[styles.filterText, sort === item.id && styles.filterTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          style={styles.wordList}
          contentContainerStyle={styles.wordListContent}
          renderItem={({ item }) => (
            <WordRow
              word={item}
              selected={selected?.id === item.id}
              onPress={(word) => {
                setSelectedId(word.id);
                onOpenFlashcard(word.id);
              }}
            />
          )}
          ListEmptyComponent={<Text style={styles.mutedText}>No words match this search.</Text>}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Stats({ stats, quizLog, activity }) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = todayKey(date);
      return {
        key,
        label: date.toLocaleDateString("en-US", { weekday: "narrow" }),
        count: activity[key] || 0
      };
    });
  }, [activity]);
  const max = Math.max(...days.map((day) => day.count), 1);

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.screenTitle}>Progress</Text>
      <View style={styles.statsGrid}>
        <StatTile value={stats.total} label="Words" />
        <StatTile value={stats.mastered} label="Mastered" color={colors.teal} />
        <StatTile value={`${stats.accuracy}%`} label="Accuracy" color={colors.primary} />
        <StatTile value={stats.streak} label="Streak" color={colors.coral} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Weekly reviews</Text>
        <View style={styles.weekRow}>
          {days.map((day) => (
            <View key={day.key} style={styles.dayColumn}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.max((day.count / max) * 100, day.count ? 18 : 6)}%` }]} />
              </View>
              <Text style={styles.dayLabel}>{day.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Recent quiz answers</Text>
        {quizLog.slice(0, 5).map((entry) => (
          <View key={entry.id} style={styles.quizLogRow}>
            {entry.correct ? <Check size={16} color={colors.teal} /> : <X size={16} color={colors.coral} />}
            <Text style={styles.quizLogText}>{entry.word}</Text>
          </View>
        ))}
        {!quizLog.length && <Text style={styles.mutedText}>Take a quiz to build an accuracy history.</Text>}
      </View>
    </ScrollView>
  );
}

function SettingsScreen({ user, onSaveProfile, pending, message }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [image, setImage] = useState(user?.image || "");
  const [streakGoal, setStreakGoal] = useState(String(user?.streakGoal || 7));

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setImage(user?.image || "");
    setStreakGoal(String(user?.streakGoal || 7));
  }, [user]);

  async function choosePhoto(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.screenTitle}>Settings</Text>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Profile settings</Text>

        <View style={styles.profilePhotoRow}>
          <View style={styles.profilePhotoPreview}>
            {image ? (
              <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Text style={styles.profileInitial}>{(name || email || "U").charAt(0).toUpperCase()}</Text>
            )}
          </View>
          {Platform.OS === "web" ? (
            <label style={{ cursor: "pointer" }}>
              <View style={styles.uploadButton}>
                <Text style={styles.actionButtonText}>Upload photo</Text>
              </View>
              <input accept="image/*" type="file" onChange={choosePhoto} style={{ display: "none" }} />
            </label>
          ) : (
            <TextInput
              value={image}
              onChangeText={setImage}
              placeholder="Photo URL or base64"
              placeholderTextColor={colors.muted}
              style={[styles.authInput, styles.profileInputFlex]}
            />
          )}
        </View>

        <Text style={styles.sectionLabel}>Name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.muted} style={styles.authInput} />
        <Text style={styles.sectionLabel}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          style={styles.authInput}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.sectionLabel}>New password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Leave blank to keep current password"
          placeholderTextColor={colors.muted}
          style={styles.authInput}
          secureTextEntry
        />
        <Text style={styles.sectionLabel}>Streak goal days</Text>
        <TextInput
          value={streakGoal}
          onChangeText={(value) => setStreakGoal(value.replace(/[^0-9]/g, ""))}
          placeholder="7"
          placeholderTextColor={colors.muted}
          style={styles.authInput}
          keyboardType="number-pad"
        />
        {message ? <Text style={styles.authMessage}>{message}</Text> : null}
        <ActionButton
          disabled={pending}
          onPress={() => onSaveProfile({ name, email, password, image, streakGoal: Number(streakGoal || 7) })}
        >
          {pending ? "Saving..." : "Save profile"}
        </ActionButton>
      </View>
    </ScrollView>
  );
}

function AuthScreen({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  name,
  setName,
  verificationCode,
  setVerificationCode,
  message,
  pending,
  verificationPending,
  onSubmit,
  onSendVerification
}) {
  const isRegister = mode === "register";
  const isRegisterVerify = mode === "registerVerify";
  const isReset = mode === "reset";
  const isCreatingAccount = isRegister || isRegisterVerify;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.authShell}>
        <View style={styles.authCard}>
          <Text style={styles.eyebrow}>WordMaster account</Text>
          <Text style={styles.heroTitle}>{isReset ? "Reset password" : isRegisterVerify ? "Verify email" : isRegister ? "Create account" : "Welcome back"}</Text>
          <Text style={styles.heroCopy}>
            {isReset
              ? "Enter your email, request a reset code, then choose a new password."
              : isRegisterVerify
                ? "Enter the verification code sent to your email to finish creating your account."
                : isRegister
                  ? "Enter your account details. We will send a verification code to your email."
                : "Log in with email and password to sync saved words, quiz history, and mastery progress across devices."}
          </Text>

          {isRegister && (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={colors.muted}
              style={styles.authInput}
              autoCapitalize="words"
            />
          )}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            style={styles.authInput}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isRegisterVerify}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={isReset ? "New password" : "Password"}
            placeholderTextColor={colors.muted}
            style={styles.authInput}
            secureTextEntry
            textContentType={isCreatingAccount ? "newPassword" : "password"}
            editable={!isRegisterVerify}
          />
          {(isRegisterVerify || isReset) && (
            <>
              <View style={styles.authCodeRow}>
                <TextInput
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="Verification code"
                  placeholderTextColor={colors.muted}
                  style={[styles.authInput, styles.authCodeInput]}
                  keyboardType="number-pad"
                />
                <ActionButton tone="secondary" disabled={verificationPending} onPress={onSendVerification} style={styles.authCodeButton}>
                  {verificationPending ? "Sending" : "Resend"}
                </ActionButton>
              </View>
            </>
          )}
          {message ? <Text style={styles.authMessage}>{message}</Text> : null}
          <ActionButton disabled={pending} onPress={onSubmit}>
            {pending ? "Please wait..." : isReset ? "Reset password" : isRegisterVerify ? "Verify & create account" : isRegister ? "Create account" : "Log in"}
          </ActionButton>
          <ActionButton tone="secondary" onPress={() => setMode(isCreatingAccount ? "login" : "register")}>
            {isCreatingAccount ? "Already have an account" : "Create a new account"}
          </ActionButton>
          {!isCreatingAccount && !isReset && (
            <ActionButton tone="secondary" onPress={() => setMode("reset")}>
              Forgot password?
            </ActionButton>
          )}
          {isReset && (
            <ActionButton tone="secondary" onPress={() => setMode("login")}>
              Remember password? Log in
            </ActionButton>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [words, setWords] = useState(sampleWords);
  const [savedIds, setSavedIds] = useState([]);
  const [quizLog, setQuizLog] = useState([]);
  const [activity, setActivity] = useState({});
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState("Offline ready");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authVerificationCode, setAuthVerificationCode] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAddOpen, setMenuAddOpen] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [theme, setTheme] = useState("light");
  const [flashcardWordId, setFlashcardWordId] = useState("");
  const compact = width < 380;
  appTheme = createTheme(theme);
  colors = appTheme.colors;
  styles = createStyles(appTheme);

  const stats = useMemo(() => getStats(words, quizLog, activity), [words, quizLog, activity]);

  const persistWords = useCallback(async (nextWords) => {
    setWords(nextWords);
    await writeJson(WORDS_KEY, nextWords);
  }, []);

  const recordActivity = useCallback(async () => {
    const key = todayKey();
    const next = { ...activity, [key]: (activity[key] || 0) + 1 };
    setActivity(next);
    await writeJson(ACTIVITY_KEY, next);
  }, [activity]);

  const reviewWord = useCallback(async (wordId, status) => {
    if (!token) {
      Alert.alert("Log in required", "Please log in to save progress across devices.");
      return;
    }

    const next = words.map((word) => word.id === wordId ? { ...word, status } : word);
    await persistWords(next);
    await recordActivity();

    if (API_URL) {
      fetch(`${API_URL}/words/${wordId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ status })
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(await response.text());
          const updated = await response.json();
          setWords((current) => current.map((word) => word.id === wordId ? { ...word, ...updated } : word));
        })
        .catch(() => setApiStatus("Progress saved locally; API sync failed."));
    }
  }, [persistWords, recordActivity, token, words]);

  const toggleSave = useCallback(async (wordId) => {
    if (!token) {
      Alert.alert("Log in required", "Please log in to sync saved words across devices.");
      return;
    }

    const word = words.find((item) => item.id === wordId);
    const saved = !word?.saved && !savedIds.includes(wordId);
    const nextWords = words.map((item) => item.id === wordId ? { ...item, saved } : item);
    const next = saved
      ? [...new Set([...savedIds, wordId])]
      : savedIds.filter((id) => id !== wordId);
    setWords(nextWords);
    setSavedIds(next);
    await writeJson(WORDS_KEY, nextWords);
    await writeJson(SAVED_KEY, next);
    if (API_URL) {
      fetch(`${API_URL}/words/${wordId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ saved })
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(await response.text());
          const updated = await response.json();
          setWords((current) => current.map((item) => item.id === wordId ? { ...item, ...updated } : item));
        })
        .catch(() => setApiStatus("Saved locally; MongoDB save sync failed."));
    }
  }, [savedIds, token, words]);

  const addWord = useCallback(async (draft) => {
    if (!token) {
      throw new Error("Please log in before adding words.");
    }

    const response = await fetch(`${API_URL}/words`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({
        word: draft.word,
        meaning: draft.meaning,
        bangla: draft.bangla,
        synonyms: draft.synonyms,
        antonyms: draft.antonyms,
        partOfSpeech: draft.partOfSpeech,
        pronunciation: draft.pronunciation,
        example: draft.example
      })
    });
    const added = await readApiResponse(response, "Could not add word.");
    const nextWords = [added, ...words.filter((item) => item.id !== added.id)];
    setWords(nextWords);
    await writeJson(WORDS_KEY, nextWords);
    setApiStatus("Word added to shared database");
    return added;
  }, [token, words]);

  const addQuizEntry = useCallback(async (entry) => {
    const next = [{
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      at: new Date().toISOString()
    }, ...quizLog].slice(0, 200);
    setQuizLog(next);
    await writeJson(QUIZ_KEY, next);
    await reviewWord(entry.wordId, entry.correct ? "mastered" : "learning");
  }, [quizLog, reviewWord]);

  const resetLocalData = useCallback(() => {
    Alert.alert("Reset local data?", "This clears progress, saved words, and quiz history on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          setWords(sampleWords);
          setSavedIds([]);
          setQuizLog([]);
          setActivity({});
          await writeJson(WORDS_KEY, sampleWords);
          await writeJson(SAVED_KEY, []);
          await writeJson(QUIZ_KEY, []);
          await writeJson(ACTIVITY_KEY, {});
        }
      }
    ]);
  }, []);

  const loadRemoteWords = useCallback(async (nextToken = "") => {
    const response = await fetch(`${API_URL}/words?limit=5000`, {
      headers: authHeaders(nextToken)
    });
    const data = await readApiResponse(response, "API unavailable");
    const apiWords = data.items?.length ? data.items : data;
    if (!Array.isArray(apiWords) || !apiWords.length) return;

    const normalized = apiWords.map((word, index) => ({
      id: word.id || word._id || String(index),
      word: word.word,
      partOfSpeech: word.partOfSpeech || word.pos || "",
      pronunciation: word.pronunciation || "",
      meaning: word.meaning || word.definition || "",
      synonyms: word.synonyms || [],
      antonyms: word.antonyms || [],
      example: word.example || "",
      saved: Boolean(word.saved),
      status: normalizeStatusValue(word.status),
      frequencyRank: word.frequencyRank || index + 1
    }));

    setWords(normalized);
    setSavedIds(normalized.filter((word) => word.saved).map((word) => word.id));
    await writeJson(WORDS_KEY, normalized);
    await writeJson(SAVED_KEY, normalized.filter((word) => word.saved).map((word) => word.id));
    setApiStatus(nextToken ? "Synced to your account" : "Synced from API");
  }, []);

  const submitAuth = useCallback(async () => {
    setAuthPending(true);
    setAuthMessage("");
    try {
      if (authMode === "register") {
        const response = await fetch(`${API_URL}/auth/send-verification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authEmail })
        });
        const data = await readApiResponse(response, "Could not send verification code.");
        setAuthVerificationCode("");
        setAuthMessage(data.devCode ? `${data.message} Dev code: ${data.devCode}` : data.message || "Verification code sent.");
        setAuthMode("registerVerify");
        return;
      }

      if (authMode === "reset") {
        const response = await fetch(`${API_URL}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authEmail,
            password: authPassword,
            verificationCode: authVerificationCode
          })
        });
        const data = await readApiResponse(response, "Password reset failed.");
        setAuthMessage(data.message || "Password updated. You can log in now.");
        setAuthPassword("");
        setAuthVerificationCode("");
        setAuthMode("login");
        return;
      }

      const path = authMode === "registerVerify" ? "/auth/register" : "/auth/login";
      const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          name: authName,
          verificationCode: authVerificationCode
        })
      });
      const data = await readApiResponse(response, "Authentication failed.");

      setToken(data.token);
      setUser(data.user);
      await writeJson(TOKEN_KEY, data.token);
      await writeJson(USER_KEY, data.user);
      await loadRemoteWords(data.token);
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthPending(false);
    }
  }, [authEmail, authMode, authName, authPassword, authVerificationCode, loadRemoteWords]);

  const sendAuthVerification = useCallback(async () => {
    setVerificationPending(true);
    setAuthMessage("");
    try {
      const path = authMode === "reset" ? "/auth/forgot-password" : "/auth/send-verification";
      const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail })
      });
      const data = await readApiResponse(response, "Could not send code.");
      setAuthMessage(data.devCode ? `${data.message} Dev code: ${data.devCode}` : data.message || "Code sent.");
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setVerificationPending(false);
    }
  }, [authEmail, authMode]);

  const signOut = useCallback(async () => {
    setMenuOpen(false);
    setToken("");
    setUser(null);
    setAuthPassword("");
    await writeJson(TOKEN_KEY, "");
    await writeJson(USER_KEY, null);
    setApiStatus("Signed out");
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    await writeJson(THEME_KEY, nextTheme);
  }, [theme]);

  const openFlashcard = useCallback((wordId = "") => {
    setFlashcardWordId(wordId);
    setActiveTab("flashcards");
  }, []);

  const saveProfile = useCallback(async ({ name, email, password, image }) => {
    setProfilePending(true);
    setProfileMessage("");
    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ name, email, password, image, streakGoal })
      });
      const data = await readApiResponse(response, "Profile update failed.");

      setToken(data.token);
      setUser(data.user);
      await writeJson(TOKEN_KEY, data.token);
      await writeJson(USER_KEY, data.user);
      setProfileMessage("Profile updated.");
    } catch (error) {
      setProfileMessage(error.message);
    } finally {
      setProfilePending(false);
    }
  }, [token]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const [storedWords, storedSaved, storedQuiz, storedActivity, storedToken, storedUser, storedTheme] = await Promise.all([
        readJson(WORDS_KEY, null),
        readJson(SAVED_KEY, []),
        readJson(QUIZ_KEY, []),
        readJson(ACTIVITY_KEY, {}),
        readJson(TOKEN_KEY, ""),
        readJson(USER_KEY, null),
        readJson(THEME_KEY, "light")
      ]);

      if (!mounted) return;

      setWords(storedWords?.length ? storedWords : sampleWords);
      setSavedIds(storedSaved);
      setQuizLog(storedQuiz);
      setActivity(storedActivity);
      setToken(storedToken || "");
      setUser(storedUser || null);
      setTheme(storedTheme === "dark" ? "dark" : "light");

      if (API_URL) {
        try {
          await loadRemoteWords(storedToken || "");
        } catch {
          setApiStatus("Offline ready; API not reachable");
        }
      }

      setLoading(false);
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadRemoteWords]);

  const content = {
    dashboard: (
      <Dashboard
        words={words}
        stats={stats}
        savedCount={words.filter((word) => word.saved).length || savedIds.length}
        streakGoal={Number(user?.streakGoal || 7)}
        onOpenWords={() => setActiveTab("words")}
        onOpenCards={() => openFlashcard("")}
      />
    ),
    flashcards: <Flashcards words={words} onReview={reviewWord} initialWordId={flashcardWordId} />,
    quiz: <Quiz words={words} onAnswer={addQuizEntry} />,
    words: <Words words={words} onOpenFlashcard={openFlashcard} onAddWord={addWord} />,
    stats: <Stats stats={stats} quizLog={quizLog} activity={activity} />,
    settings: (
      <SettingsScreen
        user={user}
        onSaveProfile={saveProfile}
        pending={profilePending}
        message={profileMessage}
      />
    )
  }[activeTab];

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
        <View style={styles.loadingScreen}>
          <LoadingAnimation />
          <Text style={styles.loadingText}>Loading WordMaster...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        email={authEmail}
        setEmail={setAuthEmail}
        password={authPassword}
        setPassword={setAuthPassword}
        name={authName}
        setName={setAuthName}
        verificationCode={authVerificationCode}
        setVerificationCode={setAuthVerificationCode}
        message={authMessage}
        pending={authPending}
        verificationPending={verificationPending}
        onSubmit={submitAuth}
        onSendVerification={sendAuthVerification}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      <View style={styles.appHeader}>
        <IconButton label="Open menu" onPress={() => setMenuOpen(true)}>
          <Menu size={20} color={colors.text} />
        </IconButton>
        <View>
          <Text style={styles.headerTitle}>WordMaster</Text>
          <Text style={styles.headerSubtitle}>{user?.email || apiStatus}</Text>
        </View>
        <IconButton label="Toggle theme" onPress={toggleTheme}>
          {theme === "light" ? <Moon size={20} color={colors.text} /> : <Sun size={20} color={colors.text} />}
        </IconButton>
      </View>

      {menuOpen && (
        <View style={styles.menuOverlay}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <ScrollView style={styles.sideMenu} contentContainerStyle={styles.sideMenuContent}>
            <View style={styles.menuAvatar}>
              {user?.image ? (
                <img src={user.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Text style={styles.menuAvatarInitial}>{(user?.name || user?.email || "U").charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.menuTitle}>WordMaster</Text>
            <Text style={styles.menuEmail} numberOfLines={1}>{user?.email}</Text>
            <Pressable
              style={({ pressed }) => [styles.menuItem, menuAddOpen && styles.menuItemActive, pressed && styles.pressed]}
              onPress={() => setMenuAddOpen((value) => !value)}
            >
              <Plus size={19} color={menuAddOpen ? colors.primary : colors.text} />
              <Text style={styles.menuItemText}>Add word</Text>
            </Pressable>
            {menuAddOpen && (
              <View style={styles.menuAddPanel}>
                <Text style={styles.panelCopy}>Add a word once, and it becomes available for every user.</Text>
                <AddWordForm onAddWord={addWord} />
              </View>
            )}
            <Pressable
              style={({ pressed }) => [styles.menuItem, activeTab === "settings" && styles.menuItemActive, pressed && styles.pressed]}
              onPress={() => {
                setActiveTab("settings");
                setMenuOpen(false);
              }}
            >
              <Settings size={19} color={activeTab === "settings" ? colors.primary : colors.text} />
              <Text style={styles.menuItemText}>Settings</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]} onPress={signOut}>
              <LogOut size={19} color={colors.coral} />
              <Text style={[styles.menuItemText, styles.menuDangerText]}>Logout</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      <AnimatedScreen trigger={activeTab}>
        {content}
      </AnimatedScreen>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={({ pressed }) => [styles.tabButton, active && styles.tabButtonActive, pressed && styles.pressed]}
            >
              <Icon size={compact ? 19 : 21} color={active ? colors.primary : colors.muted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  const { colors, fonts, radius } = theme;
  const textBase = {
    fontFamily: fonts.regular
  };
  const textMedium = {
    fontFamily: fonts.medium
  };
  const textBold = {
    fontFamily: fonts.bold
  };

  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg
  },
  flex: {
    flex: 1
  },
  content: {
    flex: 1
  },
  authShell: {
    flex: 1,
    justifyContent: "center",
    padding: 18
  },
  authCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 18,
    gap: 12
  },
  authInput: {
    ...textMedium,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: "700"
  },
  authMessage: {
    ...textMedium,
    color: colors.amber,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  authCodeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  authCodeInput: {
    flex: 1,
    minWidth: 140
  },
  authCodeButton: {
    minWidth: 112
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  loadingMark: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingRing: {
    position: "absolute",
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.primary
  },
  loadingCore: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: colors.primaryDark
  },
  loadingText: {
    ...textMedium,
    color: colors.muted,
    fontSize: 15,
    fontWeight: "700"
  },
  appHeader: {
    minHeight: 70,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.panel
  },
  headerSpacer: {
    width: 42,
    height: 42,
    marginLeft: "auto"
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    flexDirection: "row"
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay
  },
  sideMenu: {
    width: 276,
    maxWidth: "82%",
    height: "100%",
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: colors.panel
  },
  sideMenuContent: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10
  },
  menuAvatar: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 38,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft
  },
  menuAvatarInitial: {
    ...textBold,
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  menuTitle: {
    ...textBold,
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  menuEmail: {
    ...textMedium,
    marginBottom: 12,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  menuItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.panelSoft
  },
  menuItemActive: {
    backgroundColor: colors.activeBg
  },
  menuAddPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    padding: 10,
    gap: 10
  },
  menuItemText: {
    ...textBold,
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  menuDangerText: {
    color: colors.coral
  },
  headerTitle: {
    ...textBold,
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  headerSubtitle: {
    ...textMedium,
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  screenContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 24,
    gap: 14
  },
  eyebrow: {
    ...textBold,
    color: colors.amber,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  heroTitle: {
    ...textBold,
    color: colors.text,
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "900"
  },
  heroCopy: {
    ...textMedium,
    maxWidth: 560,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600"
  },
  screenTitle: {
    ...textBold,
    color: colors.text,
    fontSize: 25,
    fontWeight: "900"
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statTile: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 86,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14,
    justifyContent: "center"
  },
  statTileActive: {
    borderColor: colors.primary,
    backgroundColor: colors.activeBg
  },
  statValue: {
    ...textBold,
    fontSize: 28,
    fontWeight: "900"
  },
  statLabel: {
    ...textBold,
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14,
    gap: 12
  },
  metricPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14,
    gap: 10
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45,
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay
  },
  metricModal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "78%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14,
    gap: 10
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft
  },
  metricBig: {
    ...textBold,
    color: colors.text,
    fontSize: 36,
    fontWeight: "900"
  },
  goalTrack: {
    height: 10,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.panelSoft
  },
  goalFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.coral
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  panelTitle: {
    ...textBold,
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  panelMeta: {
    ...textBold,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  panelCopy: {
    ...textMedium,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600"
  },
  profileValue: {
    ...textBold,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  profilePhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  profilePhotoPreview: {
    width: 86,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 43,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft
  },
  profileInitial: {
    ...textBold,
    color: colors.text,
    fontSize: 30,
    fontWeight: "900"
  },
  uploadButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 14
  },
  profileInputFlex: {
    flex: 1
  },
  reviewItem: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    paddingHorizontal: 12
  },
  reviewItemText: {
    flex: 1,
    minWidth: 0
  },
  reviewWord: {
    ...textBold,
    color: colors.text,
    fontWeight: "900"
  },
  reviewMeaning: {
    ...textMedium,
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  dashboardActions: {
    flexDirection: "row",
    gap: 10
  },
  dashboardAction: {
    flex: 1
  },
  actionButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 14
  },
  actionButtonText: {
    ...textBold,
    color: colors.white,
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft
  },
  secondaryButtonText: {
    color: colors.text
  },
  dangerButton: {
    backgroundColor: colors.coral
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }]
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft
  },
  iconButtonActive: {
    borderColor: colors.amber,
    backgroundColor: "#3a301d"
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  flashcardShell: {
    minHeight: 330
  },
  flashcard: {
    minHeight: 330,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 22,
    justifyContent: "center",
    gap: 12
  },
  flashHint: {
    ...textBold,
    color: colors.amber,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase"
  },
  flashWord: {
    ...textBold,
    color: colors.text,
    fontSize: 38,
    lineHeight: 44,
    textAlign: "center",
    fontWeight: "900"
  },
  flashMeaning: {
    ...textBold,
    color: colors.text,
    fontSize: 20,
    lineHeight: 29,
    fontWeight: "800"
  },
  partOfSpeech: {
    ...textMedium,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  reviewRow: {
    flexDirection: "row",
    gap: 10
  },
  reviewButton: {
    flex: 1
  },
  quizPrompt: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 18,
    gap: 8
  },
  quizSpeaker: {
    marginTop: 8
  },
  answerList: {
    gap: 10
  },
  answerButton: {
    minHeight: 58,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14
  },
  answerCorrect: {
    borderColor: colors.teal,
    backgroundColor: colors.successBg
  },
  answerWrong: {
    borderColor: colors.coral,
    backgroundColor: colors.dangerBg
  },
  answerText: {
    ...textBold,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  feedback: {
    borderRadius: 8,
    padding: 14,
    gap: 8
  },
  feedbackGood: {
    backgroundColor: colors.successBg
  },
  feedbackBad: {
    backgroundColor: colors.dangerBg
  },
  feedbackTitle: {
    ...textBold,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  feedbackText: {
    ...textMedium,
    color: colors.muted,
    lineHeight: 20,
    fontWeight: "600"
  },
  feedbackButton: {
    marginTop: 6
  },
  wordsHero: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 16
  },
  wordsHeroText: {
    flex: 1,
    minWidth: 0,
    gap: 5
  },
  wordsHeroCopy: {
    ...textMedium,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  wordsHeroBadge: {
    width: 76,
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.activeBg,
    borderWidth: 1,
    borderColor: colors.primary
  },
  wordsHeroNumber: {
    ...textBold,
    color: colors.text,
    fontSize: 25,
    fontWeight: "900"
  },
  wordsHeroLabel: {
    ...textBold,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  wordSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  wordSummaryItem: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 74,
    minHeight: 66,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    paddingHorizontal: 10
  },
  wordSummaryValue: {
    ...textBold,
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  wordSummaryLabel: {
    ...textBold,
    marginTop: 3,
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  wordControls: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 12,
    gap: 12
  },
  addWordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  addWordHeaderText: {
    flex: 1,
    minWidth: 0
  },
  addWordToggle: {
    minWidth: 104
  },
  addWordForm: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12
  },
  addWordTwoColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  addWordHalfInput: {
    flex: 1,
    minWidth: 150
  },
  searchBox: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 12
  },
  searchInput: {
    ...textMedium,
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  controlGroup: {
    gap: 8
  },
  controlLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  controlLabel: {
    ...textBold,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterChip: {
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    backgroundColor: colors.panel
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.activeBg
  },
  filterText: {
    ...textBold,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  filterTextActive: {
    color: colors.text
  },
  wordList: {
    maxHeight: 280
  },
  wordListContent: {
    gap: 8,
    paddingBottom: 2
  },
  wordRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 12
  },
  wordRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.activeBg
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  wordRowText: {
    flex: 1,
    minWidth: 0
  },
  wordRowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  wordRowTitle: {
    ...textBold,
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  wordStatusPill: {
    ...textBold,
    maxWidth: 86,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  wordRowMeaning: {
    ...textMedium,
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600"
  },
  wordRowMeta: {
    ...textBold,
    marginTop: 5,
    color: colors.amber,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  detailCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14,
    gap: 10
  },
  detailTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  detailTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  detailWord: {
    ...textBold,
    color: colors.text,
    fontSize: 30,
    fontWeight: "900"
  },
  iconCluster: {
    flexDirection: "row",
    gap: 8
  },
  sectionLabel: {
    ...textBold,
    marginTop: 4,
    color: colors.amber,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  definition: {
    ...textBold,
    color: colors.text,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "800"
  },
  example: {
    ...textMedium,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    ...textBold,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: colors.successBg,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "800"
  },
  coralChip: {
    backgroundColor: colors.dangerBg
  },
  emptyPanel: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center"
  },
  mutedText: {
    ...textMedium,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  weekRow: {
    height: 148,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10
  },
  dayColumn: {
    flex: 1,
    alignItems: "center",
    gap: 8
  },
  barTrack: {
    width: "100%",
    height: 112,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: colors.panelSoft
  },
  barFill: {
    width: "100%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.primary
  },
  dayLabel: {
    ...textBold,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  quizLogRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  quizLogText: {
    ...textBold,
    color: colors.text,
    fontWeight: "800"
  },
  tabBar: {
    minHeight: 70,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: Platform.OS === "ios" ? 4 : 7,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.panel
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 8
  },
  tabButtonActive: {
    backgroundColor: colors.activeBg
  },
  tabText: {
    ...textBold,
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900"
  },
  tabTextActive: {
    color: colors.text
  }
  });
}

styles = createStyles(appTheme);
