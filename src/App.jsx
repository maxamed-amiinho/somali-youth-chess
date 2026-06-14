import { useState, useMemo, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

const TABS = ["Players", "Schedule", "Results", "Standings"];
const MANAGER_EMAIL = "amiinho@gmail.com";
const MANAGER_PASS = "hooyo2023";
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

// Single shared document holding all club data
const CLUB_DOC = doc(db, "chessClub", "data");

function Avatar({ name, size = 36 }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
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

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const handleLogin = () => {
    if (email.trim() === MANAGER_EMAIL && pass === MANAGER_PASS) onLogin("manager");
    else setError("Incorrect email or password.");
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
        <button style={s.btn} onClick={handleLogin}>Login as Manager</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", color: "#374151", fontSize: 12 }}>
          <div style={s.line} /><span>or</span><div style={s.line} />
        </div>
        <button style={s.viewerBtn} onClick={() => onLogin("viewer")}>👀 Continue as Viewer (View Only)</button>
      </div>
    </div>
  );
}

// Draw standings card to canvas and share as image
function useStandingsImage(standings) {
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
      ctx.fillText("STANDINGS", W / 2, 60);

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

export default function ChessClub() {
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState("Players");
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);
  const [notif, setNotif] = useState(null);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [dbError, setDbError] = useState(null);
  const isLocalUpdate = useRef(false);

  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pLevel, setPLevel] = useState("Intermediate");
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

  const isManager = role === "manager";

  const showNotif = (type, title, body) => setNotif({ type, title, body, id: Date.now() });

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

  // Whenever players/matches/results change locally, save to Firestore
  // (skip the very first sync that came FROM Firestore to avoid an extra write loop)
  useEffect(() => {
    if (!dbLoaded) return;
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }
    setDoc(CLUB_DOC, { players, matches, results, updatedAt: Date.now() }).catch((err) => {
      console.error("Firestore save error:", err);
      setDbError(err.message);
    });
  }, [players, matches, results, dbLoaded]);

  const standings = useMemo(() => {
    const map = {};
    players.forEach(p => { map[p.id] = { id: p.id, name: p.name, w: 0, d: 0, l: 0, pts: 0 }; });
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

  const addPlayer = () => {
    if (!pName.trim()) return;
    const player = { id: Date.now(), name: pName.trim(), phone: pPhone.trim(), level: pLevel };
    setPlayers(p => [...p, player]);
    setPName(""); setPPhone(""); setPLevel("Intermediate");
    showNotif("info", "New Player Added!", `${player.name} joined as ${player.level}`);
  };

  const startEditPlayer = (player) => {
    setEditName(player.name);
    setEditPhone(player.phone || "");
    setEditLevel(player.level);
    setEditingPlayer(true);
  };

  const saveEditPlayer = (playerId) => {
    if (!editName.trim()) return;
    const oldPlayer = players.find(p => p.id === playerId);
    const levelChanged = oldPlayer && oldPlayer.level !== editLevel;
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, name: editName.trim(), phone: editPhone.trim(), level: editLevel } : p));
    setEditingPlayer(false);
    if (levelChanged) {
      showNotif("info", "Player Updated!", `${editName.trim()} is now ${editLevel} (was ${oldPlayer.level})`);
    } else {
      showNotif("info", "Player Updated!", `${editName.trim()}'s info was updated`);
    }
  };

  const addMatch = () => {
    if (!mWhite || !mBlack || !mDate) return;
    const w = players.find(p => p.id === +mWhite);
    const b = players.find(p => p.id === +mBlack);
    const match = { id: Date.now(), whiteId: +mWhite, blackId: +mBlack, date: mDate, time: mTime, whiteName: w.name, blackName: b.name, started: false };
    setMatches(m => [...m, match]);
    setMWhite(""); setMBlack(""); setMDate(""); setMTime("");
    showNotif("info", "Match Scheduled!", `${w.name} vs ${b.name} on ${mDate}`);
  };

  const startMatch = (matchId) => {
    const match = matches.find(m => m.id === matchId);
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, started: true } : m));
    showNotif("start", "🟢 Match Started!", `${match.whiteName} vs ${match.blackName} — Game is live!`);
  };

  const addResult = () => {
    if (!rMatch || !rWinner) return;
    const match = matches.find(m => m.id === +rMatch);
    if (!match) return;
    setResults(r => [...r, { matchId: +rMatch, winner: rWinner }]);
    setRMatch(""); setRWinner("");
    const winnerName = rWinner === "white" ? match.whiteName : rWinner === "black" ? match.blackName : null;
    const scoreText = winnerName ? `🏆 *${winnerName}* wins!` : "🤝 It's a Draw!";
    showNotif("end", "🏁 Match Finished!", `${match.whiteName} vs ${match.blackName} — ${winnerName ? winnerName + " wins!" : "Draw!"}`);
  };

  if (!role) return <LoginScreen onLogin={setRole} />;

  const pendingMatches = matches.filter(m => !results.find(r => r.matchId === m.id));
  const startedMatches = pendingMatches.filter(m => m.started);
  const notStartedMatches = pendingMatches.filter(m => !m.started);

  const s = {
    app: { minHeight: "100vh", background: "#0f1117", color: "#e8e6e0", fontFamily: "'Inter','Segoe UI',sans-serif" },
    header: { background: "linear-gradient(135deg,#1a1f2e 0%,#0f1117 100%)", borderBottom: "1px solid #2a2f3e", padding: "16px 20px 0" },
    topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    appTitle: { fontSize: 15, fontWeight: 800, color: "#f0c040", letterSpacing: 1 },
    roleBadge: { background: isManager ? "rgba(240,192,64,0.15)" : "rgba(107,114,128,0.2)", color: isManager ? "#f0c040" : "#9ca3af", border: `1px solid ${isManager ? "rgba(240,192,64,0.3)" : "#374151"}`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 },
    logoutBtn: { background: "none", border: "1px solid #2a2f3e", borderRadius: 6, color: "#6b7280", fontSize: 11, padding: "4px 10px", cursor: "pointer", marginLeft: 8 },
    tabs: { display: "flex", gap: 4 },
    tab: (active) => ({ padding: "10px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, borderRadius: "8px 8px 0 0", transition: "all 0.15s", background: active ? "#1e2435" : "transparent", color: active ? "#f0c040" : "#6b7280", borderBottom: active ? "2px solid #f0c040" : "2px solid transparent" }),
    body: { padding: 20, maxWidth: 640, margin: "0 auto" },
    card: { background: "#1a1f2e", border: "1px solid #2a2f3e", borderRadius: 12, padding: 20, marginBottom: 16 },
    viewerBanner: { background: "rgba(107,114,128,0.1)", border: "1px solid #374151", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#9ca3af" },
    ptsBanner: { background: "rgba(240,192,64,0.08)", border: "1px solid rgba(240,192,64,0.2)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, fontSize: 12, flexWrap: "wrap" },
    label: { fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, display: "block" },
    input: { width: "100%", background: "#0f1117", border: "1px solid #2a2f3e", borderRadius: 8, padding: "10px 12px", color: "#e8e6e0", fontSize: 14, outline: "none", boxSizing: "border-box" },
    select: { width: "100%", background: "#0f1117", border: "1px solid #2a2f3e", borderRadius: 8, padding: "10px 12px", color: "#e8e6e0", fontSize: 14, outline: "none", boxSizing: "border-box" },
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    btn: (color) => { const c = color || "#f0c040"; return { background: c, color: c === "#f0c040" ? "#0f1117" : "#fff", border: "none", borderRadius: 8, padding: "11px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%", marginTop: 12 }; },
    startBtn: { background: "#22c55e", color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontWeight: 700, fontSize: 11, cursor: "pointer" },
    waBtn: { background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
    playerRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #2a2f3e" },
    sectionTitle: { fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 },
    th: { padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid #2a2f3e" },
    td: { padding: "12px 12px", fontSize: 13, borderBottom: "1px solid #1a1f2e" },
    empty: { textAlign: "center", color: "#6b7280", padding: 32, fontSize: 13 },
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

      {selectedPlayer && (() => {
        const player = players.find(p => p.id === selectedPlayer);
        if (!player) return null;
        const stat = standings.find(p => p.id === selectedPlayer) || { w: 0, d: 0, l: 0, pts: 0 };
        const history = (playerHistory[selectedPlayer] || []).slice().reverse();
        const otherPlayers = players.filter(p => p.id !== selectedPlayer);

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => { setSelectedPlayer(null); setEditingPlayer(false); }}>
            <div style={{ background: "#1a1f2e", border: "1px solid #2a2f3e", borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              {!editingPlayer ? (
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <Avatar name={player.name} size={56} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>{player.name}</div>
                    <Badge text={player.level} color={player.level === "Expert" ? "#7c3aed" : player.level === "Advanced" ? "#b45309" : player.level === "Intermediate" ? "#1d6b4d" : "#374151"} />
                  </div>
                  {isManager && (
                    <button onClick={() => startEditPlayer(player)} style={{ background: "rgba(240,192,64,0.12)", border: "1px solid rgba(240,192,64,0.3)", color: "#f0c040", borderRadius: 8, padding: "6px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✏️ Edit</button>
                  )}
                  <button onClick={() => { setSelectedPlayer(null); setEditingPlayer(false); }} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>Edit Player</div>
                    <button onClick={() => { setSelectedPlayer(null); setEditingPlayer(false); }} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                <div style={{ background: "#0f1117", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#f0c040" }}>{stat.pts}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Points</div>
                </div>
                <div style={{ background: "#0f1117", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{stat.w}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Wins</div>
                </div>
                <div style={{ background: "#0f1117", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#9ca3af" }}>{stat.d}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Draws</div>
                </div>
                <div style={{ background: "#0f1117", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{stat.l}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Losses</div>
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
                        <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{resultText} vs {h.opponentName}</div>
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
                        <Avatar name={opp.name} size={28} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>vs {opp.name}</div>
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

              <button style={{ ...s.btn(), marginTop: 16 }} onClick={() => setSelectedPlayer(null)}>Close</button>
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
            <button style={s.logoutBtn} onClick={() => setRole(null)}>Logout</button>
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

        {/* PLAYERS */}
        {tab === "Players" && (
          <>
            {isManager && (
              <div style={s.card}>
                <div style={s.sectionTitle}>Add Player</div>
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
              {players.length === 0 && <div style={s.empty}>No players yet.{isManager ? " Add your first member above." : ""}</div>}
              {players.map(p => (
                <div key={p.id} style={{ ...s.playerRow, cursor: "pointer" }} onClick={() => { setSelectedPlayer(p.id); setEditingPlayer(false); }}>
                  <Avatar name={p.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>{p.name}</div>
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
              ))}
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
                      <Avatar name={m.whiteName} size={30} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{m.whiteName}</span>
                      <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 12 }}>VS</span>
                      <Avatar name={m.blackName} size={30} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{m.blackName}</span>
                      <div style={{ marginLeft: "auto" }}><Badge text="🟢 LIVE" color="#15532e" /></div>
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
                    <Avatar name={m.whiteName} size={30} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{m.whiteName}</span>
                    <span style={{ color: "#f0c040", fontWeight: 800, fontSize: 12 }}>VS</span>
                    <Avatar name={m.blackName} size={30} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{m.blackName}</span>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                      <Badge text={m.date} color="#1d3557" />
                      {isManager && <button style={s.startBtn} onClick={() => startMatch(m.id)}>▶ Start</button>}
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
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{m.whiteName} vs {m.blackName}</div>
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
          <div style={s.card}>
            <div style={s.sectionTitle}>🏆 Club Standings</div>
            {standings.length === 0 && <div style={s.empty}>Add players and record results to see standings.</div>}
            {standings.length > 0 && (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={s.th}>#</th><th style={s.th}>Player</th><th style={s.th}>W</th><th style={s.th}>D</th><th style={s.th}>L</th><th style={s.th}>Pts</th><th style={s.th}>Form</th></tr></thead>
                  <tbody>
                    {standings.map((p, i) => (
                      <tr key={p.id} style={{ background: i === 0 ? "rgba(240,192,64,0.07)" : "transparent", cursor: "pointer" }} onClick={() => { setSelectedPlayer(p.id); setEditingPlayer(false); }}>
                        <td style={{ ...s.td, color: i === 0 ? "#f0c040" : "#6b7280", fontWeight: 700 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                        <td style={{ ...s.td, color: "#fff", fontWeight: 600 }}>{p.name}</td>
                        <td style={{ ...s.td, color: "#22c55e" }}>{p.w}</td>
                        <td style={{ ...s.td, color: "#f0c040" }}>{p.d}</td>
                        <td style={{ ...s.td, color: "#ef4444" }}>{p.l}</td>
                        <td style={{ ...s.td, fontWeight: 800, color: i === 0 ? "#f0c040" : "#e8e6e0" }}>{p.pts}</td>
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
        )}
      </div>
    </div>
  );
}
