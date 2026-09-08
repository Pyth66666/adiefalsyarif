"use client";

import { useEffect, useState } from "react";

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function isFinePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine)").matches;
}

export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(true);
  useEffect(() => {
    setTouch(isTouchDevice());
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setTouch(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return touch;
}
