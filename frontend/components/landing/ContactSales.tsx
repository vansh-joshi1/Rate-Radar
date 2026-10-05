'use client';

import { useRef, useState } from 'react';
import { CheckCircleIcon } from '@phosphor-icons/react/dist/ssr/CheckCircle';
import { XIcon } from '@phosphor-icons/react/dist/ssr/X';
import { Bezel, PillButton } from './Machined';
import { FIELD, LABEL } from '../AuthPanes';

/*
 * Enterprise "Contact us": opens a native <dialog> (focus trap, Escape, top
 * layer for free, as in WatchDemo) with a short form that emails the owner
 * through /api/contact. A click on the backdrop closes it.
 */

const empty = { name: '', email: '', phone: '', properties: '', details: '' };

export default function ContactSales() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(empty);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const open = () => {
    if (state === 'sent') {
      setForm(empty);
      setState('idle');
    }
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => null);
    setState(res?.ok ? 'sent' : 'error');
  }

  return (
    <>
      <PillButton type="button" variant="secondary" onClick={open}>
        Contact us
      </PillButton>

      <dialog
        ref={dialog}
        aria-labelledby="contact-title"
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[calc(100%-2rem)] max-w-[480px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[2rem] bg-transparent p-0 backdrop:bg-[#0b1c30]/40 backdrop:backdrop-blur-sm"
      >
        <Bezel core="relative p-7">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[#44474d] transition-colors hover:bg-[#0b1c30]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40"
          >
            <XIcon weight="bold" className="h-4 w-4" />
          </button>

          {state === 'sent' ? (
            <>
              <CheckCircleIcon weight="fill" aria-hidden className="h-8 w-8 text-[#029768]" />
              <h2 id="contact-title" className="mt-4 text-[24px] font-semibold tracking-tight text-[#0b1c30]">
                Thanks, {form.name.split(' ')[0]}
              </h2>
              <p className="mt-3 text-pretty text-[15px] leading-relaxed text-[#44474d]">
                We&rsquo;ll be in touch at <span className="break-all font-medium text-[#1a1b20]">{form.email}</span>.
              </p>
              <PillButton type="button" className="mt-6 w-full" onClick={close}>
                Done
              </PillButton>
            </>
          ) : (
            <form onSubmit={submit}>
              <h2 id="contact-title" className="pr-10 text-[24px] font-semibold tracking-tight text-[#0b1c30]">
                Talk to us about Enterprise
              </h2>
              <p className="mt-2 text-pretty text-[15px] leading-relaxed text-[#44474d]">
                Tell us about your portfolio and we&rsquo;ll get back to you.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className={LABEL} htmlFor="contact-name">Name</label>
                  <input id="contact-name" required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={set('name')} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="contact-email">Work email</label>
                  <input id="contact-email" type="email" required maxLength={200} autoComplete="email" value={form.email} onChange={set('email')} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="contact-phone">Phone number</label>
                  <input id="contact-phone" type="tel" required pattern="(?:\D*\d){10,}\D*" title="At least 10 digits" maxLength={40} autoComplete="tel" value={form.phone} onChange={set('phone')} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="contact-properties">Number of properties</label>
                  <input id="contact-properties" type="number" required min={1} max={10000} inputMode="numeric" value={form.properties} onChange={set('properties')} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="contact-details">
                    Additional details <span className="font-normal text-[#6b6e75]">(optional)</span>
                  </label>
                  <textarea
                    id="contact-details"
                    rows={4}
                    maxLength={2000}
                    value={form.details}
                    onChange={set('details')}
                    placeholder="PMS, markets, timeline, anything else"
                    className={`${FIELD.replace('h-12', 'h-auto').replace('rounded-full', 'rounded-[1.25rem]')} resize-y py-3`}
                  />
                </div>
              </div>

              {state === 'error' && (
                <p role="alert" className="mt-4 text-[14px] text-[#b45309]">
                  That didn&rsquo;t send. Try again in a moment.
                </p>
              )}

              <PillButton type="submit" className="mt-6 w-full" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Send'}
              </PillButton>
            </form>
          )}
        </Bezel>
      </dialog>
    </>
  );
}
