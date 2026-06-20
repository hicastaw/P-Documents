import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "../components/shell/AppShell";
import { apiJsonAuth } from "../services/api";
import { askQuestion as askQuestionApi } from "../services/chatApi";
import { useRequireAuth } from "../hooks/use-require-auth";

type Doc = { id: string; title: string };
type Message = { role: "user" | "ai"; text: string };

export default function ChatPage() {
  const auth = useRequireAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth) return;
    apiJsonAuth<{ documents: Doc[] }>("/documents").then((j) => setDocs(j.documents ?? []));
  }, [!!auth]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!auth) return null;

  async function ask() {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion("");
    setError(null);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);

    try {
      const j = await askQuestionApi(q, selectedDocId || undefined);
      const answer = j.answer ?? "(không có câu trả lời)";
      setMessages((m) => [...m, { role: "ai" as const, text: answer }]);
    } catch {
      setError("Không thể nhận trả lời từ AI. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      title="Chat AI"
      subtitle="Hỏi đáp thông minh dựa trên nội dung tài liệu"
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Chat area */}
        <div className="flex flex-col gap-4">
          {/* Messages */}
          <div className="min-h-[400px] max-h-[560px] overflow-y-auto rounded-2xl border border-black/5 bg-white/80 p-4 backdrop-blur flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center text-sm text-slate-400">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-slate-300">
                  <ChatBigIcon />
                </div>
                <div>
                  <div className="font-semibold text-slate-600">Bắt đầu hỏi</div>
                  <div className="mt-0.5 text-xs">Chọn tài liệu bên phải rồi đặt câu hỏi</div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={["flex gap-3", msg.role === "user" ? "flex-row-reverse" : ""].join(" ")}
              >
                <div
                  className={[
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                    msg.role === "user"
                      ? "bg-rose-600 text-white"
                      : "bg-gradient-to-br from-violet-500 to-purple-600 text-white",
                  ].join(" ")}
                >
                  {msg.role === "user" ? "B" : "AI"}
                </div>
                <div
                  className={[
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "rounded-tr-sm bg-rose-600 text-white"
                      : "rounded-tl-sm bg-slate-100 text-slate-800 shadow-sm border border-slate-200/60 break-words",
                  ].join(" ")}
                >
                  {msg.role === "user" ? (
                    msg.text
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ node, ...props }: any) => <p className="mb-2.5 last:mb-0 leading-relaxed" {...props} />,
                        ul: ({ node, ...props }: any) => <ul className="mb-3 list-disc pl-5 space-y-1" {...props} />,
                        ol: ({ node, ...props }: any) => <ol className="mb-3 list-decimal pl-5 space-y-1" {...props} />,
                        li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
                        strong: ({ node, ...props }: any) => <strong className="font-semibold text-slate-900" {...props} />,
                        h3: ({ node, ...props }: any) => <h3 className="mb-2 mt-4 text-sm font-bold text-slate-900" {...props} />,
                        h4: ({ node, ...props }: any) => <h4 className="mb-1 mt-3 text-sm font-semibold text-slate-800" {...props} />,
                        code: ({ node, className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || "");
                          return !match ? (
                            <code className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[13px] font-mono text-rose-600" {...props}>
                              {children}
                            </code>
                          ) : (
                            <div className="my-3 overflow-hidden rounded-xl bg-slate-800 text-slate-50 border border-slate-700">
                              <div className="bg-slate-900/50 px-4 py-1.5 text-xs text-slate-400 font-mono flex items-center">{match[1]}</div>
                              <pre className="overflow-x-auto p-4 text-[13px] leading-snug">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            </div>
                          );
                        },
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                  AI
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              <span>⚠</span> {error}
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <textarea
              className="min-h-[52px] flex-1 resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 transition"
              placeholder="Nhập câu hỏi của bạn..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
              rows={2}
            />
            <button
              onClick={ask}
              disabled={loading || !question.trim()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-6px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-rose-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SendIcon />
              Gửi
            </button>
          </div>
          <div className="text-xs text-slate-400">Enter để gửi · Shift+Enter xuống dòng</div>
        </div>

        {/* Sidebar: doc selector */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-black/5 bg-white/80 p-4 backdrop-blur">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Chọn tài liệu
            </div>
            {docs.length === 0 ? (
              <div className="text-xs text-slate-400">Chưa có tài liệu nào. Hãy upload tài liệu trước.</div>
            ) : (
              <div className="grid gap-1.5 max-h-[440px] overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedDocId("")}
                  className={[
                    "rounded-xl border px-3 py-2 text-left text-xs font-medium transition",
                    selectedDocId === ""
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100",
                  ].join(" ")}
                >
                  🗂 Tất cả tài liệu
                </button>
                {docs.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDocId(d.id)}
                    className={[
                      "rounded-xl border px-3 py-2 text-left text-xs font-medium truncate transition",
                      selectedDocId === d.id
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100",
                    ].join(" ")}
                  >
                    📄 {d.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/5 bg-white/80 p-4 text-xs text-slate-500 backdrop-blur">
            <div className="font-semibold text-slate-700 mb-1.5">Hướng dẫn</div>
            <ul className="grid gap-1.5 list-none">
              <li>• Chọn tài liệu cụ thể để hỏi chính xác hơn</li>
              <li>• AI sẽ trả lời dựa trên nội dung PDF</li>
              <li>• Đặt câu hỏi rõ ràng, cụ thể</li>
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ChatBigIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 14a4 4 0 0 1-4 4H9l-5 3V6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2 11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2 15 22 11 13 2 9l20-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
