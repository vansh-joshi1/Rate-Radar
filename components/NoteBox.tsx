'use client';
import { useState } from 'react';

export default function NoteBox({ date, initial }: { date: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState('');

  async function save() {
    setStatus('saving…');
    const res = await fetch('/api/note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, text }),
    });
    setStatus(res.ok ? 'saved' : 'failed');
  }

  return (
    <section>
      <h2>Manual note for today</h2>
      <p className="muted small" style={{ marginBottom: 8 }}>
        For things no feed knows about — e.g. a recruiting day at Nissan NA or CHS, a vendor visit, a group booking rumor.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          style={{ flex: 1 }}
          placeholder="e.g. Nissan all-hands Thursday — expect corporate walk-ins"
        />
        <button onClick={save}>Save</button>
      </div>
      {status && <p className="muted small" style={{ marginTop: 6 }}>{status}</p>}
    </section>
  );
}
