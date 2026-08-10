"use client";

import { useRef, type KeyboardEvent } from "react";

/**
 * Guards key handlers against a Japanese (or Chinese/Korean) IME.
 *
 * While converting kana to kanji the IME uses the arrow keys to walk the
 * candidate list and Enter to confirm the choice — but those arrive at the page
 * as ordinary key events. A handler that acts on them steals the keystroke from
 * the IME: the conversion never commits, and code that clears the field on
 * Enter wipes what was being typed. It looks like the input has stopped
 * accepting text even though it still has focus.
 *
 * Spread `imeProps` onto the field and start the key handler with
 * `if (composing(e)) return;`.
 */
export function useIme() {
  const active = useRef(false);
  const endedAt = useRef(0);

  return {
    imeProps: {
      onCompositionStart: () => {
        active.current = true;
      },
      onCompositionEnd: () => {
        active.current = false;
        endedAt.current = Date.now();
      },
    },

    composing(e: KeyboardEvent) {
      return (
        active.current ||
        e.nativeEvent.isComposing ||
        // The pre-`isComposing` signal, still what some mobile keyboards send.
        e.keyCode === 229 ||
        // Safari ends the composition *before* delivering the Enter that
        // confirmed it, so that Enter looks like any other — ignore keys for a
        // moment after a conversion finishes. A deliberate second Enter is well
        // outside this window.
        Date.now() - endedAt.current < 60
      );
    },
  };
}
