import { useState, useEffect, useRef } from 'react';
import { evaluateAmountExpression } from '../lib/utils';

/** Champ montant avec calculatrice : accepte des expressions (ex: 100+50, 200*1.2) évaluées au blur / Entrée. */
export default function AmtInput({ value, onChange, className = '', placeholder = '', style = {} }) {
  const defaultPlaceholder = 'ex: 45 000 ou 100+50';
  const [raw, setRaw] = useState(value === 0 || value === '' ? '' : String(value));
  const isFocusedRef = useRef(false);
  const rawRef = useRef(raw);
  rawRef.current = raw;
  useEffect(() => {
    if (!isFocusedRef.current) {
      const r = String(rawRef.current || '').trim();
      const hasOperator = /[+\-*/]/.test(r) && /[\d]/.test(r);
      if (!r || !hasOperator) setRaw(value === 0 || value === '' ? '' : String(value));
    }
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      placeholder={placeholder || defaultPlaceholder}
      className={className}
      style={style}
      onFocus={() => { isFocusedRef.current = true; }}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        setRaw(v);
        if (v === '' || v === '-') onChange('');
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        const v = String(rawRef.current || raw).trim().replace(/,/g, '.').replace(/\s/g, '');
        if (v === '' || v === '-') {
          setRaw(v);
          onChange('');
          return;
        }
        const fromExpr = evaluateAmountExpression(v);
        if (fromExpr !== null && isFinite(fromExpr)) {
          setRaw(String(fromExpr));
          onChange(fromExpr);
        } else {
          const n = parseFloat(v);
          if (isNaN(n)) {
            setRaw('');
            onChange('');
          } else {
            setRaw(String(n));
            onChange(n);
          }
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      }}
    />
  );
}
