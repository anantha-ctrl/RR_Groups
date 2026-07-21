import { useState } from 'react';
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, Loader2,
  AlertCircle, Phone, KeyRound, X, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../auth';
import { apiCall } from '../supabaseClient';

export function LoginScreen({ onBack }: { onBack?: () => void }) {
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const value = email.trim();
    if (!value.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await signIn(value, password, remember);
    } catch {
      // error handled by auth context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex w-[46%] bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-brand-400 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-brand-500 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <img
              src="/assets/rr-groups-logo.png"
              alt="RR Groups"
              className="w-12 h-12 rounded-full object-cover ring-2 ring-white/30 shadow-lg"
            />
            <div>
              <p className="font-extrabold text-xl tracking-tight">RR Groups</p>
              <p className="text-brand-200 text-xs">Loan &amp; Collection Suite</p>
            </div>
          </div>

          <div>
            <h1 className="text-4xl font-extrabold leading-tight mb-4">
              Your lending business,<br />
              <span className="bg-gradient-to-r from-brand-200 to-brand-400 bg-clip-text text-transparent">
                fully in control.
              </span>
            </h1>
            <p className="text-brand-100 text-base max-w-md leading-relaxed">
              Loans, repayments, chit funds and field collections — RR Groups brings your
              entire operation into one powerful, real-time platform built for Indian lenders.
            </p>
            <div className="grid grid-cols-3 gap-4 mt-8 max-w-md">
              {[
                { label: 'Loans Disbursed', value: '₹12 Cr+' },
                { label: 'Field Agents', value: '180+' },
                { label: 'Uptime SLA', value: '99.9%' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-brand-200 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-brand-200 text-xs">
            <ShieldCheck className="w-4 h-4" />
            Encrypted, signed sessions • Role-based access control
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-ink-50">
        <div className="w-full max-w-md">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-700 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to home
            </button>
          )}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <img
              src="/assets/rr-groups-logo.png"
              alt="RR Groups"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-brand-200 shadow-sm"
            />
            <div>
              <p className="font-extrabold text-ink-900">RR Groups</p>
              <p className="text-[10px] text-ink-400">Loan &amp; Collection Suite</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-ink-900">Welcome back</h2>
          <p className="text-sm text-ink-500 mt-1.5 mb-6">Sign in to your RR Groups account to continue.</p>

          {(localError || error) && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-3.5 py-2.5 mb-4 animate-scale-in">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{localError ?? error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@fincollect.in"
                  className="input pl-10"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                >
                  {showPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-ink-600">Remember login</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-brand-600 font-semibold hover:text-brand-700"
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="mt-5 flex items-center gap-2 text-xs text-ink-400 bg-ink-100/60 rounded-xl px-3.5 py-2.5">
            <ShieldCheck className="w-4 h-4 text-ink-400" />
            Protected by encrypted, signed sessions with role-based access.
          </div>

        </div>
      </div>

      {showForgot && (
        <ForgotPasswordModal
          initialEmail={email}
          onClose={() => setShowForgot(false)}
          onDone={(resetEmail) => {
            setShowForgot(false);
            setEmail(resetEmail);
            setPassword('');
            setLocalError(null);
          }}
        />
      )}
    </div>
  );
}

type ResetStep = 'identity' | 'verify' | 'done';

function ForgotPasswordModal({
  initialEmail,
  onClose,
  onDone,
}: {
  initialEmail: string;
  onClose: () => void;
  onDone: (email: string) => void;
}) {
  const [step, setStep] = useState<ResetStep>('identity');
  const [email, setEmail] = useState(initialEmail);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  // Step 1 — verify identity and request an OTP.
  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim().includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (mobile.replace(/\D+/g, '').length < 6) {
      setError('Please enter your registered mobile number.');
      return;
    }
    setLoading(true);
    const { data, error: apiErr } = await apiCall<{
      sent_to?: string;
      email_masked?: string;
      channels?: string[];
      demo_otp?: string;
    }>('auth.php?action=request_otp', {
      method: 'POST',
      body: { email: email.trim(), mobile: mobile.trim() },
    });
    setLoading(false);
    if (apiErr) {
      setError(apiErr.message || 'Could not send OTP. Please try again.');
      return;
    }
    setSentTo(data?.sent_to ?? '');
    setEmailMasked(data?.email_masked ?? '');
    setChannels(data?.channels ?? []);
    setDemoOtp(data?.demo_otp ?? null);
    setOtp('');
    setStep('verify');
  }

  // Step 2 — verify the OTP and set the new password.
  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (otp.replace(/\D+/g, '').length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    setLoading(true);
    const { error: apiErr } = await apiCall('auth.php?action=reset_password', {
      method: 'POST',
      body: { email: email.trim(), mobile: mobile.trim(), otp: otp.trim(), new_password: newPassword },
    });
    setLoading(false);
    if (apiErr) {
      setError(apiErr.message || 'Could not reset password. Please try again.');
      return;
    }
    setStep('done');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <KeyRound className="w-[18px] h-[18px]" />
            </div>
            <div>
              <p className="font-bold text-ink-900 leading-tight">Reset Password</p>
              {step !== 'done' && (
                <p className="text-[11px] text-ink-400">Step {step === 'identity' ? '1' : '2'} of 2</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-ink-100 text-ink-400 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && step !== 'done' && (
          <div className="mx-5 mt-4 flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-3.5 py-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'identity' && (
          <form onSubmit={sendOtp} className="p-5 space-y-4">
            <p className="text-sm text-ink-500">
              Verify your identity with your registered email and mobile number. We'll send a
              one-time code (OTP) to confirm it's you.
            </p>

            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Registered Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Mobile on file"
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
            </button>
            <p className="text-xs text-ink-400 text-center">
              Don't remember your mobile on file? Contact your administrator to reset it.
            </p>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={submitReset} className="p-5 space-y-4">
            <p className="text-sm text-ink-500">
              {channels.includes('email') && channels.includes('sms') ? (
                <>We sent a 6-digit OTP to your email <span className="font-semibold text-ink-700">{emailMasked}</span> and mobile ending <span className="font-semibold text-ink-700">{sentTo}</span>.</>
              ) : channels.includes('email') ? (
                <>We sent a 6-digit OTP to your email <span className="font-semibold text-ink-700">{emailMasked}</span>.</>
              ) : channels.includes('sms') ? (
                <>We sent a 6-digit OTP to your mobile ending <span className="font-semibold text-ink-700">{sentTo}</span>.</>
              ) : (
                <>Enter the 6-digit OTP below.</>
              )}{' '}
              Enter it below and set your new password.
            </p>

            {demoOtp && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3.5 py-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Demo mode — your OTP is <span className="font-bold tracking-widest">{demoOtp}</span></span>
              </div>
            )}

            <div>
              <label className="label">One-Time Password (OTP)</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D+/g, ''))}
                  placeholder="6-digit code"
                  className="input pl-10 tracking-[0.4em] font-semibold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="input pl-10 pr-10"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                >
                  {showPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  className="input pl-10"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Reset Password'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('identity'); setError(null); }}
              className="text-xs text-ink-500 hover:text-brand-700 font-medium w-full text-center"
            >
              ← Change email / mobile
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="font-bold text-ink-900">Password updated</p>
            <p className="text-sm text-ink-500 mt-1">
              You can now sign in with your new password.
            </p>
            <button className="btn-primary w-full mt-5" onClick={() => onDone(email.trim())}>
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
