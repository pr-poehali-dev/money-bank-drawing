import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const NEXT_DRAW_DATE = new Date("2026-12-29T20:00:00");
const PRIZE_PER_WINNER = 5_500_000;

const API = {
  register: "https://functions.poehali.dev/e715922c-4dd5-442b-b25f-f764910aba54",
  createPayment: "https://functions.poehali.dev/ecf98930-9e76-42cd-b3b7-d71085d4308d",
  getStats: "https://functions.poehali.dev/6e1ec002-00e3-4360-b4ee-c8d74bf636a7",
};

const DRAW_HISTORY = [
  {
    year: 2023, date: "29.12.2023", totalBank: 11_000_000, participants: 920,
    winners: [
      { contract: "БНК-2023-047", name: "Андрей С.", prize: 5_500_000 },
      { contract: "БНК-2023-312", name: "Светлана Р.", prize: 5_500_000 },
    ],
  },
  {
    year: 2024, date: "29.12.2024", totalBank: 16_500_000, participants: 1380,
    winners: [
      { contract: "БНК-2024-088", name: "Михаил Д.", prize: 5_500_000 },
      { contract: "БНК-2024-501", name: "Ольга К.", prize: 5_500_000 },
      { contract: "БНК-2024-219", name: "Виктор Н.", prize: 5_500_000 },
    ],
  },
  {
    year: 2025, date: "29.12.2025", totalBank: 22_000_000, participants: 1840,
    winners: [
      { contract: "БНК-2025-134", name: "Елена В.", prize: 5_500_000 },
      { contract: "БНК-2025-677", name: "Артём Л.", prize: 5_500_000 },
      { contract: "БНК-2025-903", name: "Марина Т.", prize: 5_500_000 },
      { contract: "БНК-2025-022", name: "Денис Ф.", prize: 5_500_000 },
    ],
  },
];

const RULES = [
  { num: "01", title: "Договор оферты", text: "Каждый участник заключает договор оферты и получает уникальный номер. Именно по номерам договоров проводится розыгрыш — всё прозрачно и верифицировано." },
  { num: "02", title: "Взнос", text: "Фиксированный взнос — 12 000 ₽ единовременно или 1 000 ₽ ежемесячно до 15-го числа. Участие активно только при своевременных платежах." },
  { num: "03", title: "Несколько победителей", text: "Банк делится на пакеты по 5 500 000 ₽. Сколько пакетов накопилось — столько победителей определяется в розыгрыше 29 декабря." },
  { num: "04", title: "Целевое использование", text: "Выигрыш можно потратить ТОЛЬКО на жильё: покупку квартиры, строительство дома или погашение ипотеки. Победитель подписывает соглашение о целевом использовании." },
  { num: "05", title: "Выплата", text: "Каждый победитель получает 5 500 000 ₽ в течение 3 рабочих дней на реквизиты, указанные в договоре. Факт выплаты публикуется на сайте." },
];

type Participant = { contract: string; name: string; pay_type: string; paid: number; date: string };
type Stats = { total_bank: number; participants_count: number; winners_count: number; participants: Participant[] };

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return count;
}

function useCountdown(target: Date) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const calc = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) return;
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [target]);
  return time;
}

function fmt(n: number) {
  return n.toLocaleString("ru-RU") + " ₽";
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      onClick={(e) => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }); }}
      className="text-xs font-body tracking-[0.18em] uppercase transition-colors duration-300 cursor-pointer"
      style={{ color: "#666", fontWeight: 400 }}
      onMouseEnter={e => (e.currentTarget.style.color = "#C9A84C")}
      onMouseLeave={e => (e.currentTarget.style.color = "#666")}
    >
      {label}
    </a>
  );
}

type FormData = { name: string; phone: string; email: string; payType: "annual" | "monthly"; agreed: boolean };

export default function Index() {
  const [stats, setStats] = useState<Stats>({ total_bank: 0, participants_count: 0, winners_count: 0, participants: [] });
  const [submitting, setSubmitting] = useState(false);
  const [regError, setRegError] = useState("");
  const [modal, setModal] = useState<"join" | "offer" | "success" | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ name: "", phone: "", email: "", payType: "annual", agreed: false });

  useEffect(() => {
    fetch(API.getStats).then(r => r.json()).then(d => setStats(d)).catch(() => {});
    if (new URLSearchParams(window.location.search).get("payment") === "success") {
      setModal("success");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const totalBank = stats.total_bank;
  const count = stats.participants_count;
  const winnersCount = stats.winners_count;
  const participants = stats.participants;

  const animBank = useCountUp(totalBank);
  const animCount = useCountUp(count, 900);
  const animWinners = useCountUp(winnersCount, 700);
  const countdown = useCountdown(NEXT_DRAW_DATE);

  const handleRegister = async () => {
    setSubmitting(true);
    setRegError("");
    try {
      const res = await fetch(API.register, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: form.name, phone: form.phone, email: form.email, pay_type: form.payType }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error || "Ошибка регистрации"); setSubmitting(false); return; }
      const payRes = await fetch(API.createPayment, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: data.participant_id }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) { setRegError(payData.error || "Ошибка создания платежа"); setSubmitting(false); return; }
      window.location.href = payData.payment_url;
    } catch {
      setRegError("Ошибка соединения. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0D0D0D", color: "#EDE8DF" }}>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, backgroundColor: "rgba(13,13,13,0.95)", borderBottom: "1px solid #1A1A1A", backdropFilter: "blur(16px)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#8A6F30,#C9A84C)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="Landmark" size={13} className="text-black" />
            </div>
            <span className="font-display text-lg tracking-widest font-semibold" style={{ color: "#C9A84C" }}>БАНК</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <NavLink href="#stats" label="Статистика" />
            <NavLink href="#participants" label="Участники" />
            <NavLink href="#rules" label="Правила" />
            <NavLink href="#contacts" label="Контакты" />
          </div>
          <button
            onClick={() => { setModal("join"); setStep(1); }}
            className="text-xs font-body tracking-widest uppercase px-5 py-2.5 transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#C9A84C", color: "#0D0D0D", fontWeight: 600 }}
          >
            Вступить в банк
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20">
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(201,168,76,0.06) 0%,transparent 65%)" }} />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-xs tracking-[0.2em] uppercase font-body"
            style={{ border: "1px solid #2A2A2A", color: "#8A6F30" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#C9A84C", display: "inline-block", animation: "pulse 2s infinite" }} />
            Приём взносов открыт · розыгрыш 31 декабря 2026
          </div>

          <h1 className="font-display font-light leading-none mb-6" style={{ fontSize: "clamp(52px,9vw,100px)", letterSpacing: "-0.02em" }}>
            Общий<br />
            <em className="not-italic" style={{ color: "#C9A84C" }}>банк</em>
          </h1>

          <p className="font-body text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-4" style={{ color: "#777", fontWeight: 300 }}>
            Каждый участник вносит <strong style={{ color: "#EDE8DF" }}>12 000 ₽</strong> (или <strong style={{ color: "#EDE8DF" }}>1 000 ₽/мес</strong>) и заключает договор оферты.
            В конце года один победитель забирает весь банк.
          </p>
          <p className="font-body text-sm mb-10" style={{ color: "#555" }}>
            Победитель определяется случайным выбором номера договора · полная прозрачность каждой операции
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => { setModal("join"); setStep(1); }}
              className="px-8 py-4 text-sm font-body tracking-widest uppercase transition-all hover:opacity-90"
              style={{ backgroundColor: "#C9A84C", color: "#0D0D0D", fontWeight: 600 }}
            >
              Стать участником
            </button>
            <button
              onClick={() => document.querySelector("#stats")?.scrollIntoView({ behavior: "smooth" })}
              className="px-8 py-4 text-sm font-body tracking-widest uppercase transition-colors"
              style={{ border: "1px solid #2A2A2A", color: "#666" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A84C"; (e.currentTarget as HTMLButtonElement).style.color = "#C9A84C"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2A2A2A"; (e.currentTarget as HTMLButtonElement).style.color = "#666"; }}
            >
              Смотреть банк
            </button>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", opacity: 0.3, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span className="text-xs font-body tracking-widest uppercase" style={{ color: "#555" }}>Листай</span>
          <Icon name="ChevronDown" size={16} style={{ color: "#555" }} />
        </div>
      </section>

      {/* STATS */}
      <section id="stats" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-body tracking-[0.3em] uppercase mb-3" style={{ color: "#8A6F30" }}>Реальное время</p>
            <h2 className="font-display font-light" style={{ fontSize: "clamp(36px,5vw,56px)" }}>Состояние банка</h2>
          </div>

          {/* Большие цифры — 3 карточки */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px mb-2" style={{ background: "#1A1A1A" }}>
            <div className="p-10 text-center" style={{ backgroundColor: "#0D0D0D" }}>
              <p className="text-xs font-body tracking-[0.25em] uppercase mb-4" style={{ color: "#444" }}>В банке сейчас</p>
              <p className="font-display font-semibold mb-2" style={{ fontSize: "clamp(32px,4vw,56px)", color: "#C9A84C", lineHeight: 1 }}>
                {fmt(animBank)}
              </p>
              <p className="text-xs font-body" style={{ color: "#444" }}>сумма всех взносов</p>
            </div>
            <div className="p-10 text-center" style={{ backgroundColor: "#0D0D0D" }}>
              <p className="text-xs font-body tracking-[0.25em] uppercase mb-4" style={{ color: "#444" }}>Участников</p>
              <p className="font-display font-semibold mb-2" style={{ fontSize: "clamp(32px,4vw,56px)", color: "#EDE8DF", lineHeight: 1 }}>
                {animCount}
              </p>
              <p className="text-xs font-body" style={{ color: "#444" }}>активных договоров</p>
            </div>
            <div className="p-10 text-center" style={{ backgroundColor: "#0D0D0D" }}>
              <p className="text-xs font-body tracking-[0.25em] uppercase mb-4" style={{ color: "#444" }}>Победителей в этом году</p>
              <p className="font-display font-semibold mb-2" style={{ fontSize: "clamp(32px,4vw,56px)", color: "#E8C96A", lineHeight: 1 }}>
                {winnersCount > 0 ? animWinners : "—"}
              </p>
              <p className="text-xs font-body" style={{ color: "#444" }}>
                {winnersCount > 0 ? `по ${fmt(PRIZE_PER_WINNER)} каждому` : `нужно ещё ${fmt(PRIZE_PER_WINNER - totalBank)}`}
              </p>
            </div>
          </div>

          {/* Целевое использование — баннер */}
          <div className="p-5 mb-2 flex flex-col md:flex-row items-start md:items-center gap-4" style={{ backgroundColor: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.15)", borderTop: "none" }}>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Icon name="Home" size={16} style={{ color: "#C9A84C" }} />
              <span className="text-xs font-body tracking-widest uppercase font-semibold" style={{ color: "#C9A84C" }}>Целевое использование</span>
            </div>
            <p className="text-xs font-body leading-relaxed" style={{ color: "#666" }}>
              Выигрыш расходуется <strong style={{ color: "#EDE8DF" }}>только на жильё</strong> — покупку квартиры, строительство дома или погашение ипотеки. Победитель подписывает соглашение о целевом использовании средств.
            </p>
          </div>

          {/* Взнос */}
          <div className="p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4" style={{ backgroundColor: "#111", border: "1px solid #1A1A1A", borderTop: "none" }}>
            <div className="flex items-center gap-3">
              <Icon name="Info" size={14} style={{ color: "#8A6F30", flexShrink: 0 }} />
              <p className="text-sm font-body" style={{ color: "#666" }}>
                Взнос: <span style={{ color: "#EDE8DF" }}>12 000 ₽</span> единовременно или <span style={{ color: "#EDE8DF" }}>1 000 ₽/мес</span> до 15-го числа
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Icon name="Users" size={13} style={{ color: "#C9A84C" }} />
              <span className="text-xs font-body" style={{ color: "#C9A84C" }}>Равный шанс у каждого участника</span>
            </div>
          </div>

          {/* Таймер */}
          <div className="p-10 text-center" style={{ border: "1px solid #1A1A1A" }}>
            <div className="flex items-center justify-center gap-2 mb-8">
              <Icon name="Clock" size={13} style={{ color: "#8A6F30" }} />
              <p className="text-xs font-body tracking-[0.3em] uppercase" style={{ color: "#8A6F30" }}>До розыгрыша</p>
            </div>
            <div className="grid grid-cols-4 gap-2 md:gap-6 max-w-md mx-auto">
              {[
                { val: countdown.days, label: "дней" },
                { val: countdown.hours, label: "часов" },
                { val: countdown.minutes, label: "минут" },
                { val: countdown.seconds, label: "секунд" },
              ].map(({ val, label }) => (
                <div key={label} className="flex flex-col items-center">
                  <div className="font-display font-semibold mb-1" style={{ fontSize: "clamp(32px,5vw,52px)", color: "#EDE8DF", lineHeight: 1 }}>
                    {String(val).padStart(2, "0")}
                  </div>
                  <div className="text-xs font-body tracking-widest uppercase" style={{ color: "#444" }}>{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-8" style={{ borderTop: "1px solid #1A1A1A" }}>
              <p className="text-xs font-body" style={{ color: "#444" }}>
                Розыгрыш: <span style={{ color: "#EDE8DF" }}>29 декабря 2026 в 20:00</span> · победители определяются по случайным номерам договоров · выигрыш только на жильё
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="gold-line" style={{ margin: "0 40px" }} />

      {/* PARTICIPANTS */}
      <section id="participants" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-body tracking-[0.3em] uppercase mb-3" style={{ color: "#8A6F30" }}>Прозрачность</p>
            <h2 className="font-display font-light" style={{ fontSize: "clamp(36px,5vw,56px)" }}>Участники банка</h2>
          </div>

          <div style={{ border: "1px solid #1A1A1A", overflow: "hidden" }}>
            {/* Шапка */}
            <div className="hidden md:grid px-6 py-4 text-xs font-body tracking-[0.15em] uppercase" style={{ gridTemplateColumns: "2fr 3fr 2fr 2fr 1fr", borderBottom: "1px solid #1A1A1A", color: "#3A3A3A", backgroundColor: "#080808" }}>
              <div>№ договора</div>
              <div>Участник</div>
              <div className="text-right">Внесено</div>
              <div className="text-right">Способ</div>
              <div className="text-right">Статус</div>
            </div>

            {participants.length === 0 ? (
              <div className="py-16 text-center font-body text-sm" style={{ color: "#444" }}>
                Пока нет активных участников. Стань первым!
              </div>
            ) : participants.map((p, i) => (
              <div
                key={p.contract}
                className="grid px-6 py-5 items-center"
                style={{
                  gridTemplateColumns: "2fr 3fr 2fr 2fr 1fr",
                  borderBottom: i < participants.length - 1 ? "1px solid #111" : "none",
                  backgroundColor: "#0D0D0D",
                  transition: "background 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#111")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#0D0D0D")}
              >
                <div className="font-body text-xs" style={{ color: "#C9A84C", fontFamily: "monospace", letterSpacing: "0.05em" }}>{p.contract}</div>
                <div className="font-body text-sm" style={{ color: "#EDE8DF" }}>{p.name}</div>
                <div className="text-right font-body text-sm font-medium" style={{ color: "#EDE8DF" }}>{fmt(p.paid)}</div>
                <div className="text-right font-body text-xs" style={{ color: "#555" }}>
                  {p.pay_type === "annual" ? "Единовременно" : "Ежемесячно"}
                </div>
                <div className="text-right">
                  <span className="text-xs font-body px-2 py-0.5" style={{ backgroundColor: "rgba(76,175,80,0.1)", color: "#4CAF50", border: "1px solid rgba(76,175,80,0.2)" }}>✓</span>
                </div>
              </div>
            ))}
          </div>

          {/* Итого */}
          <div className="flex items-center justify-between px-6 py-5" style={{ backgroundColor: "#111", border: "1px solid #1A1A1A", borderTop: "none" }}>
            <div className="flex items-center gap-4">
              <span className="text-xs font-body tracking-widest uppercase" style={{ color: "#444" }}>Итого в банке</span>
              <span className="text-xs font-body" style={{ color: "#333" }}>· {count} договоров</span>
            </div>
            <span className="font-display text-2xl font-semibold" style={{ color: "#C9A84C" }}>{fmt(totalBank)}</span>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => { setModal("join"); setStep(1); }}
              className="px-8 py-4 text-sm font-body tracking-widest uppercase transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#C9A84C", color: "#0D0D0D", fontWeight: 600 }}
            >
              Стать участником
            </button>
          </div>
        </div>
      </section>

      <div className="gold-line" style={{ margin: "0 40px" }} />

      {/* RULES */}
      <section id="rules" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-body tracking-[0.3em] uppercase mb-3" style={{ color: "#8A6F30" }}>Механика</p>
            <h2 className="font-display font-light" style={{ fontSize: "clamp(36px,5vw,56px)" }}>Правила участия</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "#1A1A1A" }}>
            {RULES.map((rule, i) => (
              <div
                key={rule.num}
                className="p-8 group"
                style={{ backgroundColor: "#0D0D0D", gridColumn: i === 4 ? "1 / -1" : undefined, transition: "background 0.3s" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#111")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#0D0D0D")}
              >
                <div className="flex items-start gap-5">
                  <span className="font-display text-3xl font-light flex-shrink-0" style={{ color: "#222", marginTop: 2 }}>{rule.num}</span>
                  <div>
                    <h3 className="font-display text-xl font-semibold mb-3" style={{ color: "#EDE8DF" }}>{rule.title}</h3>
                    <p className="font-body text-sm leading-relaxed" style={{ color: "#666" }}>{rule.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Договор оферты */}
          <div className="mt-8 p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6" style={{ border: "1px solid #1A1A1A", backgroundColor: "#080808" }}>
            <div className="flex items-start gap-4">
              <Icon name="FileText" size={20} style={{ color: "#C9A84C", flexShrink: 0, marginTop: 2 }} />
              <div>
                <h4 className="font-display text-lg font-semibold mb-1" style={{ color: "#EDE8DF" }}>Договор публичной оферты</h4>
                <p className="font-body text-sm" style={{ color: "#555" }}>Каждому участнику присваивается уникальный номер договора. Розыгрыш проводится именно по этим номерам — всё публично и верифицировано.</p>
              </div>
            </div>
            <button
              onClick={() => setModal("offer")}
              className="flex-shrink-0 px-6 py-3 text-xs font-body tracking-widest uppercase transition-colors"
              style={{ border: "1px solid #2A2A2A", color: "#666" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A84C"; (e.currentTarget as HTMLButtonElement).style.color = "#C9A84C"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2A2A2A"; (e.currentTarget as HTMLButtonElement).style.color = "#666"; }}
            >
              Читать договор
            </button>
          </div>

          {/* История розыгрышей */}
          <div className="mt-16">
            <h3 className="font-display text-3xl font-light mb-8 text-center">История розыгрышей</h3>
            <div className="space-y-3">
              {DRAW_HISTORY.map((d) => (
                <div key={d.year} style={{ border: "1px solid #1A1A1A", overflow: "hidden" }}>
                  {/* Шапка года */}
                  <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4" style={{ backgroundColor: "#0A0A0A", borderBottom: "1px solid #1A1A1A" }}>
                    <div className="flex items-center gap-5">
                      <span className="font-display text-3xl font-semibold" style={{ color: "#C9A84C" }}>{d.year}</span>
                      <div>
                        <p className="font-body text-xs" style={{ color: "#555" }}>{d.participants} участников · {d.date}</p>
                        <p className="font-body text-xs mt-0.5" style={{ color: "#555" }}>Банк: <span style={{ color: "#EDE8DF" }}>{fmt(d.totalBank)}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Icon name="Home" size={13} style={{ color: "#8A6F30" }} />
                      <span className="text-xs font-body" style={{ color: "#666" }}>{d.winners.length} победителей · по {fmt(PRIZE_PER_WINNER)}</span>
                      <span className="text-xs font-body px-2 py-1 ml-2" style={{ color: "#4CAF50", border: "1px solid rgba(76,175,80,0.2)", backgroundColor: "rgba(76,175,80,0.07)" }}>Выплачено</span>
                    </div>
                  </div>
                  {/* Победители */}
                  {d.winners.map((w, wi) => (
                    <div key={w.contract} className="flex items-center justify-between px-6 py-4"
                      style={{ borderBottom: wi < d.winners.length - 1 ? "1px solid #111" : "none", backgroundColor: "#0D0D0D", transition: "background 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#111")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#0D0D0D")}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-body" style={{ color: "#333" }}>#{wi + 1}</span>
                        <div>
                          <p className="font-body text-sm" style={{ color: "#EDE8DF" }}>{w.name}</p>
                          <p className="font-body text-xs mt-0.5" style={{ color: "#444", fontFamily: "monospace" }}>{w.contract}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon name="Home" size={12} style={{ color: "#8A6F30" }} />
                        <span className="font-display text-lg font-semibold" style={{ color: "#C9A84C" }}>{fmt(w.prize)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="gold-line" style={{ margin: "0 40px" }} />

      {/* CONTACTS */}
      <section id="contacts" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-body tracking-[0.3em] uppercase mb-3" style={{ color: "#8A6F30" }}>Пополнение</p>
            <h2 className="font-display font-light" style={{ fontSize: "clamp(36px,5vw,56px)" }}>Реквизиты и связь</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8" style={{ border: "1px solid #1A1A1A" }}>
              <div className="flex items-center gap-3 mb-6">
                <Icon name="CreditCard" size={16} style={{ color: "#C9A84C" }} />
                <h3 className="font-display text-xl">Реквизиты</h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Банк", val: "Сбербанк" },
                  { label: "Карта", val: "4276 •••• •••• 8421" },
                  { label: "Получатель", val: "Иванов И.И." },
                  { label: "Назначение", val: "Взнос [ФИО]" },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center py-3" style={{ borderBottom: "1px solid #161616" }}>
                    <span className="text-xs font-body uppercase tracking-widest" style={{ color: "#444" }}>{r.label}</span>
                    <span className="text-sm font-body" style={{ color: "#EDE8DF" }}>{r.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-6" style={{ border: "1px solid #1A1A1A" }}>
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="MessageCircle" size={15} style={{ color: "#C9A84C" }} />
                  <h4 className="font-display text-lg">Telegram</h4>
                </div>
                <p className="font-body text-xs mb-3" style={{ color: "#555" }}>Вопросы, подтверждение взносов</p>
                <a href="#" className="font-body text-sm transition-colors" style={{ color: "#EDE8DF" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#C9A84C")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#EDE8DF")}>@bank_admin</a>
              </div>
              <div className="p-6" style={{ border: "1px solid #1A1A1A" }}>
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="Phone" size={15} style={{ color: "#C9A84C" }} />
                  <h4 className="font-display text-lg">Телефон</h4>
                </div>
                <p className="font-body text-xs mb-3" style={{ color: "#555" }}>Пн–Пт, 10:00–19:00</p>
                <a href="tel:+79001234567" className="font-body text-sm" style={{ color: "#EDE8DF" }}>+7 (900) 123-45-67</a>
              </div>
            </div>

            <div className="p-8" style={{ border: "1px solid #1A1A1A" }}>
              <div className="flex items-center gap-3 mb-6">
                <Icon name="Shield" size={16} style={{ color: "#C9A84C" }} />
                <h3 className="font-display text-xl">Гарантии</h3>
              </div>
              <div className="space-y-4">
                {[
                  { icon: "Eye", text: "Все операции публичны и видны каждому участнику" },
                  { icon: "FileCheck", text: "Договор оферты защищает интересы каждого участника" },
                  { icon: "Trophy", text: "Выплата победителю гарантирована в течение 3 дней" },
                ].map(g => (
                  <div key={g.text} className="flex items-start gap-3">
                    <Icon name={g.icon as "Eye"} size={14} style={{ color: "#8A6F30", flexShrink: 0, marginTop: 2 }} />
                    <p className="font-body text-sm leading-relaxed" style={{ color: "#666" }}>{g.text}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setModal("join"); setStep(1); }}
                className="w-full mt-8 py-4 text-sm font-body tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#C9A84C", color: "#0D0D0D", fontWeight: 600 }}
              >
                Вступить в банк
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-6" style={{ borderTop: "1px solid #161616" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div style={{ width: 22, height: 22, background: "linear-gradient(135deg,#8A6F30,#C9A84C)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="Landmark" size={11} className="text-black" />
            </div>
            <span className="font-display tracking-widest" style={{ color: "#C9A84C" }}>БАНК</span>
          </div>
          <p className="text-xs font-body" style={{ color: "#2A2A2A" }}>Розыгрыш 29 декабря 2026 · Договор публичной оферты</p>
          <div className="flex gap-6">
            <NavLink href="#rules" label="Правила" />
            <NavLink href="#contacts" label="Контакты" />
          </div>
        </div>
      </footer>

      {/* MODAL: ВСТУПИТЬ */}
      {modal === "join" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
          <div style={{ width: "100%", maxWidth: 480, backgroundColor: "#0D0D0D", border: "1px solid #2A2A2A", position: "relative" }}>
            <button
              onClick={() => setModal(null)}
              style={{ position: "absolute", top: 20, right: 20, color: "#444", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = "#C9A84C")}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = "#444")}
            >
              <Icon name="X" size={18} />
            </button>

            {/* Шаги */}
            <div className="flex" style={{ borderBottom: "1px solid #1A1A1A" }}>
              {["Данные", "Тариф", "Договор"].map((s, i) => (
                <div key={s} className="flex-1 py-4 text-center" style={{ borderRight: i < 2 ? "1px solid #1A1A1A" : "none" }}>
                  <p className="text-xs font-body tracking-widest uppercase" style={{ color: step === i + 1 ? "#C9A84C" : "#333" }}>{s}</p>
                  {step === i + 1 && <div style={{ height: 2, backgroundColor: "#C9A84C", marginTop: 6, marginLeft: "25%", width: "50%" }} />}
                </div>
              ))}
            </div>

            <div className="p-8">
              {step === 1 && (
                <>
                  <h3 className="font-display text-3xl font-light mb-6">Ваши данные</h3>
                  <div className="space-y-4">
                    {[
                      { label: "Полное имя", key: "name", type: "text", ph: "Иванов Иван Иванович" },
                      { label: "Телефон", key: "phone", type: "tel", ph: "+7 (900) 000-00-00" },
                      { label: "Email", key: "email", type: "email", ph: "ivan@example.com" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-xs font-body tracking-widest uppercase block mb-2" style={{ color: "#444" }}>{f.label}</label>
                        <input
                          type={f.type}
                          placeholder={f.ph}
                          value={form[f.key as keyof FormData] as string}
                          onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                          className="w-full px-4 py-3 text-sm font-body outline-none"
                          style={{ backgroundColor: "#111", border: "1px solid #2A2A2A", color: "#EDE8DF" }}
                          onFocus={e => (e.currentTarget.style.borderColor = "#C9A84C")}
                          onBlur={e => (e.currentTarget.style.borderColor = "#2A2A2A")}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!form.name || !form.phone || !form.email}
                    className="w-full mt-6 py-4 text-sm font-body tracking-widest uppercase transition-opacity"
                    style={{ backgroundColor: "#C9A84C", color: "#0D0D0D", fontWeight: 600, opacity: (!form.name || !form.phone || !form.email) ? 0.4 : 1 }}
                  >
                    Далее
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <h3 className="font-display text-3xl font-light mb-6">Выберите тариф</h3>
                  <div className="space-y-3 mb-6">
                    {[
                      { val: "annual" as const, title: "Единовременно", price: "12 000 ₽", sub: "Оплата одним платежом", badge: "Выгодно" },
                      { val: "monthly" as const, title: "Ежемесячно", price: "1 000 ₽/мес", sub: "До 15-го числа каждого месяца" },
                    ].map(t => (
                      <div
                        key={t.val}
                        onClick={() => setForm({ ...form, payType: t.val })}
                        style={{
                          padding: "20px 24px",
                          border: `1px solid ${form.payType === t.val ? "#C9A84C" : "#2A2A2A"}`,
                          backgroundColor: form.payType === t.val ? "#111" : "#0A0A0A",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div style={{ width: 16, height: 16, borderRadius: "50%", border: `1px solid ${form.payType === t.val ? "#C9A84C" : "#333"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {form.payType === t.val && <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#C9A84C" }} />}
                          </div>
                          <div>
                            <p className="font-body text-sm font-medium" style={{ color: "#EDE8DF" }}>{t.title}</p>
                            <p className="font-body text-xs mt-0.5" style={{ color: "#555" }}>{t.sub}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg font-semibold" style={{ color: form.payType === t.val ? "#C9A84C" : "#666" }}>{t.price}</p>
                          {t.badge && <span className="text-xs font-body" style={{ color: "#8A6F30" }}>{t.badge}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 mb-6" style={{ backgroundColor: "#0A0A0A", border: "1px solid #1A1A1A" }}>
                    <p className="text-xs font-body" style={{ color: "#555" }}>
                      <Icon name="Info" size={11} style={{ display: "inline", color: "#8A6F30", marginRight: 6 }} />
                      Все участники имеют <strong style={{ color: "#EDE8DF" }}>равный шанс</strong> на выигрыш независимо от выбранного тарифа. Один номер договора — один шанс.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="flex-1 py-4 text-sm font-body tracking-widest uppercase" style={{ border: "1px solid #2A2A2A", color: "#666" }}>Назад</button>
                    <button onClick={() => setStep(3)} className="flex-1 py-4 text-sm font-body tracking-widest uppercase" style={{ backgroundColor: "#C9A84C", color: "#0D0D0D", fontWeight: 600 }}>Далее</button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h3 className="font-display text-3xl font-light mb-2">Договор оферты</h3>
                  <p className="font-body text-xs mb-6" style={{ color: "#555" }}>Ваш номер договора будет присвоен после оплаты</p>

                  <div className="p-4 mb-4 font-body text-xs leading-relaxed overflow-y-auto" style={{ maxHeight: 160, backgroundColor: "#080808", border: "1px solid #1A1A1A", color: "#555" }}>
                    <p className="mb-2" style={{ color: "#777" }}><strong>Договор публичной оферты</strong></p>
                    <p className="mb-2">Настоящий договор является публичной офертой и регулирует участие в ежегодном совместном банке. Принимая условия, участник соглашается с правилами проведения розыгрыша.</p>
                    <p className="mb-2">1. Участник вносит взнос в размере 12 000 ₽ единовременно или 1 000 ₽ ежемесячно до 15-го числа каждого месяца.</p>
                    <p className="mb-2">2. Каждому участнику присваивается уникальный номер договора, по которому проводится розыгрыш.</p>
                    <p className="mb-2">3. Розыгрыш проводится 31 декабря в 20:00. Победитель определяется случайным образом среди всех активных номеров договоров.</p>
                    <p>4. Выплата победителю производится в течение 3 рабочих дней на реквизиты, указанные при регистрации.</p>
                  </div>

                  <div
                    onClick={() => setForm({ ...form, agreed: !form.agreed })}
                    className="flex items-start gap-3 mb-6 cursor-pointer"
                  >
                    <div style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, border: `1px solid ${form.agreed ? "#C9A84C" : "#333"}`, backgroundColor: form.agreed ? "#C9A84C" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {form.agreed && <Icon name="Check" size={10} className="text-black" />}
                    </div>
                    <p className="font-body text-xs leading-relaxed" style={{ color: "#666" }}>
                      Я ознакомился с договором публичной оферты и принимаю его условия
                    </p>
                  </div>

                  {regError && (
                    <div className="mb-4 px-4 py-3 text-xs font-body" style={{ backgroundColor: "rgba(220,50,50,0.08)", border: "1px solid rgba(220,50,50,0.2)", color: "#E57373" }}>
                      {regError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)} className="flex-1 py-4 text-sm font-body tracking-widest uppercase" style={{ border: "1px solid #2A2A2A", color: "#666" }}>Назад</button>
                    <button
                      onClick={handleRegister}
                      disabled={!form.agreed || submitting}
                      className="flex-1 py-4 text-sm font-body tracking-widest uppercase transition-opacity"
                      style={{ backgroundColor: "#C9A84C", color: "#0D0D0D", fontWeight: 600, opacity: (form.agreed && !submitting) ? 1 : 0.4 }}
                    >
                      {submitting ? "Подождите..." : "Перейти к оплате"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: УСПЕХ */}
      {modal === "success" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
          <div style={{ width: "100%", maxWidth: 420, backgroundColor: "#0D0D0D", border: "1px solid #2A2A2A", position: "relative", textAlign: "center" }}>
            <button onClick={() => setModal(null)} style={{ position: "absolute", top: 20, right: 20, color: "#444", background: "none", border: "none", cursor: "pointer" }}>
              <Icon name="X" size={18} />
            </button>
            <div className="px-8 py-10">
              <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <Icon name="CheckCircle" size={26} style={{ color: "#4CAF50" }} />
              </div>
              <h3 className="font-display text-3xl font-light mb-3">Оплата прошла!</h3>
              <p className="font-body text-sm mb-6" style={{ color: "#666" }}>
                Вы стали участником банка. Ваш номер договора появится в списке участников на сайте в течение нескольких минут.
              </p>
              <div className="p-4 mb-6" style={{ backgroundColor: "#080808", border: "1px solid #1A1A1A" }}>
                <div className="flex items-center justify-center gap-2">
                  <Icon name="Home" size={14} style={{ color: "#8A6F30" }} />
                  <p className="text-xs font-body" style={{ color: "#666" }}>Помните: выигрыш расходуется только на жильё</p>
                </div>
              </div>
              <button
                onClick={() => setModal(null)}
                className="w-full py-4 text-sm font-body tracking-widest uppercase"
                style={{ backgroundColor: "#C9A84C", color: "#0D0D0D", fontWeight: 600 }}
              >
                Отлично!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ДОГОВОР */}
      {modal === "offer" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
          <div style={{ width: "100%", maxWidth: 560, backgroundColor: "#0D0D0D", border: "1px solid #2A2A2A", position: "relative" }}>
            <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: "1px solid #1A1A1A" }}>
              <div className="flex items-center gap-3">
                <Icon name="FileText" size={16} style={{ color: "#C9A84C" }} />
                <h3 className="font-display text-xl">Договор публичной оферты</h3>
              </div>
              <button onClick={() => setModal(null)} style={{ color: "#444", background: "none", border: "none", cursor: "pointer" }}>
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="px-8 py-6 font-body text-sm leading-relaxed overflow-y-auto" style={{ maxHeight: "60vh", color: "#666" }}>
              <p className="mb-4 text-xs tracking-widest uppercase" style={{ color: "#8A6F30" }}>Редакция от 01.01.2026</p>
              {[
                ["1. Предмет договора", "Организатор проводит ежегодный совместный банк. Участник вносит фиксированный взнос и получает право на участие в розыгрыше."],
                ["2. Условия участия", "Взнос составляет 12 000 ₽ единовременно или 1 000 ₽ ежемесячно до 15-го числа. Участие активно при условии своевременных платежей."],
                ["3. Номер договора", "Каждому участнику присваивается уникальный номер в формате БНК-ГГГГ-NNN. Розыгрыш проводится по этим номерам случайным образом."],
                ["4. Розыгрыш", "Проводится 29 декабря в 20:00. Банк делится на пакеты по 5 500 000 ₽. Сколько пакетов — столько победителей. Победители определяются случайным выбором номеров договоров. Каждый участник имеет равный шанс."],
                ["5. Целевое использование", "Выигрыш расходуется исключительно на жильё: покупку квартиры, строительство или погашение ипотеки. Победитель подписывает соглашение о целевом использовании средств перед получением выплаты."],
                ["6. Выплата", "Каждый победитель получает 5 500 000 ₽ в течение 3 рабочих дней на реквизиты из договора. Факт каждой выплаты публикуется на сайте."],
                ["7. Прозрачность", "Все участники, номера договоров и суммы взносов публично отображаются на сайте в реальном времени. Организатор не может скрыть или изменить данные."],
              ].map(([title, text]) => (
                <div key={title as string} className="mb-5">
                  <p className="font-semibold mb-2" style={{ color: "#EDE8DF" }}>{title}</p>
                  <p>{text}</p>
                </div>
              ))}
            </div>
            <div className="px-8 py-5" style={{ borderTop: "1px solid #1A1A1A" }}>
              <button
                onClick={() => { setModal("join"); setStep(1); }}
                className="w-full py-4 text-sm font-body tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#C9A84C", color: "#0D0D0D", fontWeight: 600 }}
              >
                Вступить в банк
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}