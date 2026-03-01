import React from 'react';

const I = ({ d, s = 18, c = '', f = 'none', vb = '0 0 24 24' }) => (
  <svg width={s} height={s} viewBox={vb} fill={f} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

export const ic = {
  Dash: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>} />
  ),
  Plus: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d="M12 5v14M5 12h14" />
  ),
  PlusC: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></>} />
  ),
  List: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  ),
  Arch: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></>} />
  ),
  Cog: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>} />
  ),
  Srch: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>} />
  ),
  Sv: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>} />
  ),
  Addr: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>} />
  ),
  Warn: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>} />
  ),
  Ok: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>} />
  ),
  Fold: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></>} />
  ),
  Euro: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M4 10h12M4 14h12" /><path d="M15 5a7 7 0 100 14" /></>} />
  ),
  Act: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d="M22 12h-4l-3 9L9 3l-3 9H2" />
  ),
  FileText: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>} />
  ),
  Dl: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>} />
  ),
  Cal: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />
  ),
  Pin: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></>} />
  ),
  Build: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></>} />
  ),
  Ed: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>} />
  ),
  Eye: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>} />
  ),
  Copy: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></>} />
  ),
  Rst: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></>} />
  ),
  Tr: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></>} />
  ),
  Inf: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>} />
  ),
  Gnt: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d="M8 6h10M6 12h8M4 18h12M3 3v18" />
  ),
  Clip: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>} />
  ),
  Book: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>} />
  ),
  Usr: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>} />
  ),
  Risk: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>} />
  ),
  ChkSq: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></>} />
  ),
  Sq: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><rect x="3" y="3" width="18" height="18" rx="2" /></>} />
  ),
  Up: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>} />
  ),
  CloudCheck: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" /><path d="M9 12l2 2 4-4" /></>} />
  ),
  Hist: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /><path d="M12 7v5l4 2" /></>} />
  ),
  Img: ({ s = 18, c = '' }) => (
    <I s={s} c={c} d={<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>} />
  ),
};

export const KanbanIcon = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="12" rx="1" /><rect x="17" y="3" width="5" height="15" rx="1" />
  </svg>
);

export const WorkflowIcon = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
  </svg>
);

export const WorkloadIcon = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

export const ValidationIcon = ({ s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l2 2 4-4" />
  </svg>
);

export default ic;
