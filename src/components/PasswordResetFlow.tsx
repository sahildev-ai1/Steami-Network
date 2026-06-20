import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowLeft, ShieldCheck, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

interface PasswordResetFlowProps {
  onBackToLogin: () => void;
  onSuccess: () => void;
}

type ResetStep = 'email' | 'verify' | 'options' | 'reset' | 'success';

export function PasswordResetFlow({ onBackToLogin, onSuccess }: PasswordResetFlowProps) {
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const isLight = useThemeStore((s) => s.theme === 'light');

  const inputStyle = {
    background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(10,25,55,0.5)',
    border: `1px solid ${isLight ? 'rgba(147,197,253,0.4)' : 'rgba(111,168,255,0.18)'}`,
    backdropFilter: 'blur(8px)',
  };

  const buttonStyle = {
    background: isLight
      ? 'linear-gradient(135deg, hsl(210 100% 50%), hsl(210 100% 42%))'
      : 'linear-gradient(135deg, hsl(218 100% 72%), hsl(218 80% 55%))',
    color: '#fff',
    boxShadow: isLight
      ? '0 4px 20px rgba(59,130,246,0.3)'
      : '0 4px 20px rgba(111,168,255,0.2)',
  };

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
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
      // Backend always returns a generic "sent" message regardless of whether
      // the email is registered (prevents account enumeration), so we always
      // advance to the verify step here.
      setStep('verify');
      setResendCooldown(30);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reset_token) {
        throw new Error(data.detail || 'Invalid or expired code. Please try again.');
      }
      setResetToken(data.reset_token);
      setStep('options');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
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
        body: JSON.stringify({ email, reset_token: resetToken, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reset) {
        throw new Error(data.detail || 'Could not update password. Please try again.');
      }
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Could not update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    return `${name[0]}${'*'.repeat(Math.max(0, name.length - 1))}@${domain}`;
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: '', color: 'transparent', width: '0%' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { label: 'Weak', color: 'hsl(var(--destructive))', width: '33%' };
    if (score <= 4) return { label: 'Good', color: 'hsl(var(--steami-cyan))', width: '66%' };
    return { label: 'Strong', color: 'hsl(142 71% 45%)', width: '100%' };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="px-8 pb-8 pt-2">
      <AnimatePresence mode="wait">
        {step === 'email' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="steami-heading text-xl mb-1 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-steami-cyan" />
                Forgot Password?
              </h2>
              <p className="text-[14px] text-muted-foreground font-medium">
                Enter your email address and we'll send you a verification code.
              </p>
            </div>

            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="font-mono text-[11px] tracking-wider uppercase text-muted-foreground mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-[18px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                    style={inputStyle}
                  />
                </div>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] font-mono text-destructive">
                  {error}
                </motion.p>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 rounded-lg font-mono text-[11px] tracking-[0.12em] uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={buttonStyle}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Verification Code'}
                </motion.button>

                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full py-2.5 rounded-lg font-mono text-[10px] tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back to Login
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6">
              <h2 className="steami-heading text-xl mb-1 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-steami-cyan" />
                Verify Identity
              </h2>
              <p className="text-[14px] text-muted-foreground font-medium">
                Enter the 6-digit code sent to <span className="text-foreground">{maskEmail(email)}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div className="flex justify-center py-2">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(val) => setCode(val)}
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="w-11 h-14 text-xl rounded-lg border-2 border-border/40"
                        style={inputStyle}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] font-mono text-destructive text-center">
                  {error}
                </motion.p>
              )}

              <div className="flex flex-col gap-3">
                <motion.button
                  type="submit"
                  disabled={loading || code.length < 6}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 rounded-lg font-mono text-[11px] tracking-[0.12em] uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={buttonStyle}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Code'}
                </motion.button>

                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Edit Email
                  </button>
                  
                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={async () => {
                      setResendCooldown(30);
                      setError('');
                      try {
                        await fetch(`${API_BASE}/api/auth/forgot-password`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email }),
                        });
                      } catch {
                        // Non-fatal — the cooldown still applies either way,
                        // and the user can try "Resend Code" again after it expires.
                      }
                    }}
                    className="font-mono text-[10px] tracking-wider uppercase text-steami-cyan hover:brightness-110 transition-all disabled:opacity-50 disabled:text-muted-foreground"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}

        {step === 'options' && (
          <motion.div
            key="options"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-steami-cyan/10 flex items-center justify-center border border-steami-cyan/20">
                <CheckCircle2 className="w-10 h-10 text-steami-cyan" />
              </div>
            </div>
            
            <h2 className="steami-heading text-xl mb-2">Email Verified</h2>
            <p className="text-[14px] text-muted-foreground font-medium mb-8">
              Your identity has been confirmed. What would you like to do next?
            </p>

            <div className="space-y-3">
              <motion.button
                onClick={() => setStep('reset')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-lg font-mono text-[11px] tracking-[0.12em] uppercase transition-all"
                style={buttonStyle}
              >
                Update Password
              </motion.button>

              <button
                onClick={onBackToLogin}
                className="w-full py-3 rounded-lg font-mono text-[11px] tracking-[0.12em] uppercase border border-border/40 hover:bg-muted/10 transition-colors"
                style={{ backdropFilter: 'blur(8px)' }}
              >
                Continue to Login
              </button>
            </div>
          </motion.div>
        )}

        {step === 'reset' && (
          <motion.div
            key="reset"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="mb-6">
              <h2 className="steami-heading text-xl mb-1">Create New Password</h2>
              <p className="text-[14px] text-muted-foreground font-medium">
                Set a secure password for your account.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="font-mono text-[11px] tracking-wider uppercase text-muted-foreground mb-1.5 block">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg text-[18px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Strength Meter */}
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground">Strength:</span>
                      <span className="text-[10px] font-mono" style={{ color: strength.color }}>{strength.label}</span>
                    </div>
                    <div className="h-1 w-full bg-border/20 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: strength.width }}
                        className="h-full"
                        style={{ backgroundColor: strength.color }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="font-mono text-[11px] tracking-wider uppercase text-muted-foreground mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg text-[18px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
                    style={inputStyle}
                  />
                </div>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] font-mono text-destructive">
                  {error}
                </motion.p>
              )}

              <motion.button
                type="submit"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-lg font-mono text-[11px] tracking-[0.12em] uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                style={buttonStyle}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
              </motion.button>
            </form>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4"
          >
            <div className="flex justify-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-steami-cyan/10 flex items-center justify-center border border-steami-cyan/30 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
              >
                <CheckCircle2 className="w-12 h-12 text-steami-cyan" />
              </motion.div>
            </div>
            
            <h2 className="steami-heading text-2xl mb-2">All Set!</h2>
            <p className="text-[14px] text-muted-foreground font-medium mb-8">
              Your password has been successfully updated. You can now log in with your new credentials.
            </p>

            <motion.button
              onClick={onBackToLogin}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-lg font-mono text-[11px] tracking-[0.12em] uppercase transition-all"
              style={buttonStyle}
            >
              Go to Login
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
