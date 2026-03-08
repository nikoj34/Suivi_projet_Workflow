import { getTaskTagStyle } from '../lib/utils';
import ic from './icons';

const DEFAULT_COLOR = '#4f46e5';
const DEFAULT_BG = '#eef2ff';

/** Icônes nommées (clés) → composant ic. Les autres valeurs sont affichées comme emoji. */
const NAMED_ICONS = {
  forbid: ic.Forbid,
  warn: ic.Warn,
  build: ic.Build,
  gantt: ic.Gnt,
  cal: ic.Cal,
  filetext: ic.FileText,
  clip: ic.Clip,
  pin: ic.Pin,
  usr: ic.Usr,
  book: ic.Book,
  ok: ic.Ok,
};

/**
 * Badge affichant un tag de tâche avec couleur et icône/emoji (configurables dans Paramètres).
 */
export default function TaskTagBadge({ tag, config, size = 'sm', className = '' }) {
  if (!tag || !String(tag).trim()) return null;
  const style = getTaskTagStyle(tag, config);
  const color = style?.color || DEFAULT_COLOR;
  const bg = style?.bg || DEFAULT_BG;
  const label = style?.label ?? tag;
  const iconVal = style?.icon;
  const isSm = size === 'sm';
  const iconSize = isSm ? 10 : 12;
  const textCls = isSm ? 'text-[7px]' : 'text-[9px]';
  const padCls = isSm ? 'px-1.5 py-0.5' : 'px-2 py-1';

  const Icon = iconVal && NAMED_ICONS[iconVal] ? NAMED_ICONS[iconVal] : null;
  const isEmoji = iconVal && !NAMED_ICONS[iconVal];

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded ${textCls} ${padCls} ${className}`}
      style={{ color, background: bg }}
    >
      {Icon && <Icon s={iconSize} />}
      {isEmoji && <span className="leading-none">{iconVal}</span>}
      <span className="truncate max-w-[120px]">{label}</span>
    </span>
  );
}
