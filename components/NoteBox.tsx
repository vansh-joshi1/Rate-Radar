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
    <div className="card">
      <h3 className="mb-2 text-lg font-bold tracking-tight">Manual notes</h3>
      <p className="mb-3 text-sm text-muted">
        For things no feed knows about — a recruiting day at a nearby campus, a vendor visit, a group booking rumor.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="field mb-3"
        placeholder="e.g. Nissan all-hands Thursday — expect corporate walk-ins"
      />
      <div className="flex items-center gap-3">
        <button onClick={save} className="btn">Save note</button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
    </div>
  );
}
