import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import { AppShell } from "../../components/shell/AppShell";
import { createQuiz } from "../../services/quizApi";
import { useRequireAuth } from "../../hooks/use-require-auth";

type Answer = { text: string; isCorrect: boolean };
type Question = {
  id: string;
  text: string;
  timeLimitSeconds: number;
  answers: Answer[];
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function makeEmptyQuestion(): Question {
  return {
    id: uid(),
    text: "",
    timeLimitSeconds: 30,
    answers: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  };
}

export default function CreateQuizPage() {
  const auth = useRequireAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [questions, setQuestions] = useState<Question[]>([makeEmptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth) return null;

  // ── Question helpers ──
  function addQuestion() {
    setQuestions((q) => [...q, makeEmptyQuestion()]);
  }

  function removeQuestion(id: string) {
    setQuestions((q) => q.filter((x) => x.id !== id));
  }

  function updateQuestion(id: string, patch: Partial<Omit<Question, "id" | "answers">>) {
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function updateAnswer(qId: string, idx: number, patch: Partial<Answer>) {
    setQuestions((q) =>
      q.map((x) =>
        x.id === qId
          ? {
              ...x,
              answers: x.answers.map((a, i) =>
                i === idx ? { ...a, ...patch } : a
              ),
            }
          : x
      )
    );
  }

  function setCorrect(qId: string, idx: number) {
    setQuestions((q) =>
      q.map((x) =>
        x.id === qId
          ? {
              ...x,
              answers: x.answers.map((a, i) => ({ ...a, isCorrect: i === idx })),
            }
          : x
      )
    );
  }

  function addAnswer(qId: string) {
    setQuestions((q) =>
      q.map((x) =>
        x.id === qId && x.answers.length < 6
          ? { ...x, answers: [...x.answers, { text: "", isCorrect: false }] }
          : x
      )
    );
  }

  function removeAnswer(qId: string, idx: number) {
    setQuestions((q) =>
      q.map((x) =>
        x.id === qId && x.answers.length > 2
          ? { ...x, answers: x.answers.filter((_, i) => i !== idx) }
          : x
      )
    );
  }

  // ── Validation ──
  function validate(): string | null {
    if (!title.trim()) return "Vui lòng nhập tên quiz.";
    if (questions.length === 0) return "Cần ít nhất 1 câu hỏi.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return `Câu hỏi #${i + 1} chưa có nội dung.`;
      if (!q.answers.some((a) => a.isCorrect)) return `Câu hỏi #${i + 1} chưa đánh dấu đáp án đúng.`;
      if (q.answers.some((a) => !a.text.trim())) return `Câu hỏi #${i + 1} có đáp án trống.`;
    }
    return null;
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) { setError(err); return; }

    // Convert to server format
    const serverQuestions = questions.map((q) => {
      const correctAnswer = q.answers.find((a) => a.isCorrect)!.text;
      return {
        q: q.text,
        options: q.answers.map((a) => a.text),
        correct: correctAnswer,
        timeLimitSeconds: q.timeLimitSeconds,
      };
    });

    setSubmitting(true);
    try {
      const j = await createQuiz({ title: title.trim(), subject: subject.trim() || undefined, questions: serverQuestions });
      router.push(`/quiz/${j.quiz.id}`);
    } catch (err: any) {
      setError(err.message || "Tạo quiz thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Tạo Quiz" subtitle="Soạn bộ câu hỏi trắc nghiệm của bạn">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fadeIn">
            <span>⚠</span> {error}
            <button type="button" onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Meta card */}
        <div className="rounded-2xl border border-black/5 bg-white shadow-sm p-5 flex flex-col gap-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Thông tin quiz</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">Tên quiz <span className="text-rose-500">*</span></label>
              <input
                className="rounded-xl border border-black/10 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                placeholder="VD: Kiến thức lập trình Python"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">Môn học / Chủ đề</label>
              <input
                className="rounded-xl border border-black/10 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
                placeholder="VD: Công nghệ thông tin"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={80}
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="flex flex-col gap-4">
          {questions.map((q, qi) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={qi}
              onUpdate={(patch) => updateQuestion(q.id, patch)}
              onRemove={() => removeQuestion(q.id)}
              onUpdateAnswer={(idx, patch) => updateAnswer(q.id, idx, patch)}
              onSetCorrect={(idx) => setCorrect(q.id, idx)}
              onAddAnswer={() => addAnswer(q.id)}
              onRemoveAnswer={(idx) => removeAnswer(q.id, idx)}
              canRemove={questions.length > 1}
            />
          ))}
        </div>

        {/* Add question */}
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-sm font-semibold text-slate-500 transition hover:border-rose-300 hover:bg-rose-50/30 hover:text-rose-600"
        >
          <PlusIcon /> Thêm câu hỏi
        </button>

        {/* Submit */}
        <div className="flex justify-end gap-3 border-t border-black/5 pt-4">
          <button
            type="button"
            onClick={() => router.push("/quiz")}
            className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-60"
          >
            {submitting ? "Đang lưu..." : "✓ Lưu quiz"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}

// ── Question Card Component ──
function QuestionCard({
  question, index, onUpdate, onRemove, onUpdateAnswer, onSetCorrect, onAddAnswer, onRemoveAnswer, canRemove,
}: {
  question: Question;
  index: number;
  onUpdate: (patch: Partial<Omit<Question, "id" | "answers">>) => void;
  onRemove: () => void;
  onUpdateAnswer: (idx: number, patch: Partial<Answer>) => void;
  onSetCorrect: (idx: number) => void;
  onAddAnswer: () => void;
  onRemoveAnswer: (idx: number) => void;
  canRemove: boolean;
}) {
  const TIMES = [10, 15, 20, 30, 45, 60, 90, 120];

  return (
    <div className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/5 bg-slate-50/60 px-5 py-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Câu {index + 1}
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <ClockIcon />
            <select
              value={question.timeLimitSeconds}
              onChange={(e) => onUpdate({ timeLimitSeconds: Number(e.target.value) })}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-rose-300 transition"
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>{t} giây</option>
              ))}
            </select>
          </label>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition"
              title="Xóa câu hỏi"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Question text */}
        <textarea
          rows={2}
          className="w-full resize-none rounded-xl border border-black/10 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
          placeholder="Nhập nội dung câu hỏi..."
          value={question.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          maxLength={500}
        />

        {/* Answers */}
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Đáp án — chọn 1 đáp án đúng</div>
          {question.answers.map((ans, ai) => (
            <div key={ai} className="flex items-center gap-2">
              {/* Radio correct */}
              <button
                type="button"
                onClick={() => onSetCorrect(ai)}
                className={[
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition",
                  ans.isCorrect
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 hover:border-emerald-400",
                ].join(" ")}
                title="Đánh dấu là đúng"
              >
                {ans.isCorrect && <span className="text-[9px]">✓</span>}
              </button>
              {/* Text */}
              <input
                type="text"
                className={[
                  "flex-1 rounded-xl border px-3 py-2 text-sm outline-none transition",
                  ans.isCorrect
                    ? "border-emerald-200 bg-emerald-50/60 text-emerald-900 focus:ring-4 focus:ring-emerald-100"
                    : "border-black/10 bg-slate-50 text-slate-900 focus:border-rose-300 focus:ring-4 focus:ring-rose-100",
                ].join(" ")}
                placeholder={`Đáp án ${String.fromCharCode(65 + ai)}`}
                value={ans.text}
                onChange={(e) => onUpdateAnswer(ai, { text: e.target.value })}
                maxLength={200}
              />
              {/* Remove answer */}
              {question.answers.length > 2 && (
                <button
                  type="button"
                  onClick={() => onRemoveAnswer(ai)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-400 transition"
                >
                  <XIcon />
                </button>
              )}
            </div>
          ))}
          {question.answers.length < 6 && (
            <button
              type="button"
              onClick={onAddAnswer}
              className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-500 transition"
            >
              <PlusIcon size={13} /> Thêm đáp án
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Icons ──
function PlusIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
