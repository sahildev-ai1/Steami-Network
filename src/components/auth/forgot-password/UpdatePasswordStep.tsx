import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { useThemeStore } from '@/stores/theme-store';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

interface UpdatePasswordStepProps {
  /** Email this reset session belongs to (from EmailStep). */
  email: string;
  /** Token returned by the verify-code step — required to complete the reset. */
  resetToken: string;
  onSuccess: () => void;
  onBack: () => void;
  isLight?: boolean;
}

export function UpdatePasswordStep({ email, resetToken, onSuccess, onBack, isLight: propIsLight }: UpdatePasswordStepProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const storeIsLight = useThemeStore((s) => s.theme === 'light');
  const isLight = propIsLight ?? storeIsLight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!resetToken) {
      setError('Your verification session expired. Please start over.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reset_token: resetToken, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reset) {
        throw new Error(data.detail || 'Could not update password. Please try again.');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Could not update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isMatch = password && confirmPassword && password === confirmPassword;

  const inputStyle = {
    background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(10,25,55,0.5)',
    border: `1px solid ${isLight ? 'rgba(147,197,253,0.4)' : 'rgba(111,168,255,0.18)'}`,
    backdropFilter: 'blur(8px)',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="forgot-password-scope"
    >
      <div className="text-center mb-8">
        <h2 className="steami-heading text-2xl mb-2">Create new password</h2>
        <p className="text-[14px] text-muted-foreground">
          Choose a new password for your STEAMI account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="font-mono text-[11px] tracking-wider uppercase text-muted-foreground mb-1.5 block">New password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-3 rounded-xl text-lg transition-all outline-none border-2 focus:border-steami-cyan focus:ring-4 focus:ring-steami-cyan/10"
              style={inputStyle}
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrengthMeter password={password} />
        </div>

        <div>
          <label className="font-mono text-[11px] tracking-wider uppercase text-muted-foreground mb-1.5 block">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              className={`w-full pl-10 pr-10 py-3 rounded-xl text-lg transition-all outline-none border-2 focus:border-steami-cyan focus:ring-4 focus:ring-steami-cyan/10
                ${isMatch ? 'border-emerald-500/30' : ''}
              `}
              style={inputStyle}
            />
            {isMatch && (
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
              >
                <CheckCircle2 className="w-4 h-4" />
              </motion.div>
            )}
          </div>
        </div>

        {error && <p className="text-[11px] font-mono text-destructive">{error}</p>}

        <div className="space-y-3 pt-2">
          <motion.button
            type="submit"
            disabled={loading || !isMatch || password.length < 8}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3.5 rounded-xl font-mono text-[11px] tracking-[0.15em] uppercase text-white shadow-lg relative overflow-hidden group disabled:opacity-50"
            style={{
              background: isLight 
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : 'linear-gradient(135deg, #22d3ee, #0891b2)'
            }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Update password'}
          </motion.button>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 text-[11px] font-mono tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
      </form>
    </motion.div>
  );
}
