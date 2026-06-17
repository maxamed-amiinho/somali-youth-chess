import React, { useState, useMemo, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, set, onDisconnect, onValue, serverTimestamp } from "firebase/database";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

const TABS = ["Dashboard", "Players", "Schedule", "Results", "Standings", "Tournament"];
const MANAGER_EMAIL = "amiinho@gmail.com";
const PTS = { win: 3, draw: 1, loss: 0 };
const APP_NAME = "SOMALI YOUTH CHESS";
const WA_GROUP = "https://chat.whatsapp.com/CTZsNTSWfKwD3nOV64edsM";

// === FIREBASE CONFIG ===
const firebaseConfig = {
  apiKey: "AIzaSyASxgwG5rBnVYOcmwejhpt2MpPU-eKFFic",
  authDomain: "somali-youth-chess.firebaseapp.com",
  projectId: "somali-youth-chess",
  storageBucket: "somali-youth-chess.firebasestorage.app",
  messagingSenderId: "974928971847",
  appId: "1:974928971847:web:38087c93042fc41f050962",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const rtdb = getDatabase(firebaseApp);

// Single shared document holding all club data
const CLUB_DOC = doc(db, "chessClub", "data");

// Live chess games are stored in Realtime Database (not Firestore) because
// RTDB has lower latency for fast-changing data like move-by-move updates.
const liveGameRef = (matchId) => ref(rtdb, `liveGames/${matchId}`);

// === ELO RATING ===
const DEFAULT_ELO = 1200;
const K_FACTOR = 32;
function calcElo(ratingA, ratingB, resultA) {
  // resultA: 1 = win, 0.5 = draw, 0 = loss
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const newA = Math.round(ratingA + K_FACTOR * (resultA - expectedA));
  const newB = Math.round(ratingB + K_FACTOR * ((1 - resultA) - (1 - expectedA)));
  return { newA, newB };
}

// === THEME PALETTES ===
const THEMES = {
  dark: {
    bg: "#0f1117",
    bgCard: "#1a1f2e",
    bgInput: "#0f1117",
    border: "#2a2f3e",
    border2: "#1a1f2e",
    text: "#e8e6e0",
    textBright: "#fff",
    textMuted: "#6b7280",
    textMuted2: "#9ca3af",
    gold: "#f0c040",
    headerGrad: "linear-gradient(135deg,#1a1f2e 0%,#0f1117 100%)",
  },
  light: {
    bg: "#f4f5f7",
    bgCard: "#ffffff",
    bgInput: "#f4f5f7",
    border: "#e2e4ea",
    border2: "#eef0f4",
    text: "#1f2430",
    textBright: "#0f1117",
    textMuted: "#6b7280",
    textMuted2: "#4b5563",
    gold: "#b8860b",
    headerGrad: "linear-gradient(135deg,#ffffff 0%,#f4f5f7 100%)",
  },
};


function Avatar({ name, size = 36, photo }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (photo) {
    return (
      <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `hsl(${hue},55%,38%)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.38, flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }}>{initials}</div>
  );
}

function Badge({ text, color }) {
  return <span style={{ background: color, color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{text}</span>;
}

// Shows last N results (W/D/L) as small colored circles, most recent on the right
function FormBadges({ form, size = 22 }) {
  if (!form || form.length === 0) return <span style={{ color: "#6b7280", fontSize: 11 }}>No matches yet</span>;
  const colors = { W: "#22c55e", D: "#f0c040", L: "#ef4444" };
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {form.map((r, i) => (
        <div key={i} style={{
          width: size, height: size, borderRadius: "50%", background: colors[r],
          color: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: size * 0.5, flexShrink: 0
        }}>{r}</div>
      ))}
    </div>
  );
}

function Notification({ notif, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, []);
  const colors = { start: { bg: "#1a3a2a", border: "#22c55e", icon: "🟢" }, end: { bg: "#2a1a0a", border: "#f0c040", icon: "🏁" }, info: { bg: "#1a1f2e", border: "#3b82f6", icon: "♟️" } };
  const c = colors[notif.type] || colors.info;
  return (
    <div style={{ position: "fixed", top: 20, right: 20, left: 20, zIndex: 9999, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "slideIn 0.3s ease" }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{c.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: "#fff", fontSize: 14, marginBottom: 2 }}>{notif.title}</div>
        <div style={{ color: "#9ca3af", fontSize: 12 }}>{notif.body}</div>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
    </div>
  );
}

// Resize an uploaded image file down to a small square JPEG data URL,
// keeping the stored player photo small enough for Firestore documents.
function resizeImageToDataUrl(file, maxSize = 128, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Crop to a centered square, then scale to maxSize x maxSize
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      onLogin("manager");
    } catch (err) {
      setError("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };
  const s = {
    wrap: { minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter','Segoe UI',sans-serif" },
    box: { background: "#1a1f2e", border: "1px solid #2a2f3e", borderRadius: 16, padding: 36, width: "100%", maxWidth: 380 },
    label: { fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, display: "block" },
    input: { width: "100%", background: "#0f1117", border: "1px solid #2a2f3e", borderRadius: 8, padding: "11px 12px", color: "#e8e6e0", fontSize: 14, outline: "none", boxSizing: "border-box" },
    btn: { width: "100%", background: "#f0c040", color: "#0f1117", border: "none", borderRadius: 8, padding: "12px", fontWeight: 800, fontSize: 14, cursor: "pointer", marginTop: 20 },
    error: { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginTop: 14 },
    line: { flex: 1, height: 1, background: "#2a2f3e" },
    viewerBtn: { width: "100%", background: "transparent", color: "#6b7280", border: "1px solid #2a2f3e", borderRadius: 8, padding: "11px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  };
  return (
    <div style={s.wrap}>
      <div style={s.box}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44 }}>♟️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>{APP_NAME}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Manager Login</div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" placeholder="Enter your email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} />
        </div>
        <div style={{ marginBottom: 4 }}>
          <label style={s.label}>Password</label>
          <div style={{ position: "relative" }}>
            <input style={{ ...s.input, paddingRight: 40 }} type={showPass ? "text" : "password"} placeholder="Enter your password" value={pass} onChange={e => { setPass(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <button style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 16 }} onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁️"}</button>
          </div>
        </div>
        {error && <div style={s.error}>⚠️ {error}</div>}
        <button style={s.btn} onClick={handleLogin} disabled={loading}>{loading ? "Logging in..." : "Login as Manager"}</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", color: "#374151", fontSize: 12 }}>
          <div style={s.line} /><span>or</span><div style={s.line} />
        </div>
        <button style={s.viewerBtn} onClick={() => onLogin("viewer")}>👀 Continue as Viewer (View Only)</button>
      </div>
    </div>
  );
}

// Draw standings card to canvas and share as image
function useStandingsImage(standings, seasonName) {
  const canvasRef = useRef(null);

  const generateImage = () => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const W = 520, ROW = 48, HEADER = 130, FOOTER = 60;
      canvas.width = W;
      canvas.height = HEADER + standings.length * ROW + FOOTER;
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#0f1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Top gold border
      ctx.fillStyle = "#f0c040";
      ctx.fillRect(0, 0, W, 4);

      // Title
      ctx.fillStyle = "#f0c040";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("♟ " + APP_NAME, W / 2, 38);

      ctx.fillStyle = "#6b7280";
      ctx.font = "13px Arial";
      ctx.fillText((seasonName ? seasonName.toUpperCase() + " — " : "") + "STANDINGS", W / 2, 60);

      // Points legend
      ctx.font = "11px Arial";
      ctx.fillStyle = "#22c55e"; ctx.fillText("Win=" + PTS.win + "pts", W/2 - 80, 82);
      ctx.fillStyle = "#f0c040"; ctx.fillText("Draw=" + PTS.draw + "pt", W/2, 82);
      ctx.fillStyle = "#ef4444"; ctx.fillText("Loss=" + PTS.loss + "pts", W/2 + 80, 82);

      // Divider
      ctx.strokeStyle = "#2a2f3e";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(20, 96); ctx.lineTo(W - 20, 96); ctx.stroke();

      // Column headers
      ctx.fillStyle = "#6b7280";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "left";
      const cols = [30, 70, 340, 380, 420, 468];
      ["#", "PLAYER", "W", "D", "L", "PTS"].forEach((h, i) => {
        ctx.textAlign = i === 1 ? "left" : "center";
        ctx.fillText(h, cols[i], 118);
      });

      // Rows
      standings.forEach((p, i) => {
        const y = HEADER + i * ROW;
        // Row bg
        ctx.fillStyle = i === 0 ? "rgba(240,192,64,0.08)" : i % 2 === 0 ? "#13161f" : "#0f1117";
        ctx.fillRect(0, y, W, ROW);

        const cy = y + ROW / 2 + 5;
        const medals = ["🥇", "🥈", "🥉"];

        // Rank
        ctx.fillStyle = i === 0 ? "#f0c040" : "#6b7280";
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.fillText(i < 3 ? medals[i] : String(i + 1), cols[0], cy);

        // Name
        ctx.fillStyle = "#ffffff";
        ctx.font = i === 0 ? "bold 14px Arial" : "13px Arial";
        ctx.textAlign = "left";
        ctx.fillText(p.name, cols[1], cy);

        // W D L Pts
        ctx.textAlign = "center";
        ctx.fillStyle = "#22c55e"; ctx.font = "13px Arial"; ctx.fillText(p.w, cols[2], cy);
        ctx.fillStyle = "#f0c040"; ctx.fillText(p.d, cols[3], cy);
        ctx.fillStyle = "#ef4444"; ctx.fillText(p.l, cols[4], cy);
        ctx.fillStyle = i === 0 ? "#f0c040" : "#e8e6e0";
        ctx.font = "bold 14px Arial";
        ctx.fillText(p.pts, cols[5], cy);

        // Row divider
        ctx.strokeStyle = "#1e2435";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y + ROW); ctx.lineTo(W, y + ROW); ctx.stroke();
      });

      // Footer
      const fy = HEADER + standings.length * ROW + 20;
      ctx.fillStyle = "#374151";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Generated by " + APP_NAME + " • " + new Date().toLocaleDateString(), W / 2, fy);

      // Bottom gold border
      ctx.fillStyle = "#f0c040";
      ctx.fillRect(0, canvas.height - 4, W, 4);

      resolve(canvas.toDataURL("image/png"));
    });
  };

  const downloadAndShare = async () => {
    const dataUrl = await generateImage();

    // Try programmatic download first
    try {
      const link = document.createElement("a");
      link.download = "somali-youth-chess-standings.png";
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      // ignore
    }

    // Return the image so it can be shown in an in-app modal as a fallback
    return dataUrl;
  };

  return { downloadAndShare };
}

// Live chess board shown when a match is started. Reads/writes moves directly
// to Realtime Database (liveGames/{matchId}) so all open devices stay in sync instantly.
function LiveBoard({ matchId, match, myColor, onClose, T, getPlayerPhoto, onCheckmate }) {
  const [game, setGame] = useState(null);

  useEffect(() => {
    const gref = liveGameRef(matchId);
    const unsub = onValue(gref, (snap) => {
      setGame(snap.val());
    });
    return () => unsub();
  }, [matchId]);

  if (!game) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
        Loading live game...
      </div>
    );
  }

  const chess = new Chess(game.fen);
  const isMyTurn = (myColor === "white" && chess.turn() === "w") || (myColor === "black" && chess.turn() === "b");
  const canMove = isMyTurn && game.status === "playing";

  const handleDrop = (from, to) => {
    if (!canMove) return false;
    try {
      const next = new Chess(game.fen);
      const result = next.move({ from, to, promotion: "q" });
      if (!result) return false;
      const isOver = next.isGameOver();
      const isMate = next.isCheckmate();
      const update = {
        fen: next.fen(),
        moves: [...(game.moves || []), result.san],
        status: isOver ? "ended" : "playing",
        isCheckmate: isMate,
        updatedAt: Date.now(),
      };
      set(liveGameRef(matchId), update);
      if (isMate) {
        const winnerColor = next.turn() === "w" ? "black" : "white"; // side that just moved won
        onCheckmate && onCheckmate(matchId, winnerColor);
      }
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 12, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, color: "#fff", fontSize: 14, display: "flex", alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginRight: 6, animation: "pulse 1.5s infinite" }} />
            Live Match
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: "8px 12px", background: "#1a1f2e", borderRadius: 8 }}>
          <Avatar name={match.blackName} size={28} photo={getPlayerPhoto(match.blackId)} />
          <span style={{ color: "#fff", fontWeight: 600, flex: 1 }}>{match.blackName} ⬛</span>
          {game.status === "playing" && chess.turn() === "b" && <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>● To move</span>}
        </div>

        <Chessboard
          position={game.fen}
          onPieceDrop={handleDrop}
          boardOrientation={myColor === "black" ? "black" : "white"}
          arePiecesDraggable={canMove}
          customBoardStyle={{ borderRadius: 6, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "8px 12px", background: "#1a1f2e", borderRadius: 8 }}>
          <Avatar name={match.whiteName} size={28} photo={getPlayerPhoto(match.whiteId)} />
          <span style={{ color: "#fff", fontWeight: 600, flex: 1 }}>{match.whiteName} ⬜</span>
          {game.status === "playing" && chess.turn() === "w" && <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>● To move</span>}
        </div>

        {game.status === "ended" && (
          <div style={{ textAlign: "center", color: "#f0c040", fontWeight: 800, fontSize: 15, margin: "10px 0", padding: 12, background: "rgba(240,192,64,0.1)", borderRadius: 8 }}>
            {game.isCheckmate ? `♟️ Checkmate! ${chess.turn() === "w" ? match.blackName : match.whiteName} wins!` : "Game over!"}
          </div>
        )}

        {game.status === "playing" && (
          <div style={{ textAlign: "center", fontSize: 12, color: canMove ? "#22c55e" : "#6b7280", fontWeight: 600, margin: "8px 0" }}>
            {myColor === "spectator" ? "👀 Watching..." : canMove ? "✅ Your turn — drag a piece to move" : "⏳ Waiting for opponent..."}
          </div>
        )}

        <div style={{ marginTop: 8, padding: "8px 12px", background: "#1a1f2e", borderRadius: 8, fontSize: 11, color: "#9ca3af", maxHeight: 52, overflowY: "auto", lineHeight: 1.8 }}>
          {(!game.moves || game.moves.length === 0) ? "No moves yet — game just started" :
            game.moves.map((mv, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${mv}` : mv)).join("  ")}
        </div>
      </div>
    </div>
  );
}

export default function ChessClub() {
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState("Dashboard");
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);
  const [activity, setActivity] = useState([]);
  const [notif, setNotif] = useState(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("syc_theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });
  const [seasons, setSeasons] = useState([]); // [{ id, name, endedAt, standings, activity }]
  const [currentSeasonName, setCurrentSeasonName] = useState("Season 1");
  const [showEndSeasonConfirm, setShowEndSeasonConfirm] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [nextSeasonName, setNextSeasonName] = useState("");
  const [tournament, setTournament] = useState(null);
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentSelected, setTournamentSelected] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnTitle, setNewAnnTitle] = useState("");
  const [newAnnMsg, setNewAnnMsg] = useState("");
  const [onlineUsers, setOnlineUsers] = useState({});
  const [currentUserName, setCurrentUserName] = useState("");
  const [dbLoaded, setDbLoaded] = useState(false);
  const [dbError, setDbError] = useState(null);
  const isLocalUpdate = useRef(false);

  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pLevel, setPLevel] = useState("Intermediate");
  const [pPhoto, setPPhoto] = useState(null);
  const [mWhite, setMWhite] = useState("");
  const [mBlack, setMBlack] = useState("");
  const [mDate, setMDate] = useState("");
  const [mTime, setMTime] = useState("");
  const [rMatch, setRMatch] = useState("");
  const [rWinner, setRWinner] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLevel, setEditLevel] = useState("Intermediate");
  const [editPhoto, setEditPhoto] = useState(null);
  const [watchingMatch, setWatchingMatch] = useState(null);
  const [myColor, setMyColor] = useState(null);
  const [colorPickMatch, setColorPickMatch] = useState(null);

  const isManager = role === "manager";

  const showNotif = (type, title, body) => setNotif({ type, title, body, id: Date.now() });

  // === FIREBASE AUTH: Restore manager session on page reload ===
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === MANAGER_EMAIL) {
        setRole((prev) => prev || "manager");
      }
    });
    return () => unsubscribe();
  }, []);

  // Persist theme preference locally (per-device UI preference)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("syc_theme", theme);
    }
  }, [theme]);

  // === ONLINE PRESENCE (Realtime Database) ===
  useEffect(() => {
    if (!role) return;
    const uid = auth.currentUser ? auth.currentUser.uid : `viewer_${Date.now()}`;
    const name = role === "manager" ? "👑 Manager" : (currentUserName || "Visitor");
    const presenceRef = ref(rtdb, `presence/${uid}`);
    const connectedRef = ref(rtdb, ".info/connected");

    const unsub = onValue(connectedRef, (snap) => {
      if (snap.val()) {
        set(presenceRef, { name, role, online: true, lastSeen: serverTimestamp() });
        onDisconnect(presenceRef).set({ name, role, online: false, lastSeen: serverTimestamp() });
      }
    });

    const onlineRef = ref(rtdb, "presence");
    const unsubOnline = onValue(onlineRef, (snap) => {
      setOnlineUsers(snap.val() || {});
    });

    return () => { unsub(); unsubOnline(); set(presenceRef, { name, role, online: false, lastSeen: serverTimestamp() }); };
  }, [role, currentUserName]);

  // === FIRESTORE: Real-time sync ===
  // Subscribe once to the shared club document. Any change made here (by any user/device)
  // updates Firestore, and Firestore pushes the new data back to everyone in real time.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      CLUB_DOC,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          isLocalUpdate.current = true;
          setPlayers(data.players || []);
          setMatches(data.matches || []);
          setResults(data.results || []);
          setActivity(data.activity || []);
          setSeasons(data.seasons || []);
          setCurrentSeasonName(data.currentSeasonName || "Season 1");
          setTournament(data.tournament || null);
          setAnnouncements(data.announcements || []);
        }
        setDbLoaded(true);
        setDbError(null);
      },
      (err) => {
        console.error("Firestore error:", err);
        setDbError(err.message);
        setDbLoaded(true); // allow app to continue with empty/local data
      }
    );
    return () => unsubscribe();
  }, []);

  // Whenever players/matches/results/activity/seasons change locally, save to Firestore
  // (skip the very first sync that came FROM Firestore to avoid an extra write loop)
  useEffect(() => {
    if (!dbLoaded) return;
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }
    setDoc(CLUB_DOC, { players, matches, results, activity, seasons, currentSeasonName, tournament, announcements, updatedAt: Date.now() }).catch((err) => {
      console.error("Firestore save error:", err);
      setDbError(err.message);
    });
  }, [players, matches, results, activity, seasons, currentSeasonName, tournament, announcements, dbLoaded]);

  const standings = useMemo(() => {
    const map = {};
    players.forEach(p => { map[p.id] = { id: p.id, name: p.name, w: 0, d: 0, l: 0, pts: 0, elo: p.elo || DEFAULT_ELO }; });
    results.forEach(r => {
      const match = matches.find(m => m.id === r.matchId);
      if (!match) return;
      const wId = match.whiteId, bId = match.blackId;
      if (!map[wId] || !map[bId]) return;
      if (r.winner === "white") { map[wId].w++; map[wId].pts += PTS.win; map[bId].l++; }
      else if (r.winner === "black") { map[bId].w++; map[bId].pts += PTS.win; map[wId].l++; }
      else { map[wId].d++; map[wId].pts += PTS.draw; map[bId].d++; map[bId].pts += PTS.draw; }
    });
    return Object.values(map).sort((a, b) => b.pts - a.pts);
  }, [players, matches, results]);

  const { downloadAndShare } = useStandingsImage(standings, currentSeasonName);

  // Per-player chronological match history with results, used for Form Guide & H2H
  const playerHistory = useMemo(() => {
    const map = {};
    players.forEach(p => { map[p.id] = []; });
    // results stored in chronological order (order added)
    results.forEach(r => {
      const match = matches.find(m => m.id === r.matchId);
      if (!match) return;
      const wId = match.whiteId, bId = match.blackId;
      if (!map[wId] || !map[bId]) return;

      let wRes, bRes;
      if (r.winner === "white") { wRes = "W"; bRes = "L"; }
      else if (r.winner === "black") { wRes = "L"; bRes = "W"; }
      else { wRes = "D"; bRes = "D"; }

      map[wId].push({ matchId: match.id, opponentId: bId, opponentName: match.blackName, result: wRes, date: match.date, color: "white" });
      map[bId].push({ matchId: match.id, opponentId: wId, opponentName: match.whiteName, result: bRes, date: match.date, color: "black" });
    });
    return map;
  }, [players, matches, results]);

  const getForm = (playerId, count = 5) => {
    const hist = playerHistory[playerId] || [];
    return hist.slice(-count).map(h => h.result);
  };

  const getHeadToHead = (playerAId, playerBId) => {
    const hist = playerHistory[playerAId] || [];
    const relevant = hist.filter(h => h.opponentId === playerBId);
    const summary = { aWins: 0, draws: 0, bWins: 0, games: relevant.length };
    relevant.forEach(h => {
      if (h.result === "W") summary.aWins++;
      else if (h.result === "L") summary.bWins++;
      else summary.draws++;
    });
    return { summary, matches: relevant };
  };

  const getPlayerPhoto = (playerId) => {
    const p = players.find(pl => pl.id === playerId);
    return p ? p.photo : undefined;
  };


  const [imgModal, setImgModal] = useState(null);

  const sendWA = (phone, message) => {
    const encoded = encodeURIComponent(message);
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const logActivity = (icon, text) => {
    setActivity(prev => [...prev, { id: Date.now(), icon, text, ts: Date.now() }].slice(-50));
  };

  const addPlayer = () => {
    if (!pName.trim()) return;
    const player = { id: Date.now(), name: pName.trim(), phone: pPhone.trim(), level: pLevel, photo: pPhoto || null };
    setPlayers(p => [...p, player]);
    setPName(""); setPPhone(""); setPLevel("Intermediate"); setPPhoto(null);
    showNotif("info", "New Player Added!", `${player.name} joined as ${player.level}`);
    logActivity("👤", `${player.name} joined the club as ${player.level}`);
  };

  const startEditPlayer = (player) => {
    setEditName(player.name);
    setEditPhone(player.phone || "");
    setEditLevel(player.level);
    setEditPhoto(player.photo || null);
    setEditingPlayer(true);
  };

  const saveEditPlayer = (playerId) => {
    if (!editName.trim()) return;
    const oldPlayer = players.find(p => p.id === playerId);
    const levelChanged = oldPlayer && oldPlayer.level !== editLevel;
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, name: editName.trim(), phone: editPhone.trim(), level: editLevel, photo: editPhoto || null } : p));
    setEditingPlayer(false);
    if (levelChanged) {
      showNotif("info", "Player Updated!", `${editName.trim()} is now ${editLevel} (was ${oldPlayer.level})`);
      logActivity("⬆️", `${editName.trim()} leveled up from ${oldPlayer.level} to ${editLevel}`);
    } else {
      showNotif("info", "Player Updated!", `${editName.trim()}'s info was updated`);
      logActivity("✏️", `${editName.trim()}'s profile was updated`);
    }
  };

  const deletePlayer = (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    setPlayers(prev => prev.filter(p => p.id !== playerId));
    // Also remove any matches and results involving this player
    const affectedMatchIds = matches.filter(m => m.whiteId === playerId || m.blackId === playerId).map(m => m.id);
    setMatches(prev => prev.filter(m => m.whiteId !== playerId && m.blackId !== playerId));
    setResults(prev => prev.filter(r => !affectedMatchIds.includes(r.matchId)));
    setSelectedPlayer(null);
    setEditingPlayer(false);
    showNotif("info", "Player Removed", `${player.name} has been removed from the club.`);
    logActivity("🗑️", `${player.name} was removed from the club`);
  };

  const cancelMatch = (matchId) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setResults(prev => prev.filter(r => r.matchId !== matchId));
    showNotif("info", "Match Cancelled", `${match.whiteName} vs ${match.blackName} has been cancelled.`);
    logActivity("❌", `Match cancelled: ${match.whiteName} vs ${match.blackName}`);
  };

  const addMatch = () => {
    if (!mWhite || !mBlack || !mDate) return;
    const w = players.find(p => p.id === +mWhite);
    const b = players.find(p => p.id === +mBlack);
    const match = { id: Date.now(), whiteId: +mWhite, blackId: +mBlack, date: mDate, time: mTime, whiteName: w.name, blackName: b.name, started: false };
    setMatches(m => [...m, match]);
    setMWhite(""); setMBlack(""); setMDate(""); setMTime("");
    showNotif("info", "Match Scheduled!", `${w.name} vs ${b.name} on ${mDate}`);
    logActivity("📅", `Match scheduled: ${w.name} vs ${b.name} on ${mDate}`);
  };

  const startMatch = (matchId) => {
    const match = matches.find(m => m.id === matchId);
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, started: true } : m));
    // Create the live game board in Realtime Database so players/spectators can watch moves live
    const fresh = new Chess();
    set(liveGameRef(matchId), { fen: fresh.fen(), moves: [], status: "playing", updatedAt: Date.now() }).catch((err) => {
      console.error("Failed to start live game:", err);
    });
    showNotif("start", "🟢 Match Started!", `${match.whiteName} vs ${match.blackName} — Game is live!`);
    logActivity("🟢", `Match started: ${match.whiteName} vs ${match.blackName}`);
  };

  // Called by LiveBoard when a checkmate happens, so the manager can quickly confirm the result
  const handleLiveCheckmate = (matchId, winnerColor) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    showNotif("end", "♟️ Checkmate!", `${winnerColor === "white" ? match.whiteName : match.blackName} won by checkmate! Manager: confirm the result in the Results tab.`);
  };

  const addResult = () => {
    if (!rMatch || !rWinner) return;
    const match = matches.find(m => m.id === +rMatch);
    if (!match) return;
    setResults(r => [...r, { matchId: +rMatch, winner: rWinner }]);

    // === ELO UPDATE ===
    const wPlayer = players.find(p => p.id === match.whiteId);
    const bPlayer = players.find(p => p.id === match.blackId);
    if (wPlayer && bPlayer) {
      const wElo = wPlayer.elo || DEFAULT_ELO;
      const bElo = bPlayer.elo || DEFAULT_ELO;
      const resultA = rWinner === "white" ? 1 : rWinner === "black" ? 0 : 0.5;
      const { newA, newB } = calcElo(wElo, bElo, resultA);
      setPlayers(prev => prev.map(p => {
        if (p.id === match.whiteId) return { ...p, elo: newA };
        if (p.id === match.blackId) return { ...p, elo: newB };
        return p;
      }));
    }

    setRMatch(""); setRWinner("");
    // Clean up the live game data now that the match is officially over
    set(liveGameRef(match.id), null).catch(() => {});
    const winnerName = rWinner === "white" ? match.whiteName : rWinner === "black" ? match.blackName : null;
    showNotif("end", "🏁 Match Finished!", `${match.whiteName} vs ${match.blackName} — ${winnerName ? winnerName + " wins!" : "Draw!"}`);
    logActivity("🏁", winnerName ? `${winnerName} won vs ${winnerName === match.whiteName ? match.blackName : match.whiteName}` : `${match.whiteName} vs ${match.blackName} ended in a draw`);
  };

  // === ANNOUNCEMENTS ===
  const addAnnouncement = () => {
    if (!newAnnTitle.trim()) return;
    const ann = { id: Date.now(), title: newAnnTitle.trim(), message: newAnnMsg.trim(), ts: Date.now() };
    setAnnouncements(prev => [ann, ...prev]);
    setNewAnnTitle(""); setNewAnnMsg("");
    showNotif("info", "📢 Announcement Posted!", ann.title);
    logActivity("📢", `Announcement: ${ann.title}`);
  };

  const deleteAnnouncement = (id) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  // === BEST WINNING STREAK ===
  const getBestStreak = (playerId) => {
    const hist = playerHistory[playerId] || [];
    let best = 0, current = 0;
    hist.forEach(h => {
      if (h.result === "W") { current++; best = Math.max(best, current); }
      else current = 0;
    });
    return best;
  };

  const getCurrentStreak = (playerId) => {
    const hist = playerHistory[playerId] || [];
    let streak = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].result === "W") streak++;
      else break;
    }
    return streak;
  };

  // Archive the current season's standings, then reset matches/results for a fresh season.
  // Players and their photos/levels carry over unchanged.
  const endSeason = () => {
    if (standings.length === 0) return;
    const champion = standings[0];
    const seasonRecord = {
      id: Date.now(),
      name: currentSeasonName,
      endedAt: Date.now(),
      standings: standings.map(p => ({ id: p.id, name: p.name, w: p.w, d: p.d, l: p.l, pts: p.pts })),
      champion: { id: champion.id, name: champion.name, pts: champion.pts },
    };
    setSeasons(prev => [...prev, seasonRecord]);
    setMatches([]);
    setResults([]);
    const newName = nextSeasonName.trim() || `Season ${seasons.length + 2}`;
    setCurrentSeasonName(newName);
    setNextSeasonName("");
    setShowEndSeasonConfirm(false);
    showNotif("end", "🏆 Season Ended!", `${champion.name} won ${seasonRecord.name} with ${champion.pts} pts! ${newName} has begun.`);
    logActivity("🏆", `${seasonRecord.name} ended — Champion: ${champion.name} (${champion.pts} pts). ${newName} begins!`);
  };

  // === TOURNAMENT BRACKET ===
  const getRoundName = (matchCount) => {
    switch (matchCount) {
      case 1: return "🏆 Final";
      case 2: return "Semi-Finals";
      case 4: return "Quarter-Finals";
      case 8: return "Round of 16";
      case 16: return "Round of 32";
      default: return "Group Stage";
    }
  };

  const startTournament = () => {
    if (tournamentSelected.length < 2) return;
    const chosen = players.filter(p => tournamentSelected.includes(p.id));
    const shuffled = [...chosen];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const round1 = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1] || null;
      round1.push({ id: `r0m${i / 2}`, p1: { id: p1.id, name: p1.name, photo: p1.photo || null }, p2: p2 ? { id: p2.id, name: p2.name, photo: p2.photo || null } : null, winner: p2 ? null : "p1" });
    }
    setTournament({ id: Date.now(), name: tournamentName.trim() || "Friendly Knockout", rounds: [round1], champion: null });
    setTournamentName("");
    setTournamentSelected([]);
    showNotif("info", "🎉 Tournament Started!", `${chosen.length} players`);
    logActivity("🎉", `Tournament started: ${tournamentName.trim() || "Friendly Knockout"} (${chosen.length} players)`);
  };

  const setBracketWinner = (roundIdx, matchIdx, winnerKey) => {
    setTournament(prev => {
      if (!prev) return prev;
      const rounds = prev.rounds.map(r => r.map(m => ({ ...m })));
      rounds[roundIdx][matchIdx].winner = winnerKey;
      const round = rounds[roundIdx];
      const allDecided = round.every(m => m.winner);
      let champion = prev.champion;
      if (allDecided) {
        const winners = round.map(m => m.winner === "p1" ? m.p1 : m.p2);
        if (winners.length === 1) {
          champion = winners[0];
        } else if (!rounds[roundIdx + 1]) {
          const nextRound = [];
          for (let i = 0; i < winners.length; i += 2) {
            const p1 = winners[i];
            const p2 = winners[i + 1] || null;
            nextRound.push({ id: `r${roundIdx + 1}m${i / 2}`, p1, p2, winner: p2 ? null : "p1" });
          }
          rounds.push(nextRound);
          if (nextRound.length === 1 && nextRound[0].winner) {
            champion = nextRound[0].winner === "p1" ? nextRound[0].p1 : nextRound[0].p2;
          }
        }
      }
      const updated = { ...prev, rounds, champion };
      if (champion && !prev.champion) {
        showNotif("end", "🏆 Tournament Champion!", `${champion.name} won ${prev.name}!`);
        logActivity("🏆", `${champion.name} won the tournament "${prev.name}"!`);
      }
      return updated;
    });
  };

  const endTournament = () => { setTournament(null); setTournamentSelected([]); setTournamentName(""); };

  if (!role) return <LoginScreen onLogin={setRole} />;

  const pendingMatches = matches.filter(m => !results.find(r => r.matchId === m.id));
  const startedMatches = pendingMatches.filter(m => m.started);
  const notStartedMatches = pendingMatches.filter(m => !m.started);

  const T = THEMES[theme];
  const s = {
    app: { minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter','Segoe UI',sans-serif" },
    header: { background: T.headerGrad, borderBottom: `1px solid ${T.border}`, padding: "16px 20px 0" },
    topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    appTitle: { fontSize: 15, fontWeight: 800, color: T.gold, letterSpacing: 1 },
    roleBadge: { background: isManager ? "rgba(240,192,64,0.15)" : "rgba(107,114,128,0.2)", color: isManager ? T.gold : T.textMuted2, border: `1px solid ${isManager ? "rgba(240,192,64,0.3)" : T.border}`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 },
    logoutBtn: { background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textMuted, fontSize: 11, padding: "4px 10px", cursor: "pointer", marginLeft: 8 },
    themeBtn: { background: "none", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textMuted, fontSize: 13, padding: "4px 8px", cursor: "pointer", marginLeft: 8 },
    tabs: { display: "flex", gap: 4, overflowX: "auto" },
    tab: (active) => ({ padding: "10px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, borderRadius: "8px 8px 0 0", transition: "all 0.15s", background: active ? T.bgCard : "transparent", color: active ? T.gold : T.textMuted, borderBottom: active ? `2px solid ${T.gold}` : "2px solid transparent", whiteSpace: "nowrap" }),
    body: { padding: 20, maxWidth: 640, margin: "0 auto" },
    card: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 16 },
    card2: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 8px", textAlign: "center" },
    viewerBanner: { background: "rgba(107,114,128,0.1)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.textMuted2 },
    ptsBanner: { background: "rgba(240,192,64,0.08)", border: "1px solid rgba(240,192,64,0.2)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, fontSize: 12, flexWrap: "wrap" },
    label: { fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, display: "block" },
    input: { width: "100%", background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    select: { width: "100%", background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    btn: (color) => { const c = color || T.gold; return { background: c, color: c === T.gold ? "#0f1117" : "#fff", border: "none", borderRadius: 8, padding: "11px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", marginTop: 12 }; },
    startBtn: { background: "#22c55e", color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontWeight: 700, fontSize: 11, cursor: "pointer" },
    waBtn: { background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
    playerRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` },
    sectionTitle: { fontSize: 16, fontWeight: 700, color: T.textBright, marginBottom: 16 },
    th: { padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: 1, textTransform: "uppercase", borderBottom: `1px solid ${T.border}` },
    td: { padding: "12px 12px", fontSize: 13, borderBottom: `1px solid ${T.border2}` },
    empty: { textAlign: "center", color: T.textMuted, padding: 32, fontSize: 13 },
    liveDot: { width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginRight: 6, animation: "pulse 1.5s infinite" },
  };

  return (
    <div style={s.app}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      {notif && <Notification key={notif.id} notif={notif} onClose={() => setNotif(null)} />}

      {imgModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setImgModal(null)}>
          <img src={imgModal} alt="Standings" style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: 8, border: "1px solid #2a2f3e" }} onClick={e => e.stopPropagation()} />
          <div style={{ marginTop: 16, color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
            Taabo oo hayso sawirka si aad u kaydiso, ka dibna isaga xidh.
          </div>
          <button style={{ marginTop: 12, background: "#f0c040", color: "#0f1117", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 13, cursor: "pointer" }} onClick={() => setImgModal(null)}>Close</button>
        </div>
      )}

      {/* Pick which side you are before watching/playing a live match */}
      {colorPickMatch && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setColorPickMatch(null)}>
          <div style={{ background: T.bgCard, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, color: T.textBright, fontSize: 16, marginBottom: 16, textAlign: "center" }}>Who are you in this match?</div>
            {[
              { label: `⬜ I am ${colorPickMatch.whiteName} (White)`, color: "white" },
              { label: `⬛ I am ${colorPickMatch.blackName} (Black)`, color: "black" },
              { label: "👀 Just watching", color: "spectator" },
            ].map(opt => (
              <button key={opt.color} onClick={() => { setMyColor(opt.color); setWatchingMatch(colorPickMatch.id); setColorPickMatch(null); }}
                style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 10, textAlign: "left" }}>
                {opt.label}
              </button>
            ))}
            <button onClick={() => setColorPickMatch(null)} style={{ width: "100%", background: "none", border: "none", color: T.textMuted, fontSize: 12, cursor: "pointer", marginTop: 4 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Live board overlay */}
      {watchingMatch && (() => {
        const m = matches.find(x => x.id === watchingMatch);
        if (!m) return null;
        return (
          <LiveBoard
            matchId={watchingMatch}
            match={m}
            myColor={myColor}
            onClose={() => { setWatchingMatch(null); setMyColor(null); }}
            T={T}
            getPlayerPhoto={getPlayerPhoto}
            onCheckmate={handleLiveCheckmate}
          />
        );
      })()}



      {/* Season Full Standings Modal */}
      {selectedSeason && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setSelectedSeason(null)}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: T.textBright }}>📜 {selectedSeason.name}</div>
              <button onClick={() => setSelectedSeason(null)} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              Ended: {new Date(selectedSeason.endedAt).toLocaleDateString()}
            </div>

            {/* Champion banner */}
            <div style={{ background: "rgba(240,192,64,0.08)", border: "1px solid rgba(240,192,64,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🏆</span>
              <div>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Champion</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.gold }}>{selectedSeason.champion.name}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{selectedSeason.champion.pts} points</div>
              </div>
            </div>

            {/* Full standings table */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Player</th>
                  <th style={s.th}>W</th>
                  <th style={s.th}>D</th>
                  <th style={s.th}>L</th>
                  <th style={s.th}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {(selectedSeason.standings || []).map((p, i) => (
                  <tr key={p.id || i} style={{ background: i === 0 ? "rgba(240,192,64,0.07)" : "transparent" }}>
                    <td style={{ ...s.td, color: i === 0 ? T.gold : T.textMuted, fontWeight: 700 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td style={{ ...s.td, color: T.textBright, fontWeight: 600 }}>{p.name}</td>
                    <td style={{ ...s.td, color: "#22c55e" }}>{p.w}</td>
                    <td style={{ ...s.td, color: T.gold }}>{p.d}</td>
                    <td style={{ ...s.td, color: "#ef4444" }}>{p.l}</td>
                    <td style={{ ...s.td, fontWeight: 800, color: i === 0 ? T.gold : T.text }}>{p.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button style={{ ...s.btn(), marginTop: 16 }} onClick={() => setSelectedSeason(null)}>Close</button>
          </div>
        </div>
      )}

      {selectedPlayer && (() => {
        const player = players.find(p => p.id === selectedPlayer);
        if (!player) return null;
        const stat = standings.find(p => p.id === selectedPlayer) || { w: 0, d: 0, l: 0, pts: 0 };
        const history = (playerHistory[selectedPlayer] || []).slice().reverse();
        const otherPlayers = players.filter(p => p.id !== selectedPlayer);

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => { setSelectedPlayer(null); setEditingPlayer(false); }}>
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              {!editingPlayer ? (
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <Avatar name={player.name} size={56} photo={player.photo} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: T.textBright }}>{player.name}</div>
                    <Badge text={player.level} color={player.level === "Expert" ? "#7c3aed" : player.level === "Advanced" ? "#b45309" : player.level === "Intermediate" ? "#1d6b4d" : "#374151"} />
                  </div>
                  {isManager && (
                    <button onClick={() => startEditPlayer(player)} style={{ background: "rgba(240,192,64,0.12)", border: "1px solid rgba(240,192,64,0.3)", color: "#f0c040", borderRadius: 8, padding: "6px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✏️ Edit</button>
                  )}
                  <button onClick={() => { setSelectedPlayer(null); setEditingPlayer(false); }} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: T.textBright }}>Edit Player</div>
                    <button onClick={() => { setSelectedPlayer(null); setEditingPlayer(false); }} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                    <Avatar name={editName || "?"} size={56} photo={editPhoto} />
                    <label style={{ ...s.btn("#374151"), marginTop: 0, width: "auto", padding: "8px 16px", display: "inline-block", cursor: "pointer" }}>
                      📷 {editPhoto ? "Change Photo" : "Add Photo"}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;
                        try {
                          const dataUrl = await resizeImageToDataUrl(file);
                          setEditPhoto(dataUrl);
                        } catch (err) { console.error("Image resize error:", err); }
                      }} />
                    </label>
                    {editPhoto && <button onClick={() => setEditPhoto(null)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Remove</button>}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Full Name</label>
                    <input style={s.input} value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div style={s.row}>
                    <div>
                      <label style={s.label}>WhatsApp Number</label>
                      <input style={s.input} placeholder="+252..." value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                    </div>
                    <div>
                      <label style={s.label}>Level</label>
                      <select style={s.select} value={editLevel} onChange={e => setEditLevel(e.target.value)}>
                        <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button style={{ ...s.btn(), marginTop: 0, flex: 1 }} onClick={() => saveEditPlayer(player.id)}>💾 Save Changes</button>
                    <button style={{ ...s.btn("#374151"), marginTop: 0, flex: 1 }} onClick={() => setEditingPlayer(false)}>Cancel</button>
                  </div>
                </div>
              )}


              {!editingPlayer && (
              <>
              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                <div style={{ background: T.bg, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.gold }}>{stat.pts}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Points</div>
                </div>
                <div style={{ background: T.bg, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{stat.w}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Wins</div>
                </div>
                <div style={{ background: T.bg, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#9ca3af" }}>{stat.d}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Draws</div>
                </div>
                <div style={{ background: T.bg, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{stat.l}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Losses</div>
                </div>
                <div style={{ background: T.bg, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#a78bfa" }}>{player.elo || DEFAULT_ELO}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Elo</div>
                </div>
                <div style={{ background: T.bg, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#f87171" }}>{getBestStreak(player.id)}🔥</div>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Best Streak</div>
                </div>
              </div>

              {/* Form Guide */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Form (Last 5)</div>
                <FormBadges form={getForm(selectedPlayer, 5)} size={28} />
              </div>

              {/* Match History */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Match History</div>
                {history.length === 0 && <div style={{ color: "#6b7280", fontSize: 13, padding: "12px 0" }}>No matches played yet.</div>}
                {history.map((h, i) => {
                  const resultColor = h.result === "W" ? "#22c55e" : h.result === "L" ? "#ef4444" : "#f0c040";
                  const resultText = h.result === "W" ? "Won" : h.result === "L" ? "Lost" : "Drew";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #2a2f3e" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: resultColor, color: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{h.result}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: T.textBright, fontWeight: 600 }}>{resultText} vs {h.opponentName}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{h.color === "white" ? "⬜ White" : "⬛ Black"} • {h.date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Head-to-Head */}
              {otherPlayers.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Head-to-Head</div>
                  {otherPlayers.map(opp => {
                    const { summary } = getHeadToHead(selectedPlayer, opp.id);
                    if (summary.games === 0) return null;
                    return (
                      <div key={opp.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #2a2f3e" }}>
                        <Avatar name={opp.name} size={28} photo={opp.photo} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: T.textBright, fontWeight: 600 }}>vs {opp.name}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{summary.games} game{summary.games > 1 ? "s" : ""} played</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 700 }}>
                          <span style={{ color: "#22c55e" }}>{summary.aWins}W</span>
                          <span style={{ color: "#f0c040" }}>{summary.draws}D</span>
                          <span style={{ color: "#ef4444" }}>{summary.bWins}L</span>
                        </div>
                      </div>
                    );
                  })}
                  {otherPlayers.every(opp => getHeadToHead(selectedPlayer, opp.id).summary.games === 0) && (
                    <div style={{ color: "#6b7280", fontSize: 13, padding: "12px 0" }}>No head-to-head matches yet.</div>
                  )}
                </div>
              )}

              {isManager && (
                <button
                  style={{ ...s.btn("#ef4444"), marginTop: 8 }}
                  onClick={() => {
                    if (window.confirm(`Remove ${player.name} from the club? This will also cancel their matches.`)) {
                      deletePlayer(player.id);
                    }
                  }}
                >
                  🗑️ Remove Player
                </button>
              )}
              <button style={{ ...s.btn(), marginTop: 8 }} onClick={() => setSelectedPlayer(null)}>Close</button>
              </>
              )}
            </div>
          </div>
        );
      })()}

      <div style={s.header}>
        <div style={s.topRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>♟️</span>
            <div style={s.appTitle}>{APP_NAME}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={s.roleBadge}>{isManager ? "👑 Manager" : "👀 Viewer"}</div>
            <button style={s.themeBtn} onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle theme">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button style={s.logoutBtn} onClick={() => { signOut(auth).catch(() => {}); setRole(null); }}>Logout</button>
          </div>
        </div>
        <div style={s.tabs}>
          {TABS.map(t => <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      </div>

      <div style={s.body}>
        {!dbLoaded && (
          <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
            ⏳ Loading club data...
          </div>
        )}
        {dbError && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "#ef4444" }}>
            ⚠️ Database connection error: {dbError}. Data may not be saved. Check Firebase config.
          </div>
        )}
        <a href={WA_GROUP} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#25D366", fontWeight: 700, fontSize: 13 }}>Join our WhatsApp Group</div>
            <div style={{ color: "#6b7280", fontSize: 11 }}>{APP_NAME} community chat</div>
          </div>
          <span style={{ color: "#25D366", fontWeight: 700, fontSize: 12 }}>Open →</span>
        </a>

        <div style={s.ptsBanner}>
          <span style={{ color: "#f0c040", fontWeight: 700 }}>Points:</span>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>🏆 Win = {PTS.win}pts</span>
          <span style={{ color: "#9ca3af", fontWeight: 700 }}>🤝 Draw = {PTS.draw}pt</span>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>❌ Loss = {PTS.loss}pts</span>
        </div>

        {!isManager && (
          <div style={s.viewerBanner}>
            <span style={{ fontSize: 18 }}>👀</span>
            <span>You are in <strong>view-only mode</strong>. Only the manager can add or edit data.</span>
          </div>
        )}

        {/* DASHBOARD */}
        {tab === "Dashboard" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>Current Season</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.gold }}>🏆 {currentSeasonName}</div>
            </div>

            {/* Announcements */}
            {announcements.length > 0 && announcements.slice(0, 3).map(a => (
              <div key={a.id} style={{ ...s.card, background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.25)", padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 2 }}>📢 {a.title}</div>
                    {a.message && <div style={{ fontSize: 12, color: T.textMuted2 }}>{a.message}</div>}
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>{new Date(a.ts).toLocaleString()}</div>
                  </div>
                  {isManager && <button onClick={() => deleteAnnouncement(a.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>}
                </div>
              </div>
            ))}

            {/* Quick stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
              <div style={s.card2}>
                <div style={{ fontSize: 24, fontWeight: 800, color: T.gold }}>{players.length}</div>
                <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Players</div>
              </div>
              <div style={s.card2}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{results.length}</div>
                <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Matches Played</div>
              </div>
              <div style={s.card2}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#3b82f6" }}>{pendingMatches.length}</div>
                <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Upcoming</div>
              </div>
              <div style={s.card2}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>
                  {Object.values(onlineUsers).filter(u => u.online).length}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>🟢 Online</div>
                {Object.values(onlineUsers).filter(u => u.online).length > 0 && (
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
                    {Object.values(onlineUsers).filter(u => u.online).map(u => u.name).join(", ")}
                  </div>
                )}
              </div>
            </div>

            {/* Hot streak */}
            {players.length > 0 && (() => {
              const streaks = players.map(p => ({ ...p, streak: getCurrentStreak(p.id) })).filter(p => p.streak > 0).sort((a, b) => b.streak - a.streak);
              if (streaks.length === 0) return null;
              const top = streaks[0];
              return (
                <div style={{ ...s.card, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>🔥 Hot Streak</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar name={top.name} size={36} photo={top.photo} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: T.textBright }}>{top.name}</div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>{top.streak} wins in a row 🔥</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Current leader */}
            {standings.length > 0 && (
              <div style={{ ...s.card, background: "linear-gradient(135deg, rgba(240,192,64,0.12), rgba(240,192,64,0.03))", border: "1px solid rgba(240,192,64,0.25)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f0c040", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>🥇 Current Leader</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setSelectedPlayer(standings[0].id)}>
                  <Avatar name={standings[0].name} size={48} photo={getPlayerPhoto(standings[0].id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 17, color: T.textBright }}>{standings[0].name}</div>
                    <FormBadges form={getForm(standings[0].id)} size={16} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#f0c040" }}>{standings[0].pts}</div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>points</div>
                  </div>
                </div>
              </div>
            )}

            {/* Live match */}
            {startedMatches.length > 0 && (
              <div style={{ ...s.card, border: "1px solid rgba(34,197,94,0.3)" }}>
                <div style={s.sectionTitle}><span style={s.liveDot} />Live Now</div>
                {startedMatches.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                    <Avatar name={m.whiteName} size={28} photo={getPlayerPhoto(m.whiteId)} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: T.textBright }}>{m.whiteName}</span>
                    <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 12 }}>VS</span>
                    <Avatar name={m.blackName} size={28} photo={getPlayerPhoto(m.blackId)} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: T.textBright }}>{m.blackName}</span>
                    <button style={{ ...s.startBtn, background: "#3b82f6", marginLeft: "auto" }} onClick={() => setColorPickMatch(m)}>♟️ Watch</button>
                  </div>
                ))}
              </div>
            )}

            {/* Next match */}
            <div style={s.card}>
              <div style={s.sectionTitle}>📅 Next Match</div>
              {notStartedMatches.length === 0 && <div style={s.empty}>No upcoming matches scheduled.</div>}
              {notStartedMatches.length > 0 && (() => {
                const m = notStartedMatches[0];
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Avatar name={m.whiteName} size={32} photo={getPlayerPhoto(m.whiteId)} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: T.textBright }}>{m.whiteName}</span>
                      <span style={{ color: "#f0c040", fontWeight: 800, fontSize: 12 }}>VS</span>
                      <Avatar name={m.blackName} size={32} photo={getPlayerPhoto(m.blackId)} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: T.textBright }}>{m.blackName}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>📆 {m.date}{m.time ? ` at ${m.time}` : ""}</div>
                  </div>
                );
              })()}
            </div>

            {/* Recent activity — Manager only */}
            {isManager && (
              <div style={s.card}>
                <div style={s.sectionTitle}>📢 Post Announcement</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={s.label}>Title</label>
                  <input style={s.input} placeholder="e.g. Practice cancelled today" value={newAnnTitle} onChange={e => setNewAnnTitle(e.target.value)} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={s.label}>Message (optional)</label>
                  <input style={s.input} placeholder="More details..." value={newAnnMsg} onChange={e => setNewAnnMsg(e.target.value)} />
                </div>
                <button style={s.btn()} onClick={addAnnouncement}>📢 Post Announcement</button>
              </div>
            )}

            {isManager && (
              <div style={s.card}>
                <div style={s.sectionTitle}>🕐 Recent Activity</div>
                {activity.length === 0 && <div style={s.empty}>No activity yet. Add players and matches to get started.</div>}
                {activity.slice().reverse().slice(0, 10).map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: T.text }}>{a.text}</div>
                      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{new Date(a.ts).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* PLAYERS */}
        {tab === "Players" && (
          <>
            {isManager && (
              <div style={s.card}>
                <div style={s.sectionTitle}>Add Player</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <Avatar name={pName || "?"} size={56} photo={pPhoto} />
                  <label style={{ ...s.btn("#374151"), marginTop: 0, width: "auto", padding: "8px 16px", display: "inline-block", cursor: "pointer" }}>
                    📷 {pPhoto ? "Change Photo" : "Add Photo"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                      const file = e.target.files && e.target.files[0];
                      if (!file) return;
                      try {
                        const dataUrl = await resizeImageToDataUrl(file);
                        setPPhoto(dataUrl);
                      } catch (err) { console.error("Image resize error:", err); }
                    }} />
                  </label>
                  {pPhoto && <button onClick={() => setPPhoto(null)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Remove</button>}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={s.label}>Full Name</label>
                  <input style={s.input} placeholder="e.g. Ahmed Hassan" value={pName} onChange={e => setPName(e.target.value)} />
                </div>
                <div style={s.row}>
                  <div><label style={s.label}>WhatsApp Number</label><input style={s.input} placeholder="+252..." value={pPhone} onChange={e => setPPhone(e.target.value)} /></div>
                  <div>
                    <label style={s.label}>Level</label>
                    <select style={s.select} value={pLevel} onChange={e => setPLevel(e.target.value)}>
                      <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option>
                    </select>
                  </div>
                </div>
                <button style={s.btn()} onClick={addPlayer}>+ Add Player</button>
              </div>
            )}
            <div style={s.card}>
              <div style={s.sectionTitle}>Members ({players.length})</div>
              {players.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <input
                    style={s.input}
                    placeholder="🔍 Search players by name or level..."
                    value={playerSearch}
                    onChange={e => setPlayerSearch(e.target.value)}
                  />
                </div>
              )}
              {players.length === 0 && <div style={s.empty}>No players yet.{isManager ? " Add your first member above." : ""}</div>}
              {(() => {
                const q = playerSearch.trim().toLowerCase();
                const filtered = q ? players.filter(p => p.name.toLowerCase().includes(q) || p.level.toLowerCase().includes(q)) : players;
                if (players.length > 0 && filtered.length === 0) {
                  return <div style={s.empty}>No players match "{playerSearch}".</div>;
                }
                return filtered.map(p => (
                  <div key={p.id} style={{ ...s.playerRow, cursor: "pointer" }} onClick={() => { setSelectedPlayer(p.id); setEditingPlayer(false); }}>
                    <Avatar name={p.name} photo={p.photo} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.textBright }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{p.phone || "No phone"}</div>
                      <FormBadges form={getForm(p.id)} size={18} />
                    </div>
                    <Badge text={p.level} color={p.level === "Expert" ? "#7c3aed" : p.level === "Advanced" ? "#b45309" : p.level === "Intermediate" ? "#1d6b4d" : "#374151"} />
                    {isManager && p.phone && (
                      <button style={s.waBtn} onClick={(e) => { e.stopPropagation(); sendWA(p.phone.replace(/\D/g, ""), `Hi ${p.name}! 👋 Welcome to ${APP_NAME}!`); }}>
                        <span>📱</span> Chat
                      </button>
                    )}
                  </div>
                ));
              })()}
            </div>
          </>
        )}


        {/* SCHEDULE */}
        {tab === "Schedule" && (
          <>
            {isManager && (
              <div style={s.card}>
                <div style={s.sectionTitle}>Schedule a Match</div>
                {players.length < 2 ? <div style={s.empty}>Add at least 2 players first.</div> : (
                  <>
                    <div style={s.row}>
                      <div><label style={s.label}>⬜ White</label>
                        <select style={s.select} value={mWhite} onChange={e => setMWhite(e.target.value)}>
                          <option value="">Select player</option>
                          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div><label style={s.label}>⬛ Black</label>
                        <select style={s.select} value={mBlack} onChange={e => setMBlack(e.target.value)}>
                          <option value="">Select player</option>
                          {players.filter(p => p.id !== +mWhite).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ ...s.row, marginTop: 12 }}>
                      <div><label style={s.label}>Date</label><input type="date" style={s.input} value={mDate} onChange={e => setMDate(e.target.value)} /></div>
                      <div><label style={s.label}>Time (optional)</label><input type="time" style={s.input} value={mTime} onChange={e => setMTime(e.target.value)} /></div>
                    </div>
                    <button style={s.btn()} onClick={addMatch}>📅 Schedule & Notify Group</button>
                  </>
                )}
              </div>
            )}
            {startedMatches.length > 0 && (
              <div style={s.card}>
                <div style={s.sectionTitle}><span style={s.liveDot} />Live Matches ({startedMatches.length})</div>
                {startedMatches.map(m => (
                  <div key={m.id} style={{ padding: "12px 0", borderBottom: "1px solid #2a2f3e" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={m.whiteName} size={30} photo={getPlayerPhoto(m.whiteId)} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: T.textBright }}>{m.whiteName}</span>
                      <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 12 }}>VS</span>
                      <Avatar name={m.blackName} size={30} photo={getPlayerPhoto(m.blackId)} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: T.textBright }}>{m.blackName}</span>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge text="🟢 LIVE" color="#15532e" />
                        <button style={{ ...s.startBtn, background: "#3b82f6" }} onClick={() => setColorPickMatch(m)}>♟️ Watch</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={s.card}>
              <div style={s.sectionTitle}>Upcoming Matches ({notStartedMatches.length})</div>
              {notStartedMatches.length === 0 && <div style={s.empty}>No upcoming matches.</div>}
              {notStartedMatches.map(m => (
                <div key={m.id} style={{ padding: "12px 0", borderBottom: "1px solid #2a2f3e" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={m.whiteName} size={30} photo={getPlayerPhoto(m.whiteId)} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: T.textBright }}>{m.whiteName}</span>
                    <span style={{ color: "#f0c040", fontWeight: 800, fontSize: 12 }}>VS</span>
                    <Avatar name={m.blackName} size={30} photo={getPlayerPhoto(m.blackId)} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: T.textBright }}>{m.blackName}</span>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                      <Badge text={m.date} color="#1d3557" />
                      {isManager && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={s.startBtn} onClick={() => startMatch(m.id)}>▶ Start</button>
                          <button
                            style={{ ...s.startBtn, background: "#ef4444" }}
                            onClick={() => {
                              if (window.confirm(`Cancel match: ${m.whiteName} vs ${m.blackName}?`)) {
                                cancelMatch(m.id);
                              }
                            }}
                          >✕ Cancel</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {m.time && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>🕐 {m.time}</div>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* RESULTS */}
        {tab === "Results" && (
          <>
            {isManager && (
              <div style={s.card}>
                <div style={s.sectionTitle}>Enter Match Result</div>
                {pendingMatches.length === 0 ? <div style={s.empty}>No pending matches to record.</div> : (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label style={s.label}>Match</label>
                      <select style={s.select} value={rMatch} onChange={e => setRMatch(e.target.value)}>
                        <option value="">Select match</option>
                        {pendingMatches.map(m => <option key={m.id} value={m.id}>{m.whiteName} vs {m.blackName} ({m.date}){m.started ? " 🟢" : ""}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={s.label}>Result</label>
                      <select style={s.select} value={rWinner} onChange={e => setRWinner(e.target.value)}>
                        <option value="">Select result</option>
                        {rMatch && (() => { const m = matches.find(x => x.id === +rMatch); return m ? [<option key="w" value="white">⬜ {m.whiteName} wins (+{PTS.win}pts)</option>, <option key="b" value="black">⬛ {m.blackName} wins (+{PTS.win}pts)</option>, <option key="d" value="draw">🤝 Draw (+{PTS.draw}pt each)</option>] : null; })()}
                      </select>
                    </div>
                    <button style={s.btn()} onClick={addResult}>🏁 Save & Notify Group</button>
                  </>
                )}
              </div>
            )}
            <div style={s.card}>
              <div style={s.sectionTitle}>Completed Matches</div>
              {results.length === 0 && <div style={s.empty}>No results recorded yet.</div>}
              {results.map((r, i) => {
                const m = matches.find(x => x.id === r.matchId);
                if (!m) return null;
                const winner = r.winner === "white" ? m.whiteName : r.winner === "black" ? m.blackName : null;
                return (
                  <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #2a2f3e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: T.textBright }}>{m.whiteName} vs {m.blackName}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{m.date}</div>
                    </div>
                    <Badge text={!winner ? `🤝 Draw (+${PTS.draw}pt)` : `🏆 ${winner} (+${PTS.win}pts)`} color={!winner ? "#374151" : "#b45309"} />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* STANDINGS */}
        {tab === "Standings" && (
          <>
            {/* Current season header */}
            <div style={{ ...s.card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>Current Season</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.gold }}>🏆 {currentSeasonName}</div>
              </div>
              {isManager && standings.length > 0 && (
                <button style={{ ...s.btn("#374151"), marginTop: 0, width: "auto", padding: "8px 14px", fontSize: 12 }} onClick={() => setShowEndSeasonConfirm(true)}>
                  🏁 End Season
                </button>
              )}
            </div>

            {/* End season confirmation */}
            {showEndSeasonConfirm && (
              <div style={{ ...s.card, border: "1px solid rgba(240,192,64,0.3)" }}>
                <div style={{ fontWeight: 700, color: T.textBright, marginBottom: 8, fontSize: 14 }}>End "{currentSeasonName}"?</div>
                <div style={{ fontSize: 12, color: T.textMuted2, marginBottom: 12 }}>
                  This will save the current standings to history (with {standings[0]?.name} as champion 🏆), then reset matches and results so everyone starts fresh. Players stay in the club.
                </div>
                <label style={s.label}>Next Season Name</label>
                <input style={s.input} placeholder={`Season ${seasons.length + 2}`} value={nextSeasonName} onChange={e => setNextSeasonName(e.target.value)} />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button style={{ ...s.btn(), marginTop: 0, flex: 1 }} onClick={endSeason}>✅ Confirm & Start New Season</button>
                  <button style={{ ...s.btn("#374151"), marginTop: 0, flex: 1 }} onClick={() => setShowEndSeasonConfirm(false)}>Cancel</button>
                </div>
              </div>
            )}

          <div style={s.card}>
            <div style={s.sectionTitle}>🏆 Club Standings</div>
            {standings.length === 0 && <div style={s.empty}>Add players and record results to see standings.</div>}
            {standings.length > 0 && (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={s.th}>#</th><th style={s.th}>Player</th><th style={s.th}>W</th><th style={s.th}>D</th><th style={s.th}>L</th><th style={s.th}>Pts</th><th style={s.th}>Elo</th><th style={s.th}>Form</th></tr></thead>
                  <tbody>
                    {standings.map((p, i) => (
                      <tr key={p.id} style={{ background: i === 0 ? "rgba(240,192,64,0.07)" : "transparent", cursor: "pointer" }} onClick={() => { setSelectedPlayer(p.id); setEditingPlayer(false); }}>
                        <td style={{ ...s.td, color: i === 0 ? "#f0c040" : "#6b7280", fontWeight: 700 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                        <td style={{ ...s.td, color: T.textBright, fontWeight: 600 }}>{p.name}</td>
                        <td style={{ ...s.td, color: "#22c55e" }}>{p.w}</td>
                        <td style={{ ...s.td, color: "#f0c040" }}>{p.d}</td>
                        <td style={{ ...s.td, color: "#ef4444" }}>{p.l}</td>
                        <td style={{ ...s.td, fontWeight: 800, color: i === 0 ? "#f0c040" : T.text }}>{p.pts}</td>
                        <td style={{ ...s.td, color: "#a78bfa", fontWeight: 700, fontSize: 12 }}>{p.elo || DEFAULT_ELO}</td>
                        <td style={s.td}><FormBadges form={getForm(p.id)} size={18} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                  <button style={{ ...s.btn("#25D366"), marginTop: 0, flex: 1 }} onClick={async () => {
                    const dataUrl = await downloadAndShare();
                    setImgModal(dataUrl);
                  }}>
                    📸 Download Standings Image
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginTop: 8 }}>
                  Haddii download-ku si toos ah u shaqayn waayo, sawirka ayaa hoos ku muuqan doona — taabo oo hayso ("long-press") si aad u kaydiso.
                </div>
              </>
            )}
          </div>

            {/* Past Seasons / Champions */}
            {seasons.length > 0 && (
              <div style={s.card}>
                <div style={s.sectionTitle}>📜 Past Seasons</div>
                {seasons.slice().reverse().map(season => (
                  <div key={season.id}
                    onClick={() => setSelectedSeason(season)}
                    style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: T.textBright }}>{season.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{new Date(season.endedAt).toLocaleDateString()}</div>
                        <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, border: `1px solid ${T.gold}`, borderRadius: 4, padding: "2px 6px" }}>Full Table →</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>🏆</span>
                      <span style={{ fontSize: 13, color: T.gold, fontWeight: 700 }}>{season.champion.name}</span>
                      <span style={{ fontSize: 12, color: T.textMuted }}>— {season.champion.pts} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TOURNAMENT */}
        {tab === "Tournament" && (
          <>
            <div style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: T.textMuted2 }}>
              🎉 <strong style={{ color: "#a78bfa" }}>For Fun!</strong> Tournament results don't affect League Standings or points.
            </div>

            {!tournament && (
              <div style={s.card}>
                <div style={s.sectionTitle}>🎉 New Tournament</div>
                {!isManager && <div style={s.empty}>No tournament running. Ask the manager to start one!</div>}
                {isManager && players.length < 2 && <div style={s.empty}>Add at least 2 players first.</div>}
                {isManager && players.length >= 2 && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label style={s.label}>Tournament Name</label>
                      <input style={s.input} placeholder="e.g. Friday Knockout" value={tournamentName} onChange={e => setTournamentName(e.target.value)} />
                    </div>
                    <label style={s.label}>Select Players ({tournamentSelected.length} selected)</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      {players.map(p => {
                        const selected = tournamentSelected.includes(p.id);
                        return (
                          <button key={p.id} onClick={() => setTournamentSelected(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                            style={{ display: "flex", alignItems: "center", gap: 6, background: selected ? "rgba(124,58,237,0.15)" : T.bg, border: `1px solid ${selected ? "#7c3aed" : T.border}`, borderRadius: 20, padding: "6px 12px", cursor: "pointer", color: selected ? "#a78bfa" : T.text, fontSize: 12, fontWeight: 600 }}>
                            <Avatar name={p.name} size={20} photo={p.photo} />
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                    <button style={{ ...s.btn("#7c3aed"), opacity: tournamentSelected.length < 2 ? 0.5 : 1 }} disabled={tournamentSelected.length < 2} onClick={startTournament}>
                      🎉 Start Tournament ({tournamentSelected.length} players)
                    </button>
                  </>
                )}
              </div>
            )}

            {tournament && (
              <>
                <div style={{ ...s.card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>Tournament</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#a78bfa" }}>🎉 {tournament.name}</div>
                  </div>
                  {isManager && <button style={{ ...s.btn("#374151"), marginTop: 0, width: "auto", padding: "8px 14px", fontSize: 12 }} onClick={endTournament}>✕ End</button>}
                </div>

                {tournament.champion && (
                  <div style={{ ...s.card, border: "1px solid rgba(124,58,237,0.3)", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>🏆 Champion</div>
                    <Avatar name={tournament.champion.name} size={56} photo={tournament.champion.photo} />
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.textBright, marginTop: 8 }}>{tournament.champion.name}</div>
                  </div>
                )}

                {tournament.rounds.map((round, ri) => (
                  <div key={ri} style={s.card}>
                    <div style={s.sectionTitle}>{getRoundName(round.length)}</div>
                    {round.map((m, mi) => {
                      const isBye = m.p1 && !m.p2;
                      return (
                        <div key={m.id} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                          <div onClick={() => isManager && m.p2 && !m.winner && setBracketWinner(ri, mi, "p1")}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: m.winner === "p1" ? "rgba(34,197,94,0.1)" : "transparent", cursor: (isManager && m.p2 && !m.winner) ? "pointer" : "default", opacity: m.winner === "p2" ? 0.4 : 1 }}>
                            <Avatar name={m.p1 ? m.p1.name : "?"} size={28} photo={m.p1 ? m.p1.photo : null} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1 }}>{m.p1 ? m.p1.name : "TBD"}</span>
                            {m.winner === "p1" && <span>✅</span>}
                          </div>
                          <div style={{ textAlign: "center", fontSize: 11, color: T.textMuted, fontWeight: 700, padding: "2px 0" }}>{isBye ? "BYE — auto advances" : "vs"}</div>
                          <div onClick={() => isManager && m.p2 && !m.winner && setBracketWinner(ri, mi, "p2")}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: m.winner === "p2" ? "rgba(34,197,94,0.1)" : "transparent", cursor: (isManager && m.p2 && !m.winner) ? "pointer" : "default", opacity: m.winner === "p1" ? 0.4 : 1 }}>
                            <Avatar name={m.p2 ? m.p2.name : "?"} size={28} photo={m.p2 ? m.p2.photo : null} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1 }}>{m.p2 ? m.p2.name : (isBye ? "—" : "TBD")}</span>
                            {m.winner === "p2" && <span>✅</span>}
                          </div>
                          {isManager && m.p2 && !m.winner && (
                            <div style={{ fontSize: 10, color: T.textMuted, textAlign: "center", marginTop: 6 }}>Tap a player to advance them</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}
