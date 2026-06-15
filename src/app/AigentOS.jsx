"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Phone, MessageCircle, MapPin, Clock, Check, X, ArrowLeft, Sun, Moon,
  Map as MapIcon, List, Archive, RotateCcw, Sparkles, ChevronRight, KeyRound, LogOut,
  Building2, Lock, User, ArrowRight, Eye, EyeOff, Users, Crown, UserMinus,
} from "lucide-react";

/* =================================================================== *
 *  Aigent OS — single-file app: login + dashboard + auth shell.       *
 *  Default export is <App/>, which owns the session, so log in / log  *
 *  out / change password all work no matter what you render.          *
 * =================================================================== */


/* ------------------------------------------------------------------ */
/*  Theme tokens (mirror of the dashboard)                             */
/* ------------------------------------------------------------------ */
const L_VARS = {
  dark: {
    "--bg": "#07090c", "--bg2": "#0d1016", "--surface": "#0f1318", "--surface-2": "#161b22",
    "--border": "rgba(255,255,255,0.08)", "--border-2": "rgba(255,255,255,0.13)",
    "--text": "#eef2f7", "--muted": "#98a3b2", "--faint": "#616d7d",
    "--accent": "#2dd4bf", "--accent-2": "#34d399", "--accent-contrast": "#04211d",
    "--accent-soft": "rgba(45,212,191,0.12)", "--ring": "rgba(45,212,191,0.30)",
    "--shadow-lg": "0 18px 50px rgba(0,0,0,0.55)",
  },
  light: {
    "--bg": "#f4f6f8", "--bg2": "#eceff3", "--surface": "#ffffff", "--surface-2": "#f5f7fa",
    "--border": "rgba(15,23,42,0.08)", "--border-2": "rgba(15,23,42,0.14)",
    "--text": "#0b1220", "--muted": "#586472", "--faint": "#95a0ad",
    "--accent": "#0d9488", "--accent-2": "#0f766e", "--accent-contrast": "#ffffff",
    "--accent-soft": "rgba(13,148,136,0.10)", "--ring": "rgba(13,148,136,0.22)",
    "--shadow-lg": "0 20px 48px rgba(15,23,42,0.14)",
  },
};

const L_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.auth{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  font-family:'Inter',system-ui,-apple-system,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;
  background:radial-gradient(1100px 600px at 50% -12%, var(--bg2), var(--bg)) fixed;}
.auth-card{width:100%;max-width:430px;background:var(--surface);border:1px solid var(--border);
  border-radius:24px;box-shadow:var(--shadow-lg);padding:30px 28px;animation:rise .4s cubic-bezier(.2,.7,.2,1) both;}
@keyframes rise{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
.brand-mark{display:flex;align-items:center;justify-content:center;height:46px;width:46px;border-radius:14px;
  font-weight:800;font-size:16px;color:var(--accent-contrast);
  background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 0 0 1px var(--border),0 8px 24px var(--ring);}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;height:36px;width:36px;border:1px solid var(--border);
  color:var(--muted);border-radius:11px;background:transparent;cursor:pointer;transition:.16s;}
.icon-btn:hover{color:var(--text);border-color:var(--border-2);background:var(--surface-2);}
.seg{display:flex;gap:3px;padding:4px;background:var(--surface-2);border:1px solid var(--border);border-radius:13px;margin:22px 0 20px;}
.seg-btn{flex:1;padding:9px;border-radius:9px;font-size:13px;font-weight:600;color:var(--muted);
  background:transparent;border:none;cursor:pointer;transition:.16s;}
.seg-btn:hover{color:var(--text);}
.seg-btn.active{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.25);border:1px solid var(--border);}
.lbl{font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;display:block;}
.in-wrap{display:flex;align-items:center;gap:10px;border:1px solid var(--border-2);border-radius:13px;
  padding:11px 13px;background:var(--surface-2);transition:.16s;}
.in-wrap:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--ring);}
.in-wrap.bad{border-color:#f43f5e;}
.in{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-size:14px;}
.in::placeholder{color:var(--faint);}
.err{color:#f43f5e;font-size:12px;margin-top:6px;}
.field{margin-bottom:15px;}
.submit{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:4px;
  background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--accent-contrast);
  font-weight:700;border:none;border-radius:13px;padding:13px;cursor:pointer;transition:.16s;font-size:14px;}
.submit:hover{filter:brightness(1.06);}
.submit:disabled{opacity:.55;cursor:not-allowed;}
.linkbtn{background:none;border:none;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;padding:0;}
.linkbtn:hover{text-decoration:underline;}
.banner{margin-top:14px;padding:10px 12px;border-radius:11px;font-size:13px;font-weight:500;}
.banner.ok{background:var(--accent-soft);color:var(--accent);}
.banner.bad{background:rgba(244,63,94,.12);color:#f43f5e;}
`;

/* Normalize a company name for the uniqueness check.
   Mirror this EXACTLY on the server — the client check is only UX. */
const normalizeCompany = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function AuthInput({ icon, value, onChange, placeholder, type = "text", bad, autoFocus }) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div className={`in-wrap ${bad ? "bad" : ""}`}>
      {icon}
      <input
        className="in"
        type={isPw && show ? "text" : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={isPw ? "current-password" : "off"}
      />
      {isPw && (
        <button type="button" className="icon-btn" style={{ height: 26, width: 26, border: "none" }}
          onClick={() => setShow((s) => !s)} aria-label={show ? "Hide" : "Show"}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login / Sign-up / Change-password                                  */
/* ------------------------------------------------------------------ */
function LoginPage({
  existingBusinesses = ["Summit Air Solutions"],
  onLogin,
  onCreateBusiness,
  onChangePassword,
}) {
  const [theme, setTheme] = useState("dark");
  const [mode, setMode] = useState("login"); // "login" | "create" | "change"
  const [f, setF] = useState({ company: "", name: "", password: "", current: "", next: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null); // { kind, text }

  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const taken = existingBusinesses.map(normalizeCompany);

  const switchMode = (m) => { setMode(m); setErrors({}); setBanner(null); };

  function validate() {
    const e = {};
    if (!f.company.trim()) e.company = "Company name is required.";

    if (mode === "create") {
      if (!f.name.trim()) e.name = "Your name is required.";
      if (f.company.trim() && f.company.trim().length < 2) e.company = "That name is too short.";
      if (f.company.trim() && taken.includes(normalizeCompany(f.company)))
        e.company = "That company name is already taken.";
      if (f.password.length < 8) e.password = "Use at least 8 characters.";
    } else if (mode === "change") {
      if (!f.current) e.current = "Enter your current password.";
      if (f.next.length < 8) e.next = "New password needs 8+ characters.";
    } else {
      if (!f.name.trim()) e.name = "Your name is required.";
      if (!f.password) e.password = "Password is required.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    setBanner(null);
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === "login") {
        await (onLogin ?? (() => wait(600)))({ company: f.company.trim(), name: f.name.trim(), password: f.password });
      } else if (mode === "create") {
        await (onCreateBusiness ?? (() => wait(700)))({
          name: f.name.trim(), company: f.company.trim(), password: f.password,
        });
      } else {
        await (onChangePassword ?? (() => wait(600)))({
          company: f.company.trim(), current: f.current, next: f.next,
        });
        setBanner({ kind: "ok", text: "Password updated. You can log in with it now." });
        setF((p) => ({ ...p, current: "", next: "" }));
        setMode("login");
      }
    } catch (err) {
      setBanner({ kind: "bad", text: err?.message || "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const onKey = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="auth" style={L_VARS[theme]} onKeyDown={onKey}>
      <style>{L_CSS}</style>
      <div className="auth-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-mark">SA</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em" }}>
                {mode === "create" ? "Create your business" : mode === "change" ? "Change password" : "Welcome back"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                {mode === "create" ? "List your company to get started."
                  : mode === "change" ? "Set a new password for your company."
                  : "Log in with your company name and password."}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {mode !== "change" && (
          <div className="seg">
            <button className={`seg-btn ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>Log in</button>
            <button className={`seg-btn ${mode === "create" ? "active" : ""}`} onClick={() => switchMode("create")}>Create business</button>
          </div>
        )}
        {mode === "change" && <div style={{ height: 22 }} />}

        {/* Your name — login + create */}
        {mode !== "change" && (
          <div className="field">
            <label className="lbl">Your name</label>
            <AuthInput icon={<User size={16} style={{ color: "var(--faint)" }} />}
              value={f.name} onChange={set("name")} placeholder="Jordan Avery" bad={!!errors.name} autoFocus={mode !== "change"} />
            {errors.name && <div className="err">{errors.name}</div>}
          </div>
        )}

        {/* Company name — always */}
        <div className="field">
          <label className="lbl">Company name</label>
          <AuthInput icon={<Building2 size={16} style={{ color: "var(--faint)" }} />}
            value={f.company} onChange={set("company")} placeholder="Summit Air Solutions"
            bad={!!errors.company} />
          {errors.company && <div className="err">{errors.company}</div>}
        </div>

        {/* Login / create password */}
        {mode !== "change" && (
          <div className="field">
            <label className="lbl">{mode === "create" ? "Create a password" : "Password"}</label>
            <AuthInput icon={<Lock size={16} style={{ color: "var(--faint)" }} />} type="password"
              value={f.password} onChange={set("password")}
              placeholder={mode === "create" ? "At least 8 characters" : "••••••••"} bad={!!errors.password} />
            {errors.password && <div className="err">{errors.password}</div>}
          </div>
        )}

        {/* Change password fields */}
        {mode === "change" && (
          <>
            <div className="field">
              <label className="lbl">Current password</label>
              <AuthInput icon={<Lock size={16} style={{ color: "var(--faint)" }} />} type="password"
                value={f.current} onChange={set("current")} placeholder="••••••••" bad={!!errors.current} />
              {errors.current && <div className="err">{errors.current}</div>}
            </div>
            <div className="field">
              <label className="lbl">New password</label>
              <AuthInput icon={<KeyRound size={16} style={{ color: "var(--faint)" }} />} type="password"
                value={f.next} onChange={set("next")} placeholder="At least 8 characters" bad={!!errors.next} />
              {errors.next && <div className="err">{errors.next}</div>}
            </div>
          </>
        )}

        <button className="submit" onClick={submit} disabled={busy}>
          {busy ? "Working…" : (
            <>
              {mode === "login" ? "Log in" : mode === "create" ? "Create business" : "Update password"}
              {mode === "change" ? <Check size={16} /> : <ArrowRight size={16} />}
            </>
          )}
        </button>

        {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

        {/* Change-password entry / back link */}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          {mode === "change"
            ? <button className="linkbtn" onClick={() => switchMode("login")}>← Back to log in</button>
            : <button className="linkbtn" onClick={() => switchMode("change")}>Change password</button>}
        </div>
      </div>
    </div>
  );
}



/* ------------------------------------------------------------------ */
/*  Theme → CSS variables                                              */
/* ------------------------------------------------------------------ */
const VARS = {
  dark: {
    "--bg": "#07090c", "--bg2": "#0d1016",
    "--surface": "#0f1318", "--surface-2": "#161b22", "--elev": "#1b212a",
    "--border": "rgba(255,255,255,0.08)", "--border-2": "rgba(255,255,255,0.13)",
    "--text": "#eef2f7", "--muted": "#98a3b2", "--faint": "#616d7d",
    "--accent": "#2dd4bf", "--accent-2": "#34d399", "--accent-contrast": "#04211d",
    "--accent-soft": "rgba(45,212,191,0.12)", "--ring": "rgba(45,212,191,0.30)",
    "--glass": "rgba(11,14,19,0.72)",
    "--shadow": "0 1px 2px rgba(0,0,0,0.5)", "--shadow-lg": "0 18px 50px rgba(0,0,0,0.55)",
    "--chat-ai": "#171d25", "--chat-ai-text": "#bcc6d2", "--call": "#34d399",
  },
  light: {
    "--bg": "#f4f6f8", "--bg2": "#eceff3",
    "--surface": "#ffffff", "--surface-2": "#f5f7fa", "--elev": "#ffffff",
    "--border": "rgba(15,23,42,0.08)", "--border-2": "rgba(15,23,42,0.14)",
    "--text": "#0b1220", "--muted": "#586472", "--faint": "#95a0ad",
    "--accent": "#0d9488", "--accent-2": "#0f766e", "--accent-contrast": "#ffffff",
    "--accent-soft": "rgba(13,148,136,0.10)", "--ring": "rgba(13,148,136,0.22)",
    "--glass": "rgba(255,255,255,0.72)",
    "--shadow": "0 1px 2px rgba(15,23,42,0.06)", "--shadow-lg": "0 20px 48px rgba(15,23,42,0.14)",
    "--chat-ai": "#eef2f7", "--chat-ai-text": "#475569", "--call": "#059669",
  },
};

const URGENCY = {
  emergency: { label: "Emergency", color: "#f43f5e" },
  soon: { label: "Soon", color: "#f59e0b" },
  flexible: { label: "Flexible", color: "#64748b" },
};

/* Google Maps JS API key. Client-side keys are public by design (they ship in
   the script URL) — protect it with HTTP-referrer restrictions in the Cloud
   Console, not by hiding it. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to override. */
const GOOGLE_MAPS_KEY =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) ||
  "AIzaSyAxDlmOdLBl7sDgbL-Z0Xsixlo9Oj5TKpI";
/* ------------------------------------------------------------------ */
/*  Lead data comes from GET /api/leads (see OwnerDashboard). Dates     */
/*  arrive as ISO strings over JSON and are rehydrated to Date objects  */
/*  on receipt so sorting and daysLeft() work.                          */
/* ------------------------------------------------------------------ */
const toDate = (v) => (v ? new Date(v) : null);
const hydrateLead = (l) => ({
  ...l,
  createdAt: toDate(l.createdAt),
  dismissedAt: toDate(l.dismissedAt),
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const fmtDT = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const daysLeft = (d) => Math.max(0, 30 - Math.floor((Date.now() - d.getTime()) / 86400000));
const digits = (p) => p.replace(/[^\d]/g, "");
const URANK = { emergency: 0, soon: 1, flexible: 2 };
const hue = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return Math.abs(h) % 360; };
const initials = (s) => s.replace(/^The\s+/, "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const soft = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/* ------------------------------------------------------------------ */
/*  CSS                                                                */
/* ------------------------------------------------------------------ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
.app{font-family:'Inter',system-ui,-apple-system,sans-serif;color:var(--text);min-height:100vh;
  background:radial-gradient(1200px 620px at 50% -8%, var(--bg2), var(--bg)) fixed;-webkit-font-smoothing:antialiased;}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;}
.eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:600;}
.glass{background:var(--glass);backdrop-filter:saturate(180%) blur(18px);-webkit-backdrop-filter:saturate(180%) blur(18px);}
.brand-mark{background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 0 0 1px var(--border),0 8px 24px var(--ring);}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:22px;box-shadow:var(--shadow-lg);overflow:hidden;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);transition:transform .2s,box-shadow .2s,border-color .2s;}
.card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg);border-color:var(--border-2);}
.seg{display:inline-flex;gap:3px;padding:4px;background:var(--surface-2);border:1px solid var(--border);border-radius:14px;}
.seg-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border-radius:10px;font-size:13px;font-weight:600;color:var(--muted);transition:.18s;cursor:pointer;}
.seg-btn:hover{color:var(--text);}
.seg-btn.active{background:var(--surface);color:var(--text);box-shadow:var(--shadow);border:1px solid var(--border);}
.seg-count{font-size:11px;padding:1px 6px;border-radius:999px;background:var(--surface-2);color:var(--faint);}
.seg-btn.active .seg-count{background:var(--accent-soft);color:var(--accent);}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);color:var(--muted);border-radius:11px;transition:.18s;cursor:pointer;background:transparent;}
.icon-btn:hover{color:var(--text);border-color:var(--border-2);background:var(--surface-2);}
.row{display:flex;gap:13px;width:100%;text-align:left;padding:15px 16px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s;position:relative;}
.row:hover{background:var(--surface-2);}
.row.sel{background:var(--accent-soft);}
.row.sel:before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--accent);}
.avatar{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;flex-shrink:0;box-shadow:var(--shadow);}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;}
.btn-call{display:flex;align-items:center;justify-content:center;gap:8px;background:color-mix(in srgb,var(--call) 11%,transparent);color:var(--call);
  border:1px solid color-mix(in srgb,var(--call) 42%,transparent);font-weight:600;border-radius:13px;transition:.18s;cursor:pointer;}
.btn-call:hover{background:color-mix(in srgb,var(--call) 18%,transparent);border-color:color-mix(in srgb,var(--call) 68%,transparent);}
.btn-ghost{display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--border-2);color:var(--text);font-weight:600;border-radius:13px;transition:.18s;cursor:pointer;background:transparent;}
.btn-ghost:hover{background:var(--surface-2);}
.ai-card{background:linear-gradient(135deg,var(--accent-soft),transparent 70%);border:1px solid var(--border);border-radius:16px;}
.bubble{max-width:84%;padding:9px 13px;font-size:13px;line-height:1.45;border-radius:16px;}
.bubble.ai{background:var(--chat-ai);color:var(--chat-ai-text);border-top-left-radius:5px;}
.bubble.me{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--accent-contrast);border-top-right-radius:5px;font-weight:500;}
.status-btn{flex:1;padding:9px;border-radius:11px;font-size:13px;font-weight:600;transition:.16s;cursor:pointer;}
.map-wrap{position:relative;border-radius:22px;overflow:hidden;border:1px solid var(--border);box-shadow:var(--shadow-lg);background:#0a0e14;}
.leaflet-container{font-family:'Inter',sans-serif;background:var(--map-bg,#0a0e14);}
.pin-wrap{background:none;border:none;}
.pin-marker{width:15px;height:15px;border-radius:50%;background:var(--pc);border:3px solid #fff;
  box-shadow:0 0 0 4px color-mix(in srgb,var(--pc) 32%,transparent),0 2px 7px rgba(0,0,0,.5);transition:transform .2s;}
.pin-pulse{animation:pinpulse 2.2s ease-out infinite;}
@keyframes pinpulse{0%{box-shadow:0 0 0 4px color-mix(in srgb,var(--pc) 40%,transparent),0 0 0 0 color-mix(in srgb,var(--pc) 55%,transparent);}
  70%{box-shadow:0 0 0 4px color-mix(in srgb,var(--pc) 30%,transparent),0 0 0 16px transparent;}
  100%{box-shadow:0 0 0 4px color-mix(in srgb,var(--pc) 40%,transparent),0 0 0 0 transparent;}}
.leaflet-tooltip.pin-tip{background:var(--surface);color:var(--text);border:1px solid var(--border-2);border-radius:8px;
  box-shadow:var(--shadow-lg);font-weight:700;font-size:12px;padding:4px 9px;}
.leaflet-tooltip.pin-tip:before{display:none;}
.leaflet-bar a{background:var(--surface);color:var(--text);border-color:var(--border)!important;}
.leaflet-bar a:hover{background:var(--surface-2);}
.leaflet-control-attribution{background:var(--glass)!important;color:var(--faint)!important;font-size:9px;}
.leaflet-control-attribution a{color:var(--muted)!important;}
.radar-sweep{position:absolute;inset:0;background:conic-gradient(from 0deg,transparent 0deg,rgba(45,212,191,.20) 28deg,transparent 60deg);
  -webkit-mask:radial-gradient(circle at 50% 50%,#000 0%,#000 52%,transparent 70%);mask:radial-gradient(circle at 50% 50%,#000 0%,#000 52%,transparent 70%);
  animation:sweep 8s linear infinite;pointer-events:none;}
.view-enter{animation:fadeUp .4s cubic-bezier(.2,.7,.2,1) both;}
@keyframes sweep{to{transform:rotate(360deg);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion:reduce){.radar-sweep{animation:none;}.view-enter{animation:none;}}
::-webkit-scrollbar{width:9px;height:9px;}::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:9px;}::-webkit-scrollbar-track{background:transparent;}
.in-row{display:flex;align-items:center;border:1px solid var(--border-2);border-radius:13px;padding:11px 13px;background:var(--surface-2);transition:.16s;}
.in-row:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--ring);}
.pw-in{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-size:14px;font-family:'Inter',sans-serif;}
.pw-in::placeholder{color:var(--faint);}
`;

/* ------------------------------------------------------------------ */
/*  Pieces                                                             */
/* ------------------------------------------------------------------ */
const Avatar = ({ name }) => (
  <div className="avatar" style={{ background: `linear-gradient(135deg, hsl(${hue(name)} 62% 52%), hsl(${(hue(name) + 36) % 360} 62% 42%))` }}>
    {initials(name)}
  </div>
);

const UrgencyPill = ({ urgency }) => {
  const u = URGENCY[urgency];
  return <span className="pill" style={{ background: soft(u.color, 14), color: u.color, border: `1px solid ${soft(u.color, 26)}` }}><span className="dot" style={{ background: u.color }} />{u.label}</span>;
};

function LeadRow({ lead, selected, onClick }) {
  return (
    <button className={`row ${selected ? "sel" : ""}`} onClick={onClick}>
      <Avatar name={lead.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[15px] font-bold tracking-tight">{lead.name}</span>
          <span className="mono shrink-0 text-[11px]" style={{ color: "var(--faint)" }}>{fmtDT(lead.createdAt)}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug" style={{ color: "var(--muted)" }}>{lead.summary}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <UrgencyPill urgency={lead.urgency} />
          {lead.needsReview && (
            <span className="pill" style={{ background: soft("#f59e0b", 14), color: "#f59e0b", border: `1px solid ${soft("#f59e0b", 26)}` }}>
              Needs info
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--faint)" }}><MapPin size={11} /><span className="truncate">{lead.address.split(",").slice(-2).join(",").trim()}</span></span>
        </div>
      </div>
    </button>
  );
}

function Detail({ lead, onClose, onDismiss, onRestore, onStatus, dismissed }) {
  const u = URGENCY[lead.urgency];
  const vehicle = [lead.vehicleYear, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" ");
  return (
    <div className="flex h-full flex-col w-full">
      <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex min-w-0 items-center gap-3">
          <button className={`icon-btn p-1.5 ${dismissed ? "" : "lg:hidden"}`} onClick={onClose}><ArrowLeft size={18} /></button>
          <Avatar name={lead.name} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold tracking-tight">{lead.name}</h2>
            <div className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: "var(--faint)" }}>
              <span className="pill" style={{ background: soft(u.color, 14), color: u.color, padding: "1px 7px" }}><span className="dot" style={{ background: u.color }} />{u.label}</span>
              <span className="mono">{fmtDT(lead.createdAt)}</span>
            </div>
          </div>
        </div>
        {!dismissed && <button className="icon-btn hidden p-1.5 lg:flex" onClick={onClose}><X size={18} /></button>}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-2 gap-2.5">
          <a className="btn-call py-3 text-sm" href={`tel:${digits(lead.phone)}`}><Phone size={16} /> Call</a>
          <a className="btn-ghost py-3 text-sm" href={`sms:${digits(lead.phone)}`}><MessageCircle size={16} /> Text</a>
        </div>

        <div className="mt-5 grid gap-3">
          <Field label="Phone"><span className="mono text-sm">{lead.phone}</span></Field>
          <Field label="Vehicle location" icon={<MapPin size={13} style={{ color: "var(--faint)" }} />}>
            <a className="text-sm hover:underline" style={{ color: "var(--text)" }} target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}>{lead.address}</a>
          </Field>
          {vehicle && (
            <Field label="Vehicle"><span className="text-sm">{vehicle}</span></Field>
          )}
          <Field label="Best callback" icon={<Clock size={13} style={{ color: "var(--faint)" }} />}><span className="text-sm">{lead.callback}</span></Field>
        </div>

        {!dismissed && onStatus && (
          <div className="mt-5">
            <div className="eyebrow mb-2" style={{ color: "var(--faint)" }}>Status</div>
            <div className="flex gap-2">
              {["new", "contacted", "scheduled"].map((s) => {
                const active = lead.status === s;
                return (
                  <button key={s} className="status-btn" onClick={() => onStatus(lead.id, s)}
                    style={active
                      ? { background: "var(--accent)", color: "var(--accent-contrast)", border: "1px solid var(--accent)" }
                      : { background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="ai-card mt-5 px-4 py-3.5">
          <div className="eyebrow mb-2 flex items-center gap-1.5" style={{ color: "var(--accent)" }}><Sparkles size={12} /> What the AI gathered</div>
          <p className="text-sm leading-relaxed">{lead.summary}</p>
        </div>

        <div className="mt-5">
          <div className="eyebrow mb-2.5" style={{ color: "var(--faint)" }}>Full conversation</div>
          <div className="space-y-2">
            {lead.convo.map((t, i) => (
              <div key={i} className={`flex ${t.who === "ai" ? "justify-start" : "justify-end"}`}>
                <div className={`bubble ${t.who === "ai" ? "ai" : "me"}`}>{t.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
        {dismissed ? (
          <div className="flex items-center gap-3">
            <span className="mono flex-1 text-[11px] leading-snug" style={{ color: "var(--faint)" }}>
              Dismissed {fmtDT(lead.dismissedAt)} · deletes in {daysLeft(lead.dismissedAt)}d
            </span>
            <button className="px-4 py-2.5 text-sm font-bold flex items-center gap-2 rounded-[13px]" onClick={() => onRestore(lead.id)} style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}><RotateCcw size={15} /> Restore</button>
          </div>
        ) : (
          <button className="btn-ghost w-full py-3 text-sm" onClick={() => onDismiss(lead.id)} style={{ color: "var(--muted)" }}><Archive size={16} /> Dismiss — I reached out</button>
        )}
      </div>
    </div>
  );
}

const Field = ({ label, icon, children }) => (
  <div>
    <div className="eyebrow" style={{ color: "var(--faint)" }}>{label}</div>
    <div className="mt-1 flex items-center gap-1.5">{icon}{children}</div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Map                                                                */
/* ------------------------------------------------------------------ */
// Map styling that matches the app's dark / light themes.
const MAP_DARK = [
  { elementType: "geometry", stylers: [{ color: "#0e1116" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0e1116" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a94a3" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a323d" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#12161c" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#222a35" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9aa6b4" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c3744" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0e14" }] },
];
const MAP_LIGHT = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// Circular pin as an SVG data-URI icon, color-coded by urgency.
function pinIcon(color, selected) {
  const size = selected ? 40 : 30;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 30 30">` +
    `<circle cx="15" cy="15" r="9" fill="${color}" stroke="#ffffff" stroke-width="3"/>` +
    `</svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  };
}

function MapView({ leads, selectedId, onSelect, theme }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [status, setStatus] = useState(
    typeof window !== "undefined" && window.google && window.google.maps ? "ready" : "loading"
  );

  // load the google maps js api once
  useEffect(() => {
    if (window.google && window.google.maps) { setStatus("ready"); return; }
    // google fires this on auth / billing / key-restriction failures
    window.gm_authFailure = () => setStatus("error");
    const existing = document.getElementById("gmaps-js");
    if (existing) {
      existing.addEventListener("load", () => setStatus("ready"));
      existing.addEventListener("error", () => setStatus("error"));
      return;
    }
    const s = document.createElement("script");
    s.id = "gmaps-js";
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&v=weekly`;
    s.onload = () => setStatus("ready");
    s.onerror = () => setStatus("error");
    document.head.appendChild(s);
  }, []);

  // init map
  useEffect(() => {
    if (status !== "ready" || !elRef.current || mapRef.current) return;
    const g = window.google;
    mapRef.current = new g.maps.Map(elRef.current, {
      center: { lat: 34.07, lng: -84.45 },
      zoom: 10,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      clickableIcons: false,
      styles: theme === "dark" ? MAP_DARK : MAP_LIGHT,
    });
    // Theme is applied here once; a separate effect restyles on theme flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // restyle on theme flip
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    mapRef.current.setOptions({ styles: theme === "dark" ? MAP_DARK : MAP_LIGHT });
  }, [theme, status]);

  // (re)build markers + fit bounds when the lead set changes
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const g = window.google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const bounds = new g.maps.LatLngBounds();
    // Skip leads we couldn't geocode — they have no pin (still shown in the list).
    const mappable = leads.filter((l) => l.lat != null && l.lng != null);
    mappable.forEach((l) => {
      const u = URGENCY[l.urgency];
      const mk = new g.maps.Marker({
        position: { lat: l.lat, lng: l.lng },
        map: mapRef.current,
        title: l.name,
        icon: pinIcon(u.color, false),
      });
      mk.__leadId = l.id;
      mk.__color = u.color;
      mk.addListener("click", () => onSelect(l.id));
      markersRef.current.push(mk);
      bounds.extend({ lat: l.lat, lng: l.lng });
    });
    if (mappable.length) {
      mapRef.current.fitBounds(bounds, 64);
      g.maps.event.addListenerOnce(mapRef.current, "idle", () => {
        if (mapRef.current.getZoom() > 12) mapRef.current.setZoom(12);
      });
    }
    // onSelect is a stable setState updater from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, status]);

  // highlight the selected pin without refitting the map
  useEffect(() => {
    if (status !== "ready") return;
    markersRef.current.forEach((mk) => {
      const sel = mk.__leadId === selectedId;
      mk.setIcon(pinIcon(mk.__color, sel));
      mk.setZIndex(sel ? 1000 : 1);
    });
  }, [selectedId, status, leads]);

  return (
    <div className="view-enter px-4 pb-6 pt-1">
      <div className="map-wrap">
        <div ref={elRef} style={{ height: "62vh", minHeight: 380, maxHeight: 580, width: "100%", background: "var(--map-bg, #0a0e14)" }} />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--faint)", background: "var(--surface)" }}>
            <span className="eyebrow">Loading map…</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
            <span className="text-sm">Map couldn&apos;t load. Check that the Maps JavaScript API is enabled, billing is on, and this domain is allowed in the key&apos;s referrer restrictions.</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4 px-4 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
          {Object.values(URGENCY).map((u) => <span key={u.label} className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--muted)" }}><span className="dot" style={{ background: u.color }} />{u.label}</span>)}
          <span className="mono ml-auto text-[11px]" style={{ color: "var(--faint)" }}>{leads.filter((l) => l.lat != null && l.lng != null).length} of {leads.length} on map · tap a pin</span>
        </div>
      </div>

      {selectedId && (() => {
        const l = leads.find((x) => x.id === selectedId);
        if (!l) return null;
        return (
          <div className="card mt-3 flex items-center gap-3 p-4">
            <Avatar name={l.name} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold tracking-tight">{l.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--faint)" }}><MapPin size={11} />{l.address}</div>
              <div className="mono mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>{l.phone}</div>
            </div>
            <a className="btn-call px-4 py-2.5 text-sm" href={`tel:${digits(l.phone)}`}><Phone size={15} /> Call</a>
          </div>
        );
      })()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dismissed                                                          */
/* ------------------------------------------------------------------ */
function DismissedView({ leads, onRestore, onOpen }) {
  if (!leads.length) return (
    <div className="view-enter px-6 py-24 text-center">
      <Archive size={26} className="mx-auto" style={{ color: "var(--faint)" }} />
      <p className="mt-3 text-sm font-semibold" style={{ color: "var(--muted)" }}>No dismissed customers</p>
      <p className="mt-1 text-xs" style={{ color: "var(--faint)" }}>Dismissed leads land here and auto-clear after 30 days.</p>
    </div>
  );
  return (
    <div className="view-enter grid gap-3 p-4 sm:grid-cols-2">
      {leads.map((l) => (
        <div key={l.id} className="card overflow-hidden">
          <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => onOpen(l.id)}>
            <Avatar name={l.name} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold tracking-tight">{l.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--faint)" }}><MapPin size={11} />{l.address}</div>
              <p className="mt-1.5 line-clamp-1 text-[12px]" style={{ color: "var(--muted)" }}>{l.summary}</p>
              {l.dismissedBy && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                  <Check size={11} /> {l.dismissedBy} took care of it
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="pill" style={{ background: "var(--surface-2)", color: "var(--faint)", border: "1px solid var(--border)" }}>{daysLeft(l.dismissedAt)}d left</span>
              <ChevronRight size={15} style={{ color: "var(--faint)" }} />
            </div>
          </button>
          <div className="mx-4 flex items-center justify-between gap-2 py-3" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="mono flex items-center gap-1.5 text-[11px]" style={{ color: "var(--faint)" }}><Clock size={11} /> {fmtDT(l.dismissedAt)}</span>
            <div className="flex gap-2">
              <a className="btn-ghost px-3 py-1.5 text-xs" href={`tel:${digits(l.phone)}`}>Call</a>
              <button className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 rounded-[11px]" onClick={() => onRestore(l.id)} style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}><RotateCcw size={12} /> Restore</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Team — roster, with manager-only promote / remove                  */
/* ------------------------------------------------------------------ */
function TeamView({ members, currentUser, onPromote, onRemove }) {
  const isManager = currentUser?.role === "manager";
  const sorted = [...members].sort((a, b) =>
    (a.role === "manager" ? 0 : 1) - (b.role === "manager" ? 0 : 1) || a.name.localeCompare(b.name)
  );

  return (
    <div className="view-enter p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="eyebrow" style={{ color: "var(--faint)" }}>{members.length} on the team</div>
        {isManager && <div className="eyebrow flex items-center gap-1.5" style={{ color: "var(--accent)" }}><Crown size={12} /> You manage this team</div>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((m) => {
          const isMe = normalizeCompany(m.name) === normalizeCompany(currentUser?.name || "");
          const isMgr = m.role === "manager";
          return (
            <div key={m.name} className="card flex items-center gap-3 p-4">
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-bold tracking-tight">{m.name}</span>
                  {isMe && <span className="pill" style={{ background: "var(--surface-2)", color: "var(--faint)", border: "1px solid var(--border)", padding: "1px 7px" }}>You</span>}
                </div>
                <div className="mt-0.5">
                  <span className="pill" style={isMgr
                    ? { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-soft)", padding: "1px 8px" }
                    : { background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)", padding: "1px 8px" }}>
                    {isMgr ? <Crown size={11} /> : <User size={11} />}{isMgr ? "Manager" : "User"}
                  </span>
                </div>
              </div>
              {isManager && !isMe && (
                <div className="flex shrink-0 gap-2">
                  {!isMgr && (
                    <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => onPromote && onPromote(m.name)} title="Promote to manager">
                      <Crown size={13} /> Promote
                    </button>
                  )}
                  <button className="px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 rounded-[11px]"
                    onClick={() => { if (window.confirm(`Remove ${m.name} forever? They won't be able to log back in.`)) onRemove && onRemove(m.name); }}
                    style={{ background: soft("#f43f5e", 13), color: "#f43f5e", border: `1px solid ${soft("#f43f5e", 28)}` }} title="Remove forever">
                    <UserMinus size={13} /> Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!isManager && (
        <p className="mt-4 text-center text-[12px]" style={{ color: "var(--faint)" }}>
          Only a manager can promote teammates or remove them.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
function OwnerDashboard({
  businessName = "Summit Air Solutions",
  currentUser = { name: "You", role: "manager" },
  members = [],
  onChangePassword, onLogout, onPromote, onRemove,
} = {}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [view, setView] = useState("leads");
  const [selectedId, setSelectedId] = useState(null);
  const [openDismissedId, setOpenDismissedId] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);

  // Load real leads from the API on mount (replaces the old SEED array).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/leads");
        const data = await res.json();
        if (!alive) return;
        if (data.ok) setLeads(data.leads.map(hydrateLead));
        else setLoadError(data.error || "Could not load leads.");
      } catch {
        if (alive) setLoadError("Could not load leads.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Mutations update local state optimistically, then persist via PATCH.
  const patch = (id, body) =>
    fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});

  const dismiss = (id) => {
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, dismissedAt: new Date(), dismissedBy: currentUser?.name } : l)));
    setSelectedId(null);
    patch(id, { dismissedAt: new Date().toISOString(), dismissedBy: currentUser?.name ?? null });
  };
  const restore = (id) => {
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, dismissedAt: null, dismissedBy: null } : l)));
    setOpenDismissedId(null);
    patch(id, { dismissedAt: null });
  };
  const changeStatus = (id, status) => {
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, status } : l)));
    patch(id, { status });
  };

  const active = useMemo(() => leads.filter((l) => !l.dismissedAt).sort((a, b) => (URANK[a.urgency] - URANK[b.urgency]) || (b.createdAt - a.createdAt)), [leads]);
  const dismissed = useMemo(() => leads.filter((l) => l.dismissedAt && daysLeft(l.dismissedAt) > 0).sort((a, b) => b.dismissedAt - a.dismissedAt), [leads]);
  const urgentCount = active.filter((l) => l.urgency === "emergency").length;
  const selected = active.find((l) => l.id === selectedId) || null;
  const openDismissed = dismissed.find((l) => l.id === openDismissedId) || null;

  const TABS = [
    { key: "leads", label: "Leads", Icon: List, n: active.length },
    { key: "map", label: "Map", Icon: MapIcon },
    { key: "dismissed", label: "Dismissed", Icon: Archive, n: dismissed.length },
    { key: "team", label: "Team", Icon: Users, n: members.length },
  ];

  return (
    <div className="app" style={VARS[theme]}>
      <style>{CSS}</style>
      <div className="mx-auto max-w-5xl px-4">
        {/* header */}
        <header className="glass sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl text-sm font-extrabold" style={{ color: "var(--accent-contrast)" }}>SA</div>
            <div>
              <div className="text-[15px] font-extrabold leading-tight tracking-tight">{businessName}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="icon-btn h-9 w-9" onClick={() => setPwOpen(true)} aria-label="Change password" title="Change password"><KeyRound size={17} /></button>
            <button className="icon-btn h-9 w-9" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme" title="Toggle theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button className="icon-btn h-9 px-3 gap-1.5 text-[13px] font-semibold" onClick={() => onLogout && onLogout()} aria-label="Log out" title="Log out"><LogOut size={16} /> Log out</button>
          </div>
        </header>

        {/* tabs + urgent */}
        <div className="flex flex-wrap items-center gap-3 py-4">
          <div className="seg">
            {TABS.map((t) => (
              <button key={t.key} className={`seg-btn ${view === t.key ? "active" : ""}`} onClick={() => { setView(t.key); setSelectedId(null); setOpenDismissedId(null); }}>
                <t.Icon size={15} /> {t.label}{t.n != null && <span className="seg-count">{t.n}</span>}
              </button>
            ))}
          </div>
          {urgentCount > 0 && view !== "dismissed" && (
            <div className="pill ml-auto" style={{ background: soft("#f43f5e", 13), color: "#f43f5e", border: `1px solid ${soft("#f43f5e", 28)}`, padding: "6px 12px", fontSize: 12 }}>
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" /></span>
              {urgentCount} emergency — call first
            </div>
          )}
        </div>

        {/* content */}
        {view === "leads" && (
          <div className="panel view-enter mb-8">
            <div className="flex">
              <div className={`min-w-0 ${selected ? "hidden lg:block lg:w-[392px] lg:shrink-0" : "w-full"}`} style={{ borderRight: selected ? "1px solid var(--border)" : "none" }}>
                {loading ? (
                  <div className="px-6 py-24 text-center"><span className="eyebrow" style={{ color: "var(--faint)" }}>Loading leads…</span></div>
                ) : loadError ? (
                  <div className="px-6 py-24 text-center"><p className="text-sm font-semibold" style={{ color: "#f43f5e" }}>{loadError}</p></div>
                ) : active.length === 0 ? (
                  <div className="px-6 py-24 text-center"><Check size={26} className="mx-auto" style={{ color: "var(--faint)" }} /><p className="mt-3 text-sm font-semibold" style={{ color: "var(--muted)" }}>All caught up</p></div>
                ) : active.map((l) => <LeadRow key={l.id} lead={l} selected={l.id === selectedId} onClick={() => setSelectedId(l.id)} />)}
              </div>
              <div className={`min-w-0 flex-1 ${selected ? "block" : "hidden lg:block"}`}>
                {selected ? <Detail lead={selected} onClose={() => setSelectedId(null)} onDismiss={dismiss} onStatus={changeStatus} />
                  : <div className="hidden h-full flex-col items-center justify-center gap-3 py-28 text-center lg:flex">
                      <div className="ai-card flex h-12 w-12 items-center justify-center" style={{ color: "var(--accent)" }}><Sparkles size={22} /></div>
                      <p className="text-sm" style={{ color: "var(--muted)" }}>Select a lead to see what the AI captured</p>
                    </div>}
              </div>
            </div>
          </div>
        )}
        {view === "map" && <MapView leads={active} selectedId={selectedId} onSelect={setSelectedId} theme={theme} />}
        {view === "dismissed" && (
          openDismissed
            ? <div className="panel view-enter mb-8" style={{ height: "min(72vh, 760px)", display: "flex" }}>
                <Detail lead={openDismissed} dismissed onClose={() => setOpenDismissedId(null)} onRestore={restore} />
              </div>
            : <DismissedView leads={dismissed} onRestore={restore} onOpen={setOpenDismissedId} />
        )}
        {view === "team" && (
          <TeamView members={members} currentUser={currentUser} onPromote={onPromote} onRemove={onRemove} />
        )}
      </div>
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} onChangePassword={onChangePassword} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Change password — one tap, already authenticated                   */
/* ------------------------------------------------------------------ */
function ChangePasswordModal({ onClose, onChangePassword }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr("");
    if (next.length < 8) return setErr("Use at least 8 characters.");
    if (next !== confirm) return setErr("Passwords don't match.");
    setBusy(true);
    try {
      // You're already logged in here, so the session proves who you are —
      // no current password needed. The server still re-checks the session.
      await (onChangePassword ?? (() => new Promise((r) => setTimeout(r, 500))))({ next });
      setOk(true);
      setTimeout(onClose, 900);
    } catch (e) {
      setErr(e?.message || "Couldn't update. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: "100%", maxWidth: 380, padding: 24 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><KeyRound size={17} /></div>
            <div className="text-[15px] font-extrabold tracking-tight">Change password</div>
          </div>
          <button className="icon-btn p-1.5" onClick={onClose}><X size={17} /></button>
        </div>

        {ok ? (
          <div className="mt-5 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--accent)" }}>
            <Check size={16} /> Password updated.
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3">
              <div className="in-row">
                <input className="pw-in" type={show ? "text" : "password"} value={next}
                  onChange={(e) => setNext(e.target.value)} placeholder="New password" autoFocus
                  onKeyDown={(e) => e.key === "Enter" && save()} />
              </div>
              <div className="in-row">
                <input className="pw-in" type={show ? "text" : "password"} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password"
                  onKeyDown={(e) => e.key === "Enter" && save()} />
              </div>
            </div>
            <button className="mt-2 text-[12px] font-semibold" style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"} passwords</button>
            {err && <div className="mt-2 text-[12px]" style={{ color: "#f43f5e" }}>{err}</div>}
            <button className="btn-call mt-4 w-full py-3 text-sm" onClick={save} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
              <Check size={16} /> {busy ? "Saving…" : "Save new password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}



/* ------------------------------------------------------------------ */
/*  App shell — decides whether to show the login page or the          */
/*  dashboard, and wires up login / signup / change-password / logout. */
/*                                                                     */
/*  This is a DEMO store kept in memory so the flow is clickable on    */
/*  its own. On your real build, replace each handler body with a      */
/*  fetch() to your API routes (see notes at the bottom) and read the  */
/*  session from an httpOnly cookie instead of useState.               */
/* ------------------------------------------------------------------ */

// Seed "database". Each company holds a member roster keyed by normalized name,
// each with a role ("manager" | "user"), plus a permanent `banned` list.
// passwordHash is plain text HERE only because there's no server in this demo.
// NEVER store a plain password in real life — hash with bcrypt/argon2 server-side.
const DEMO_DB = {
  [normalizeCompany("Summit Air Solutions")]: {
    name: "Summit Air Solutions",
    passwordHash: "password123",
    members: {
      [normalizeCompany("Sam Rivera")]: { name: "Sam Rivera", role: "manager" },
      [normalizeCompany("Alex Chen")]: { name: "Alex Chen", role: "user" },
    },
    banned: [],
  },
};

function App() {
  const [db, setDb] = useState(DEMO_DB);
  const [session, setSession] = useState(null); // { company, name, role } when logged in

  const businessNames = Object.values(db).map((b) => b.name);
  const company = session ? db[normalizeCompany(session.company)] : null;
  const members = company ? Object.values(company.members || {}) : [];

  // LOG IN ----------------------------------------------------------
  async function onLogin({ company, name, password }) {
    const key = normalizeCompany(company);
    const rec = db[key];
    // Vague error on purpose — don't reveal whether the company exists.
    if (!rec || rec.passwordHash !== password) {
      throw new Error("Company name or password is incorrect.");
    }
    const nameKey = normalizeCompany(name);
    if ((rec.banned || []).includes(nameKey)) {
      throw new Error("That name was removed by a manager and can't log in.");
    }
    // First time this name logs in → added as a plain user. Returning → keep role.
    const existing = rec.members?.[nameKey];
    const role = existing?.role || "user";
    if (!existing) {
      setDb((prev) => ({
        ...prev,
        [key]: { ...rec, members: { ...rec.members, [nameKey]: { name: name.trim(), role } } },
      }));
    }
    setSession({ company: rec.name, name: name.trim(), role });
    // Real version: POST /api/auth/login → verify hash + ban list, upsert member, set cookie.
  }

  // CREATE BUSINESS -------------------------------------------------
  async function onCreateBusiness({ name, company, password }) {
    const key = normalizeCompany(company);
    if (db[key]) throw new Error("That company name is already taken.");
    const nameKey = normalizeCompany(name);
    // The creator is the first manager.
    setDb((prev) => ({
      ...prev,
      [key]: {
        name: company, passwordHash: password,
        members: { [nameKey]: { name: name.trim(), role: "manager" } },
        banned: [],
      },
    }));
    setSession({ company, name: name.trim(), role: "manager" });
    // Real version: POST /api/auth/signup → hash password, insert Business + manager User.
  }

  // CHANGE PASSWORD (from login page — not authenticated) ------------
  async function onChangePasswordUnauthed({ company, current, next }) {
    const key = normalizeCompany(company);
    const rec = db[key];
    if (!rec || rec.passwordHash !== current) {
      throw new Error("Company name or current password is incorrect.");
    }
    setDb((prev) => ({ ...prev, [key]: { ...rec, passwordHash: next } }));
  }

  // CHANGE PASSWORD (inside dashboard — already authenticated) -------
  async function onChangePasswordAuthed({ next }) {
    const key = normalizeCompany(session.company);
    setDb((prev) => ({ ...prev, [key]: { ...prev[key], passwordHash: next } }));
  }

  // PROMOTE a member to manager (manager only) ----------------------
  async function onPromote(memberName) {
    if (session.role !== "manager") return;
    const key = normalizeCompany(session.company);
    const nameKey = normalizeCompany(memberName);
    setDb((prev) => {
      const c = prev[key];
      return { ...prev, [key]: { ...c, members: { ...c.members, [nameKey]: { ...c.members[nameKey], role: "manager" } } } };
    });
    // Real version: POST /api/team/promote — server re-checks caller is a manager.
  }

  // REMOVE a member forever (manager only) --------------------------
  async function onRemove(memberName) {
    if (session.role !== "manager") return;
    const key = normalizeCompany(session.company);
    const nameKey = normalizeCompany(memberName);
    setDb((prev) => {
      const c = prev[key];
      const nextMembers = { ...c.members };
      delete nextMembers[nameKey];
      return { ...prev, [key]: { ...c, members: nextMembers, banned: [...(c.banned || []), nameKey] } };
    });
    // Real version: POST /api/team/remove — delete the User row, add to a ban list,
    // and invalidate their active sessions.
  }

  // LOG OUT ---------------------------------------------------------
  function onLogout() {
    setSession(null);
  }

  if (!session) {
    return (
      <LoginPage
        existingBusinesses={businessNames}
        onLogin={onLogin}
        onCreateBusiness={onCreateBusiness}
        onChangePassword={onChangePasswordUnauthed}
      />
    );
  }

  return (
    <OwnerDashboard
      businessName={session.company}
      currentUser={{ name: session.name, role: session.role }}
      members={members}
      onChangePassword={onChangePasswordAuthed}
      onLogout={onLogout}
      onPromote={onPromote}
      onRemove={onRemove}
    />
  );
}

export default App;
