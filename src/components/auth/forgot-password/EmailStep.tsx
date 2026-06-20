import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

interface EmailStepProps {
  email: string;
  setEmail: (email: string) => void;
  onNext: () => void;
  onBack: () => void;
  isLight?: boolean;
}

export function EmailStep({ email, setEmail, onNext, onBack, isLight: propIsLight }: EmailStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const storeIsLight = useThemeStore((s) => s.theme === 'light');
  const isLight = propIsLight ?? storeIsLight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Gmail address is required.');
      return;
    }
    // Validation: if the product specifically requires Gmail, validate @gmail.com only
    if (!/\S+@gmail\.com/.test(email)) {
      setError('Please enter a valid @gmail.com address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Could not send verification code. Please try again.');
      }
      // Backend always responds generically (sent-or-not), regardless of
      // whether the email is registered — so we always move to the code step.
      onNext();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        <h2 className="steami-heading text-2xl mb-2">Recover access</h2>
        <p className="text-[14px] text-muted-foreground leading-relaxed">
          Enter the Gmail linked to your STEAMI account. We’ll send a verification code.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="font-mono text-[11px] tracking-wider uppercase text-muted-foreground mb-1.5 block">Gmail Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="name@gmail.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl text-lg transition-all outline-none border-2 focus:border-steami-cyan focus:ring-4 focus:ring-steami-cyan/10"
              style={inputStyle}
            />
          </div>
          {error && <p className="text-[11px] font-mono text-destructive mt-2">{error}</p>}
        </div>

        <div className="space-y-3">
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3.5 rounded-xl font-mono text-[11px] tracking-[0.15em] uppercase text-white shadow-lg relative overflow-hidden group"
            style={{
              background: isLight 
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : 'linear-gradient(135deg, #22d3ee, #0891b2)'
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scanning...</span>
              </div>
            ) : 'Send verification code'}
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
          </motion.button>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 text-[11px] font-mono tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to login
          </button>
        </div>
      </form>
    </motion.div>
  );
}
