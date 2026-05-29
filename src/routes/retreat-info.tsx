import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/retreat-info")({
  component: RetreatInfoPage,
  head: () => ({
    meta: [
      { title: "HOC3 联合退修会介绍" },
      { name: "description", content: "2026 基督之家联合退修会 — 跨越·萬國萬代" },
    ],
  }),
});

function RetreatInfoPage() {
  return (
    <div className="min-h-screen w-full bg-[#FAF3E3] text-stone-900 flex items-center justify-center px-6 sm:px-12 py-10">
      <div className="max-w-5xl w-full text-center font-kaiti">
        <div className="text-5xl sm:text-7xl md:text-8xl font-serif font-bold leading-tight mb-6">
          🏕 HOC3 联合退修会
        </div>
        <div className="text-2xl sm:text-4xl md:text-5xl mb-8 opacity-90">
          欢迎你参加退修会
        </div>

        <div className="space-y-3 text-2xl sm:text-3xl md:text-4xl leading-relaxed mb-10">
          <p>2026 基督之家联合退修会</p>
          <p>主题：跨越—萬國萬代</p>
          <p>讲员：柏有成博士</p>
        </div>

        <div className="text-xl sm:text-2xl md:text-3xl opacity-80 leading-relaxed mb-10">
          <p>7/24 Fri 1:00PM — 7/26 Sun 1:00PM</p>
          <p>Sonoma State University</p>
        </div>

        <blockquote className="italic text-2xl sm:text-3xl md:text-4xl leading-relaxed border-t border-stone-400/40 pt-8 max-w-4xl mx-auto">
          「神能将各样的恩惠多多地加给你们，使你们凡事常常充足，能多行各样善事。」
          <div className="mt-3 text-lg sm:text-xl md:text-2xl not-italic opacity-70">
            — 哥林多后书 9:8
          </div>
        </blockquote>
      </div>
    </div>
  );
}