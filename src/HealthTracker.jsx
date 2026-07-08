import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

// ---------- داده‌های ثابت ----------
const HABITS = [
  { id: "sleep", label: "خواب ۷ تا ۸ ساعت", icon: "🌙" },
  { id: "sleepTime", label: "خواب و بیداری سرِ ساعت ثابت", icon: "⏰" },
  { id: "shower", label: "دوش بلافاصله بعد از تمرین", icon: "🚿" },
  { id: "water", label: "۸ لیوان آب", icon: "💧" },
  { id: "protein", label: "پروتئین در هر وعده", icon: "🍗" },
  { id: "veggies", label: "حداقل ۲ واحد میوه و سبزی", icon: "🥦" },
  { id: "noPhone", label: "بدون گوشی، ۱ ساعت قبل خواب", icon: "📵" },
];

const MEDICAL = [
  { id: "gp", label: "ویزیت پزشک عمومی برای معاینه زائده ناحیه مقعد", note: "مهم‌ترین قدم — فقط با معاینه حضوری مشخص می‌شود چیست" },
  { id: "spine", label: "مشاوره با جراح مغز و اعصاب / متخصص ستون فقرات", note: "درباره سابقه مننگومیلوسل و مجوز تمرین با وزنه سنگین" },
  { id: "derm", label: "ویزیت متخصص پوست برای جوش‌های کمر و صورت", note: "به‌خصوص اگر جوش‌ها شدید یا دردناک هستند" },
  { id: "labs", label: "آزمایش خون پایه", note: "CBC، قند ناشتا، پروفایل چربی، ویتامین D، تیروئید" },
];

const DAYS_KEY = "health-days-v2";
const MEDICAL_KEY = "health-medical";
const WEEKDAY_INITIALS = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // شنبه تا جمعه

// ---------- توابع تاریخ (تقویم فارسی از خود سیستم، همیشه دقیق) ----------
const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fa = (date, opts) => {
  try { return new Intl.DateTimeFormat("fa-IR", opts).format(date); }
  catch { return ""; }
};
const fromIso = (iso) => new Date(iso + "T12:00:00");
const faShort = (iso) => fa(fromIso(iso), { day: "numeric", month: "short" });

// هفته فارسی از شنبه شروع می‌شود
const persianWeekIndex = (d) => (d.getDay() + 1) % 7; // شنبه=۰ ... جمعه=۶

const sleepDuration = (bed, wake) => {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  if ([bh, bm, wh, wm].some((n) => Number.isNaN(n))) return null;
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60; // عبور از نیمه‌شب: مثلاً ۲۳:۰۰ تا ۰۷:۰۰
  return mins / 60;
};

const faNum = (n) => Number(n).toLocaleString("fa-IR", { maximumFractionDigits: 1 });

const formatDuration = (hours) => {
  if (hours == null) return null;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${faNum(h)} ساعت و ${faNum(m)} دقیقه` : `${faNum(h)} ساعت`;
};

const scoreOf = (entry) => {
  if (!entry || !entry.habits) return 0;
  const c = HABITS.filter((h) => entry.habits[h.id]).length;
  return Math.round((c / HABITS.length) * 100);
};

export default function HealthTracker() {
  const [days, setDays] = useState({});
  const [medical, setMedical] = useState({});
  const [draft, setDraft] = useState({ habits: {}, weight: "", bedTime: "", wakeTime: "" });
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [now, setNow] = useState(new Date());

  // هر دقیقه تاریخ را چک کن تا سرِ نیمه‌شب، اپ خودش برود روز بعد
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const today = isoDate(now);
  const todayEntry = days[today];
  const locked = !!(todayEntry && todayEntry.savedAt); // بعد از ثبت، امروز قفل می‌شود

  // ---------- بارگذاری از حافظه مرورگر ----------
  useEffect(() => {
    let loadedDays = {};
    try {
      const v = localStorage.getItem(DAYS_KEY);
      if (v) loadedDays = JSON.parse(v);
    } catch (e) { /* داده‌ای وجود ندارد */ }
    try {
      const v = localStorage.getItem(MEDICAL_KEY);
      if (v) setMedical(JSON.parse(v));
    } catch (e) { /* داده‌ای وجود ندارد */ }
    setDays(loadedDays);
    setLoading(false);
  }, []);

  // ---------- ثبت نهایی امروز ----------
  const saveToday = () => {
    if (locked) return;
    if (!confirming) { setConfirming(true); return; }
    const sh = sleepDuration(draft.bedTime, draft.wakeTime);
    const entry = {
      habits: draft.habits,
      weight: draft.weight === "" ? null : Number(draft.weight),
      bedTime: draft.bedTime || null,
      wakeTime: draft.wakeTime || null,
      sleepHours: sh,
      locked: true,
      savedAt: new Date().toISOString(),
    };
    const next = { ...days, [today]: entry };
    try {
      localStorage.setItem(DAYS_KEY, JSON.stringify(next));
      setDays(next);
      setConfirming(false);
      setMsg({ type: "ok", text: "امروز ثبت نهایی شد ✓ نمودار به‌روز شد — فردا ادامه بده." });
      setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setConfirming(false);
      setMsg({ type: "err", text: "ذخیره نشد — حافظه مرورگر در دسترس نیست. اگر در حالت Private هستی، از حالت عادی Safari استفاده کن." });
    }
  };

  const toggleMedical = (id) => {
    const next = { ...medical, [id]: !medical[id] };
    setMedical(next);
    try { localStorage.setItem(MEDICAL_KEY, JSON.stringify(next)); } catch (e) {}
  };

  const toggleHabit = (id) => {
    if (locked) return;
    setConfirming(false);
    setDraft((d) => ({ ...d, habits: { ...d.habits, [id]: !d.habits[id] } }));
  };

  const setField = (key, value) => {
    if (locked) return;
    setConfirming(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  // ---------- هفته جاری برای تقویم کوچک ----------
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - persianWeekIndex(now));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = isoDate(d);
    return {
      key,
      dayNum: fa(d, { day: "numeric" }),
      isToday: key === today,
      isFuture: key > today,
      saved: !!(days[key] && days[key].savedAt),
    };
  });

  // ---------- داده نمودار (سینک با روزهای ثبت‌شده) ----------
  const sortedDays = Object.keys(days).filter((k) => days[k] && days[k].savedAt).sort();
  const chartData = sortedDays.slice(-30).map((k) => ({
    date: faShort(k),
    score: scoreOf(days[k]),
    weight: days[k].weight ?? null,
    sleep: days[k].sleepHours != null ? Math.round(days[k].sleepHours * 10) / 10 : null,
  }));
  const hasWeight = chartData.filter((d) => d.weight != null).length >= 2;
  const hasSleep = chartData.filter((d) => d.sleep != null).length >= 2;

  const shownHabits = locked ? todayEntry.habits || {} : draft.habits;
  const doneCount = HABITS.filter((h) => shownHabits[h.id]).length;
  const pct = Math.round((doneCount / HABITS.length) * 100);
  const medicalDone = MEDICAL.filter((m) => medical[m.id]).length;
  const draftSleep = locked ? todayEntry.sleepHours : sleepDuration(draft.bedTime, draft.wakeTime);

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-500">
        در حال بارگذاری…
      </div>
    );
  }

  const R = 52;
  const CIRC = 2 * Math.PI * R;

  return (
    <div dir="rtl" className="min-h-screen bg-stone-50 text-stone-800 py-6 px-4" style={{ fontFamily: "-apple-system, Tahoma, 'Segoe UI', sans-serif" }}>
      <div className="max-w-md mx-auto">

        {/* تقویم کوچک بالای اپ */}
        <section className="bg-teal-700 text-white rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/15 rounded-xl px-4 py-2 text-center flex-shrink-0">
              <div className="text-3xl font-bold leading-none">{fa(now, { day: "numeric" })}</div>
              <div className="text-xs mt-1 opacity-90">{fa(now, { month: "long" })}</div>
            </div>
            <div>
              <div className="font-bold text-lg">{fa(now, { weekday: "long" })}</div>
              <div className="text-sm opacity-90">{fa(now, { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
          </div>
          {/* نوار هفته: شنبه تا جمعه */}
          <div className="flex justify-between mt-4">
            {week.map((d, i) => (
              <div key={d.key} className="flex flex-col items-center gap-1">
                <span className="text-xs opacity-75">{WEEKDAY_INITIALS[i]}</span>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  d.isToday ? "bg-white text-teal-700 font-bold"
                  : d.saved ? "bg-teal-500 text-white"
                  : d.isFuture ? "text-white/40"
                  : "bg-white/10 text-white/70"
                }`}>
                  {d.saved && !d.isToday ? "✓" : d.dayNum}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* پیام وضعیت */}
        {msg && (
          <div className={`rounded-xl px-4 py-3 mb-4 text-sm leading-6 ${msg.type === "ok" ? "bg-teal-50 text-teal-800 border border-teal-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {msg.text}
          </div>
        )}

        {/* وضعیت قفل امروز */}
        {locked && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm leading-6 bg-stone-100 border border-stone-200 text-stone-600">
            🔒 داده امروز ثبت نهایی شده و قابل تغییر نیست. فردا روز جدید باز می‌شود.
          </div>
        )}

        {/* امتیاز امروز */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 mb-4 flex items-center gap-5">
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r={R} fill="none" stroke="#e7e5e4" strokeWidth="10" />
              <circle cx="60" cy="60" r={R} fill="none" stroke="#14b8a6" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
                style={{ transition: "stroke-dashoffset 0.5s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-teal-700">{faNum(pct)}٪</span>
              <span className="text-xs text-stone-400">امروز</span>
            </div>
          </div>
          <div className="text-sm text-stone-600 leading-6">
            <p className="font-semibold text-stone-800">{faNum(doneCount)} از {faNum(HABITS.length)} عادت</p>
            <p className="mt-1">{locked ? "ثبت نهایی شده ✓" : "بعد از تکمیل، دکمه ثبت نهایی را بزن"}</p>
          </div>
        </section>

        {/* خواب و وزن */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 mb-4">
          <h2 className="font-bold text-teal-800 mb-3">خواب و وزن امروز</h2>
          <div className="flex gap-3 mb-3">
            <label className="flex-1 min-w-0">
              <span className="block text-xs text-stone-500 mb-1">ساعت خوابیدن 🌙</span>
              <input type="time" disabled={locked}
                value={locked ? (todayEntry.bedTime || "") : draft.bedTime}
                onChange={(e) => setField("bedTime", e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-teal-400 disabled:bg-stone-100 disabled:text-stone-400" />
            </label>
            <label className="flex-1 min-w-0">
              <span className="block text-xs text-stone-500 mb-1">ساعت بیدار شدن ☀️</span>
              <input type="time" disabled={locked}
                value={locked ? (todayEntry.wakeTime || "") : draft.wakeTime}
                onChange={(e) => setField("wakeTime", e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-teal-400 disabled:bg-stone-100 disabled:text-stone-400" />
            </label>
          </div>
          {draftSleep != null && (
            <div className="text-xs bg-teal-50 text-teal-800 rounded-lg px-3 py-2 mb-3">
              مدت خواب: <b>{formatDuration(draftSleep)}</b>
              {draftSleep < 6 && " — کمتر از حد سالم 😴"}
              {draftSleep >= 7 && draftSleep <= 9 && " — عالی ✓"}
            </div>
          )}
          <p className="text-xs text-stone-400 leading-5 mb-3">
            ساعت را دقیق انتخاب کن — سیستم خودش شب و صبح را می‌فهمد. مثلاً خواب ۲۳:۰۰ و بیداری ۰۷:۰۰ یعنی ۸ ساعت؛ خواب ۰۴:۰۰ صبح و بیداری ۱۲:۰۰ ظهر هم ۸ ساعت.
          </p>
          <label className="block">
            <span className="block text-xs text-stone-500 mb-1">وزن (کیلوگرم) ⚖️</span>
            <input type="number" inputMode="decimal" disabled={locked}
              value={locked ? (todayEntry.weight ?? "") : draft.weight}
              onChange={(e) => setField("weight", e.target.value)}
              placeholder="مثلاً 78.5"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-teal-400 disabled:bg-stone-100 disabled:text-stone-400" />
          </label>
        </section>

        {/* عادت‌ها */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 mb-4">
          <h2 className="font-bold text-teal-800 mb-3">عادت‌های امروز</h2>
          <ul className="space-y-2">
            {HABITS.map((h) => {
              const done = !!shownHabits[h.id];
              return (
                <li key={h.id}>
                  <button onClick={() => toggleHabit(h.id)} disabled={locked}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-right transition ${
                      done ? "bg-teal-50 border-teal-300" : "bg-white border-stone-200"
                    } ${locked ? "opacity-70" : "hover:border-teal-200"}`}>
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-white text-sm flex-shrink-0 ${done ? "bg-teal-500 border-teal-500" : "border-stone-300"}`}>
                      {done ? "✓" : ""}
                    </span>
                    <span className="text-lg">{h.icon}</span>
                    <span className={`text-sm ${done ? "text-teal-800" : "text-stone-700"}`}>{h.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* دکمه ثبت نهایی */}
        {!locked && (
          <div className="mb-6">
            <button onClick={saveToday}
              className={`w-full rounded-2xl py-4 text-base font-bold text-white shadow-sm transition ${confirming ? "bg-amber-500 hover:bg-amber-600" : "bg-teal-600 hover:bg-teal-700"}`}>
              {confirming ? "مطمئنی؟ بعد از ثبت قابل تغییر نیست — تأیید نهایی ✓" : "ثبت نهایی امروز 💾"}
            </button>
            {confirming && (
              <button onClick={() => setConfirming(false)}
                className="w-full mt-2 rounded-2xl py-2 text-sm text-stone-500 bg-stone-100 hover:bg-stone-200">
                نه، هنوز کامل نشده
              </button>
            )}
          </div>
        )}

        {/* نمودار رشد */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 mb-4">
          <h2 className="font-bold text-teal-800 mb-1">نمودار رشد</h2>
          <p className="text-xs text-stone-400 mb-3">فقط روزهای ثبت‌نهایی‌شده — ۳۰ روز اخیر</p>
          {chartData.length < 2 ? (
            <div className="text-sm text-stone-500 bg-stone-50 rounded-xl p-4 leading-6">
              هنوز داده کافی نیست. از روز دومِ ثبت، خط رشدت اینجا شکل می‌گیرد. 📈
            </div>
          ) : (
            <div dir="ltr" className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}٪`, "امتیاز"]} />
                  <ReferenceLine y={50} stroke="#fbbf24" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="score" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {hasSleep && (
            <>
              <p className="text-xs text-stone-400 mt-4 mb-2">مدت خواب (ساعت) — خط سبز کم‌رنگ: هدف ۷ ساعت</p>
              <div dir="ltr" className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 12]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v} ساعت`, "خواب"]} />
                    <ReferenceLine y={7} stroke="#86efac" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="sleep" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {hasWeight && (
            <>
              <p className="text-xs text-stone-400 mt-4 mb-2">روند وزن (کیلوگرم)</p>
              <div dir="ltr" className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f0ef" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v} kg`, "وزن"]} />
                    <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>

        {/* اقدامات پزشکی */}
        <section className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-amber-800">اقدامات پزشکی (یک‌بار)</h2>
            <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-1">{faNum(medicalDone)} از {faNum(MEDICAL.length)}</span>
          </div>
          <p className="text-xs text-stone-500 mb-3 leading-5">اولویت اول — قبل از هر برنامه‌ای، این ویزیت‌ها را انجام بده.</p>
          <ul className="space-y-2">
            {MEDICAL.map((m) => {
              const done = !!medical[m.id];
              return (
                <li key={m.id}>
                  <button onClick={() => toggleMedical(m.id)}
                    className={`w-full flex items-start gap-3 rounded-xl border px-3 py-3 text-right transition ${done ? "bg-amber-50 border-amber-300" : "bg-white border-stone-200 hover:border-amber-200"}`}>
                    <span className={`w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center text-white text-sm flex-shrink-0 ${done ? "bg-amber-500 border-amber-500" : "border-stone-300"}`}>
                      {done ? "✓" : ""}
                    </span>
                    <span>
                      <span className={`block text-sm font-medium ${done ? "text-amber-900 line-through" : "text-stone-700"}`}>{m.label}</span>
                      <span className="block text-xs text-stone-400 mt-1 leading-5">{m.note}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="text-xs text-stone-400 text-center leading-6 pb-4">
          این ابزار جایگزین پزشک نیست — برای تشخیص و درمان حتماً به پزشک مراجعه کن.
        </footer>
      </div>
    </div>
  );
}
