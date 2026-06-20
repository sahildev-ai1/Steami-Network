import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useThemeStore } from '@/stores/theme-store';
import { RecoverySignalAnimation } from './RecoverySignalAnimation';
import { EmailStep } from './EmailStep';
import { CodeStep } from './CodeStep';
import { RecoveryOptionsStep } from './RecoveryOptionsStep';
import { UpdatePasswordStep } from './UpdatePasswordStep';
import { RecoverySuccessStep } from './RecoverySuccessStep';

import { ForgotPasswordStep } from './types';

interface ForgotPasswordFlowProps {
  onClose: () => void;
  onBackToLogin: () => void;
}

export function ForgotPasswordFlow({ onClose, onBackToLogin }: ForgotPasswordFlowProps) {
  const [step, setStep] = useState<ForgotPasswordStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const isLight = useThemeStore((s) => s.theme === 'light');

  const handleContinueToAccount = () => {
    // Frontend-only shortcut: the user verified their email but chose not to
    // set a new password. There's no backend session issuance for this path,
    // so we just close the flow — they log in with their existing password.
    onClose();
  };

  return (
    <div className="forgot-password-scope w-full max-w-md mx-auto">
      {/* Animation Header */}
      <RecoverySignalAnimation step={step} />

      <div className="px-2">
        <AnimatePresence mode="wait">
          {step === 'email' && (
            <EmailStep
              key="email"
              email={email}
              setEmail={setEmail}
              onNext={() => setStep('code')}
              onBack={onBackToLogin}
              isLight={isLight}
            />
          )}

          {step === 'code' && (
            <CodeStep
              key="code"
              email={email}
              code={code}
              setCode={setCode}
              onNext={(token) => { setResetToken(token); setStep('options'); }}
              onBack={() => setStep('email')}
              isLight={isLight}
            />
          )}

          {step === 'options' && (
            <RecoveryOptionsStep
              key="options"
              onContinue={handleContinueToAccount}
              onUpdatePassword={() => setStep('update-password')}
              isLight={isLight}
            />
          )}

          {step === 'update-password' && (
            <UpdatePasswordStep
              key="update-password"
              email={email}
              resetToken={resetToken}
              onSuccess={() => setStep('success')}
              onBack={() => setStep('options')}
              isLight={isLight}
            />
          )}

          {step === 'success' && (
            <RecoverySuccessStep
              key="success"
              onBackToLogin={onBackToLogin}
              isLight={isLight}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
