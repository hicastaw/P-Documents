import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-semibold">P-Documents</h1>
        <p className="mt-2 text-slate-300">
          Nền tảng quản lý & chia sẻ tài liệu + hỗ trợ học tập thông minh.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Card title="Auth" desc="Đăng ký/Đăng nhập/Me (JWT)">
            <Link className="text-sky-300 underline" href="/login">
              Mở trang đăng nhập
            </Link>
          </Card>
          <Card title="Documents" desc="Presigned upload/download MinIO">
            <Link className="text-sky-300 underline" href="/documents">
              Mở kho tài liệu
            </Link>
          </Card>
          <Card title="Chat" desc="RAG (Phase 5) theo tài liệu">
            <Link className="text-sky-300 underline" href="/chat">
              Mở Chat
            </Link>
          </Card>
          <Card title="Quiz" desc="Quiz + Leaderboard realtime">
            <Link className="text-sky-300 underline" href="/quiz">
              Mở Quiz
            </Link>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Card(props: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="text-lg font-medium">{props.title}</div>
      <div className="mt-1 text-sm text-slate-300">{props.desc}</div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

