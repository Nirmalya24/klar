"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { bucketLabels, streamItems } from "@/lib/data";
import type { Lens } from "@/lib/types";

const lenses: Array<{ id: Lens; label: string; color: string }> = [
  { id: "omnis", label: "All", color: "text-slate-600" },
  { id: "opus", label: "Work", color: "text-blue-500" },
  { id: "fiscus", label: "Finance", color: "text-emerald-500" },
  { id: "vita", label: "Life", color: "text-violet-500" },
  { id: "systema", label: "System", color: "text-amber-500" }
];

export default function KlarApp() {
  const [lens, setLens] = useState<Lens>("omnis");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);

  const filtered = useMemo(() => {
    if (lens === "omnis") return streamItems;
    return streamItems.filter((item) => item.lens === lens);
  }, [lens]);

  const satoriBrief = useMemo(() => {
    const workCount = filtered.filter((f) => f.lens === "opus").length;
    const financeCount = filtered.filter((f) => f.lens === "fiscus").length;
    return `Prioritize ${workCount > 0 ? "Q4 logistics" : "response clearing"} first; ${financeCount > 0 ? "settle invoice checks" : "defer low-urgency items"} later. Keep your focus narrow and finish one thread before switching.`;
  }, [filtered]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="min-h-screen p-8 md:p-14">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-4">
          <h1 className="text-4xl font-light tracking-tight">Klar</h1>
          <div className="flex flex-wrap gap-2">
            {lenses.map((entry) => {
              const active = lens === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    active ? "border-black/50 bg-white shadow-sm" : "border-black/10 bg-white/40"
                  }`}
                  onClick={() => {
                    setLens(entry.id);
                    setSelectedId(null);
                  }}
                >
                  <span className={`${active ? entry.color : "text-slate-300"} mr-2`}>{active ? "◉" : "◌"}</span>
                  {entry.label}
                </button>
              );
            })}
          </div>
          <div className="klar-glass rounded-2xl border border-white/70 p-4 text-sm leading-relaxed text-slate-700">
            <span className="font-medium">Satori Briefing:</span> {satoriBrief}
          </div>
        </header>

        {(["hodie", "heri", "olim"] as const).map((bucket) => {
          const items = filtered.filter((item) => item.bucket === bucket);
          if (items.length === 0) return null;
          return (
            <section key={bucket} className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.2em] text-slate-400">{bucketLabels[bucket]}</h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const selected = selectedId === item.id;
                  const dimmed = selectedId !== null && !selected;
                  return (
                    <motion.article
                      key={item.id}
                      layout
                      onClick={() => setSelectedId((cur) => (cur === item.id ? null : item.id))}
                      className={`cursor-pointer rounded-2xl border border-black/10 bg-white p-4 transition ${
                        selected ? "scale-[1.01] shadow-zanshin" : ""
                      } ${dimmed ? "scale-[0.985] opacity-30 blur-[1px]" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-500">{item.sender}</p>
                          <h3 className="text-base font-medium">{item.subject}</h3>
                          <p className="text-sm text-slate-500">{item.preview}</p>
                        </div>
                        <time className="text-xs text-slate-400">{item.time}</time>
                      </div>
                      <AnimatePresence>
                        {selected ? (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mt-4 flex gap-2"
                          >
                            <button className="rounded-full border border-black/20 px-3 py-1 text-xs">Mark Done</button>
                            <button className="rounded-full border border-black/20 px-3 py-1 text-xs">Reply</button>
                            <button className="rounded-full border border-black/20 px-3 py-1 text-xs">Dismiss</button>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="space-y-3 rounded-2xl border border-black/10 bg-white/60 p-5">
          <h2 className="text-lg">Karakuri Engine (Agent Lab)</h2>
          <p className="text-sm text-slate-500">Prototype input for natural language workflow commands.</p>
          <input
            suppressHydrationWarning
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none ring-black/20 focus:ring"
            placeholder='Try: "Extract all Q4 dates from my work emails"'
          />
        </section>
      </div>

      <AnimatePresence>
        {showPalette ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 p-8 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPalette(false)}
          >
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="w-full max-w-2xl rounded-2xl bg-white p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                suppressHydrationWarning
                placeholder="Jump to Inbox, Projects, Agents, or Prisma lens…"
                className="w-full border-none bg-transparent font-serif text-2xl outline-none"
              />
              <p className="mt-3 text-xs text-slate-400">Cmd/Ctrl + K to toggle</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
