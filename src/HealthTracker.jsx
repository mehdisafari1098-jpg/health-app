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

const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayIso = () => isoDate(new Date());

const faDate = (iso) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso + "T12:00:00"));
  } catch { return iso; }
};
const faShort = (iso) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" }).format(new Date(iso + "T12:00:00"));
  } catch { return iso.slice(5); }
};

const scoreOf = (entry) => {
  if (!entry || !entry.habits) return 0;
  const c = HABITS.filter((h) => entry.habits[h.id]).length;
  return Math.round((c / HABITS.length) * 100);
};

export default function HealthTracker() {
  const [days, setDays] = useState({});
  const [medical, setMedical] = useState({});
  const [draft, setDraft] = useState({ habits: {}, weight: "", sleepHours: "" });
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null); // {type: "ok"|"err", text}

  const today = todayIso();

  // ---------- بارگذاری (از حافظه مرورگر) ----------
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
    const t = loadedDays[today];
    if (t) {
      setDraft({
        habits: t.habits || {},
        weight: t.weight ?? "",
        sleepHours: t.sleepHours ?? "",
      });
    }
    setLoading(false);
  }, []);

  // ---------- ذخیره (در حافظه مرورگر) ----------
  const saveToday = () => {
    const entry = {
      habits: draft.habits,
      weight: draft.weight === "" ? null : Number(draft.weight),
      sleepHours: draft.sleepHours === "" ? null : Number(draft.sleepHours),
      savedAt: new Date().toISOString(),
    };
    const next = { ...days, [today]: entry };
    try {
      localStorage.setItem(DAYS_KEY, JSON.stringify(next));
      setDays(next);
      setDirty(false);
      setMsg({ type: "ok", text: "ثبت شد ✓ فردا برگرد و نمودارت را ببین" });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({
        type: "err",
        text: "ذخیره نشد — حافظه مرورگر در دسترس نیست. اگر در حالت Private هستی، از حالت عادی Safari استفاده کن.",
      });
    }
  };

  const toggleMedical = (id) => {
    const next = { ...medical, [id]: !medical[id] };
    setMedical(next);
    try {
      localStorage.setItem(MEDICAL_KEY, JSON.stringify(next));
    } catch (e) { /* در ذخیره روزانه پیام خطا نمایش داده می‌شود */ }
  };

  const toggleHabit = (id) => {
    setDraft((d) => ({ ...d, habits: { ...d.habits, [id]: !d.habits[id] } }));
    setDirty(true);
  };

  // ---------- داده نمودار ----------
  const sortedDays = Object.keys(days).sort();
  const chartData = sortedDays.slice(-30).map((k) => ({
    date: faShort(k),
    score: scoreOf(days[k]),
    weight: days[k].weight ?? null,
  }));
  const hasWeight = chartData.some((d) => d.weight != null);

  const doneCount = HABITS.filter((h) => draft.habits[h.id]).length;
  const pct = Math.round((doneCount / HABITS.length) * 100);
  const medicalDone = MEDICAL.filter((m) => medical[m.id]).length;

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
    <div dir="rtl" className="min-h-screen bg-stone-50 text-stone-800 py-8 px-4" style={{ fontFamily: "Tahoma, 'Segoe UI', sans-serif" }}>
      <div className="max-w-md mx-auto">
        {/* سربرگ */}
        <header className="mb-5">
          <h1 className="text-2xl font-bold text-teal-800">سیستم رشد و سلامت من</h1>
          <p className="text-sm text-stone-500 mt-1">{faDate(today)}</p>
        </header>

        {/* پیام وضعیت */}
        {msg && (
          <div className={`rounded-xl px-4 py-3 mb-4 text-sm leading-6 ${msg.type === "ok" ? "bg-teal-50 text-teal-800 border border-teal-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {msg.text}
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
              <span className="text-2xl font-bold text-teal-700">{pct}٪</span>
              <span className="text-xs text-stone-400">امروز</span>
            </div>
          </div>
          <div className="text-sm text-stone-600 leading-6">
            <p className="font-semibold text-stone-800">{doneCount} از {HABITS.length} عادت</p>
            <p className="mt-1">{dirty ? "تغییرات ذخیره نشده — دکمه ثبت را بزن" : "همه‌چیز ثبت شده"}</p>
          </div>
        </section>

        {/* ورودی‌های عددی */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 mb-4">
          <h2 className="font-bold text-teal-800 mb-3">اندازه‌گیری امروز</h2>
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-xs text-stone-500 mb-1">وزن (کیلوگرم)</span>
              <input type="number" inputMode="decimal" value={draft.weight}
                onChange={(e) => { setDraft((d) => ({ ...d, weight: e.target.value })); setDirty(true); }}
                placeholder="مثلاً ۷۸.۵"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </label>
            <label className="flex-1">
              <span className="block text-xs text-stone-500 mb-1">ساعت خواب دیشب</span>
              <input type="number" inputMode="decimal" value={draft.sleepHours}
                onChange={(e) => { setDraft((d) => ({ ...d, sleepHours: e.target.value })); setDirty(true); }}
                placeholder="مثلاً ۷"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </label>
          </div>
        </section>

        {/* عادت‌ها */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 mb-4">
          <h2 className="font-bold text-teal-800 mb-3">عادت‌های امروز</h2>
          <ul className="space-y-2">
            {HABITS.map((h) => {
              const done = !!draft.habits[h.id];
              return (
                <li key={h.id}>
                  <button onClick={() => toggleHabit(h.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-right transition ${done ? "bg-teal-50 border-teal-300" : "bg-white border-stone-200 hover:border-teal-200"}`}>
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

        {/* دکمه ثبت */}
        <button onClick={saveToday}
          className={`w-full rounded-2xl py-4 mb-6 text-base font-bold text-white shadow-sm transition ${dirty ? "bg-teal-600 hover:bg-teal-700" : "bg-teal-400"}`}>
          {dirty ? "ثبت امروز 💾" : "ثبت شد ✓ (می‌توانی دوباره ثبت کنی)"}
        </button>

        {/* نمودار رشد */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 mb-4">
          <h2 className="font-bold text-teal-800 mb-1">نمودار رشد</h2>
          <p className="text-xs text-stone-400 mb-3">امتیاز روزانه در ۳۰ روز اخیر</p>
          {chartData.length < 2 ? (
            <div className="text-sm text-stone-500 bg-stone-50 rounded-xl p-4 leading-6">
              هنوز داده کافی نیست. امروز را ثبت کن — از فردا که روز دوم ثبت شود، خط رشدت اینجا شکل می‌گیرد. 📈
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
          {hasWeight && chartData.filter((d) => d.weight != null).length >= 2 && (
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
            <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-1">{medicalDone} از {MEDICAL.length}</span>
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
