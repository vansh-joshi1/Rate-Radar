'use client';

import { useEffect, useRef } from 'react';
import { PlayIcon } from '@phosphor-icons/react/dist/ssr/Play';
import { XIcon } from '@phosphor-icons/react/dist/ssr/X';
import { SPRING } from './Machined';

/*
 * "Watch the demo": a PillCta-shaped button that opens the product walkthrough
 * in a native <dialog>. The dialog gives focus trapping, Escape to close and
 * the top layer for free; a click on the backdrop closes it too. The video
 * only loads once the dialog opens (preload="none") and pauses on close.
 */

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#085ac0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f9ff]';

export default function WatchDemo({ variant = 'primary' }: { variant?: 'primary' | 'secondary' }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const primary = variant === 'primary';

  // React's onClose isn't wired for <dialog>, so pause on the native event.
  // `data-video-open` freezes the page's CSS animations (the radar sweep)
  // while the video plays, so the GPU is only decoding video.
  useEffect(() => {
    const d = dialog.current;
    const onClose = () => {
      video.current?.pause();
      delete document.documentElement.dataset.videoOpen;
    };
    d?.addEventListener('close', onClose);
    return () => {
      d?.removeEventListener('close', onClose);
      delete document.documentElement.dataset.videoOpen;
    };
  }, []);

  const open = () => {
    document.documentElement.dataset.videoOpen = '';
    dialog.current?.showModal();
    video.current?.play().catch(() => {});
  };
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={`group inline-flex items-center justify-between gap-3 whitespace-nowrap rounded-full py-1.5 pl-6 pr-1.5 text-[15px] font-medium transition-[transform,background-color] duration-500 ${SPRING} active:scale-[0.98] motion-reduce:transition-none ${focusRing} ${
          primary
            ? 'bg-[#085ac0] text-white hover:bg-[#06489c]'
            : 'bg-white text-[#0b1c30] ring-1 ring-[#0b1c30]/[0.08] hover:bg-[#f3f5fc]'
        }`}
      >
        Watch the demo
        <span
          aria-hidden
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-500 ${SPRING} group-hover:scale-110 motion-reduce:transition-none ${
            primary ? 'bg-white/15' : 'bg-[#0b1c30]/[0.05]'
          }`}
        >
          <PlayIcon weight="fill" className="h-3.5 w-3.5" />
        </span>
      </button>

      <dialog
        ref={dialog}
        aria-label="Rate Radar demo video"
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(1100px,calc(100vw-2rem))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-[#0b1c30]/90"
      >
        <div className="relative rounded-[1.25rem] bg-[#0b1c30] p-1.5 shadow-[0_32px_64px_-24px_rgba(0,0,0,0.5)]">
          <video
            ref={video}
            src="/rate-radar-demo.mp4"
            controls
            playsInline
            preload="none"
            className="block aspect-video w-full rounded-[calc(1.25rem-0.375rem)] bg-black"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close video"
            className={`absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0b1c30] shadow-md ring-1 ring-[#0b1c30]/[0.08] transition-transform duration-300 hover:scale-105 ${focusRing}`}
          >
            <XIcon weight="bold" className="h-4 w-4" />
          </button>
        </div>
      </dialog>
    </>
  );
}
