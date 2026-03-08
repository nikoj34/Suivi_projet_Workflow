import { useState, useEffect } from 'react';
import { DEFAULT_WORKTIME, WORKTIME_DAY_LABELS } from '../lib/constants';
import { evaluateAmountExpression } from '../lib/utils';

export default function WorkTimeModal({ visible, onClose, workTimeConfig, onSave }) {
  const [workDays, setWorkDays] = useState(() =>
    workTimeConfig?.workDays ? { ...workTimeConfig.workDays } : { ...DEFAULT_WORKTIME.workDays }
  );
  const [workHours, setWorkHours] = useState(() => {
    if (workTimeConfig?.workHours) return { ...workTimeConfig.workHours };
    const fallback =
      workTimeConfig?.hoursPerDay != null ? Number(workTimeConfig.hoursPerDay) : 7.5;
    return { mon: fallback, tue: fallback, wed: fallback, thu: fallback, fri: fallback };
  });
  const [rawHours, setRawHours] = useState({});
  useEffect(() => {
    if (visible) {
      setWorkDays(
        workTimeConfig?.workDays ? { ...workTimeConfig.workDays } : { ...DEFAULT_WORKTIME.workDays }
      );
      let next = {};
      if (workTimeConfig?.workHours) {
        next = { ...workTimeConfig.workHours };
        setWorkHours(next);
      } else {
        const fallback =
          workTimeConfig?.hoursPerDay != null ? Number(workTimeConfig.hoursPerDay) : 7.5;
        next = { mon: fallback, tue: fallback, wed: fallback, thu: fallback, fri: fallback };
        setWorkHours(next);
      }
      const raw = {};
      WORKTIME_DAY_LABELS.forEach((day) => {
        const v = next[day.key];
        raw[day.key] = v === 0 || v === '' ? '' : String(v);
      });
      setRawHours(raw);
    }
  }, [visible, workTimeConfig]);

  if (!visible) return null;

  const handleSave = () => {
    onSave({ workDays, workHours });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md glass rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
            Mon temps de travail
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Heures par jour
            </label>
            <div className="flex flex-col gap-2">
              {WORKTIME_DAY_LABELS.map((d) => (
                <div
                  key={d.key}
                  className="flex items-center justify-between gap-3 bg-white/50 p-2.5 rounded-xl border border-slate-100"
                >
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer w-28">
                    <input
                      type="checkbox"
                      checked={!!workDays[d.key]}
                      onChange={() =>
                        setWorkDays((prev) => ({ ...prev, [d.key]: !prev[d.key] }))
                      }
                      className="rounded border-slate-300 text-[#007A78] focus:ring-[#007A78]"
                    />
                    {d.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!workDays[d.key]}
                      className={
                        'inp py-1.5 px-3 text-sm rounded-lg border w-24 text-center ' +
                        (!workDays[d.key] ? 'opacity-40 cursor-not-allowed bg-slate-100' : 'border-slate-200')
                      }
                      value={rawHours[d.key] !== undefined ? rawHours[d.key] : (workHours[d.key] === 0 || workHours[d.key] === '' ? '' : String(workHours[d.key]))}
                      onChange={(e) => {
                        const v = e.target.value.replace(',', '.');
                        setRawHours((prev) => ({ ...prev, [d.key]: v }));
                      }}
                      onBlur={() => {
                        const v = String(rawHours[d.key] ?? workHours[d.key] ?? '').trim().replace(/,/g, '.');
                        const fromExpr = evaluateAmountExpression(v);
                        const val = fromExpr !== null ? fromExpr : parseFloat(v);
                        const n = typeof val === 'number' && !isNaN(val) ? Math.min(24, Math.max(0, val)) : (workHours[d.key] ?? 0);
                        setWorkHours((prev) => ({ ...prev, [d.key]: n }));
                        setRawHours((prev) => ({ ...prev, [d.key]: n === 0 ? '' : String(n) }));
                      }}
                    />
                    <span className="text-[10px] font-bold text-slate-400">h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl text-[11px] font-black uppercase bg-[#007A78] text-white hover:bg-teal-700 transition-all"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
