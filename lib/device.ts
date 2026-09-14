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

export function useCompactExperience(): boolean {
  const [compact, setCompact] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return compact;
}
