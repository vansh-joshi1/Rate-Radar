import AuthPanes from '../../components/AuthPanes';

/**
 * Access is invite-gated (this is a real hotel's revenue data): the owner adds
 * teammates in Settings → Team; anyone invited signs in with a magic link.
 * Uninvited emails get an honest explanation, not an account. Shares the
 * split-screen UI with /login — this route just opens on the "Get access" tab.
 */
export default function Signup() {
  return <AuthPanes initialTab="signup" />;
}
