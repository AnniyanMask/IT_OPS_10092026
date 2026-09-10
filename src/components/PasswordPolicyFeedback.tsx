import React from 'react';
import { validatePasswordPolicy } from '../utils/passwordPolicy';
import { Check, X, ShieldCheck, ShieldAlert } from 'lucide-react';

interface PasswordPolicyFeedbackProps {
  password: string;
  showTitle?: boolean;
  className?: string;
}

export const PasswordPolicyFeedback: React.FC<PasswordPolicyFeedbackProps> = ({
  password,
  showTitle = true,
  className = '',
}) => {
  const result = validatePasswordPolicy(password);

  const criteria = [
    { label: 'At least 10 characters in length', met: result.length },
    { label: 'At least one uppercase letter (A-Z)', met: result.hasUppercase },
    { label: 'At least one number (0-9)', met: result.hasNumber },
    { label: 'At least one special character (!@#$%^&* etc.)', met: result.hasSpecial },
  ];

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all text-xs ${
        result.isValid
          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      } ${className}`}
    >
      {showTitle && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5 font-bold">
            {result.isValid ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-500" />
            )}
            <span className="text-[11px] uppercase tracking-wider">
              Enterprise Password Policy Compliance
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase ${
              result.isValid
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
          >
            {result.isValid ? 'COMPLIANT' : 'NON-COMPLIANT'}
          </span>
        </div>
      )}

      <ul className="space-y-1.5 text-[11px]">
        {criteria.map((item, idx) => (
          <li
            key={idx}
            className={`flex items-center space-x-2 transition-colors ${
              item.met
                ? 'text-emerald-700 font-semibold'
                : password.length > 0
                ? 'text-rose-600'
                : 'text-slate-500'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold transition-all ${
                item.met
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {item.met ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
