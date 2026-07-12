'use client';
import { useState } from 'react';

export default function Login() {
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get('password');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) window.location.href = '/';
    else setError('Wrong password.');
  }

  return (
    <main style={{ maxWidth: 360, marginTop: '18vh' }}>
      <h1>Rate Radar</h1>
      <p className="muted small">Red Roof Inn Franklin, TN — internal use.</p>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input name="password" type="password" placeholder="Password" autoFocus style={{ flex: 1 }} />
        <button type="submit">Enter</button>
      </form>
      {error && <p style={{ color: 'var(--bad)', marginTop: 10 }}>{error}</p>}
    </main>
  );
}
