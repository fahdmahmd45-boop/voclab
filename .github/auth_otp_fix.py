from pathlib import Path

p = Path('auth.js')
s = p.read_text(encoding='utf-8')

replacements = [
    ('We sent a 6-digit verification code to <strong>${escapeHtml(maskEmail(pendingEmail))}</strong>.',
     'We sent a verification code to <strong>${escapeHtml(maskEmail(pendingEmail))}</strong>.'),
    ('maxlength="6" placeholder="••••••"', 'maxlength="8" placeholder="••••••••"'),
    ("otp.addEventListener('input', () => { otp.value = otp.value.replace(/\\D/g, '').slice(0, 6); if (otp.value.length === 6) verifyOtp(); });",
     "otp.addEventListener('input', () => { otp.value = otp.value.replace(/\\D/g, '').slice(0, 8); });"),
    ('No password and no SMS fees. We’ll send a 6-digit verification code to your email.',
     'No password and no SMS fees. We’ll send a verification code to your email.'),
    ('Check your inbox and spam folder for the 6-digit code. New users are created automatically after verification.',
     'Check your inbox and spam folder for the verification code. New users are created automatically after verification.'),
    ("const token = String(input?.value || '').replace(/\\D/g, '').slice(0, 6);\n    if (token.length !== 6) {\n      setError('Enter the 6-digit verification code.');",
     "const token = String(input?.value || '').replace(/\\D/g, '').slice(0, 8);\n    if (token.length < 6 || token.length > 8) {\n      setError('Enter the complete verification code from your email.');"),
]

for old, new in replacements:
    if old not in s:
        raise SystemExit(f'Missing expected auth.js snippet: {old[:80]}')
    s = s.replace(old, new, 1)

old_timer = '''  function startResendTimer() {
    stopResendTimer();
    resendSeconds = 60;
    resendTimer = setInterval(() => {
      resendSeconds -= 1;
      if (resendSeconds <= 0) stopResendTimer();
      if (!session?.user && pendingEmail && document.getElementById('vocAuthOverlay')?.classList.contains('open')) renderAuthBody();
    }, 1000);
  }
'''
new_timer = '''  function updateResendButton() {
    const resend = document.getElementById('vocResendBtn');
    if (!resend) return;
    resend.disabled = resendSeconds > 0;
    resend.textContent = resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code';
  }

  function startResendTimer() {
    stopResendTimer();
    resendSeconds = 60;
    updateResendButton();
    resendTimer = setInterval(() => {
      resendSeconds = Math.max(0, resendSeconds - 1);
      updateResendButton();
      if (resendSeconds <= 0) stopResendTimer();
    }, 1000);
  }
'''
if old_timer not in s:
    raise SystemExit('Missing expected resend timer block')
s = s.replace(old_timer, new_timer, 1)

p.write_text(s, encoding='utf-8')
print('Patched auth.js OTP input and resend timer.')
