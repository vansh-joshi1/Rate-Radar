import AuthPanes from '../../components/AuthPanes';

/**
 * Sign-in. The UI is shared with /signup (same split-screen, two tabs) —
 * this route just decides which tab opens first.
 */
export default function Login() {
  return <AuthPanes initialTab="signin" />;
}
