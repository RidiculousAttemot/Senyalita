"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { AnimationLoader } from "../loader/AnimationLoader";
import type { AnimationClip, GestureAnimationAsset } from "../types";

export const globalLoader = new AnimationLoader();

export function useAnimationClip(gestureLabel: string | null): {
  clip: AnimationClip | null;
  loading: boolean;
  error: string | null;
} {
  const [clip, setClip] = useState<AnimationClip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!gestureLabel) {
      setClip(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    globalLoader.load(gestureLabel).then((asset) => {
      if (cancelled || !mountedRef.current) return;
      setLoading(false);
      if (asset) {
        const newClip: AnimationClip = {
          id: `anim-${gestureLabel}-${Date.now()}`,
          gesture: gestureLabel,
          asset,
        };
        setClip(newClip);
      } else {
        setError(`No animation asset for "${gestureLabel}"`);
        setClip(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [gestureLabel]);

  return { clip, loading, error };
}

export function useAnimationQueue(
  gestureLabels: string[],
): {
  clips: AnimationClip[];
  loading: boolean;
  errors: string[];
  progress: number;
} {
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const labelsKey = useMemo(() => gestureLabels.join(","), [gestureLabels]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors([]);

    const loadAll = async () => {
      const results: AnimationClip[] = [];
      const errs: string[] = [];
      for (let i = 0; i < gestureLabels.length; i++) {
        if (cancelled) return;
        const label = gestureLabels[i];
        const asset = await globalLoader.load(label);
        if (cancelled) return;
        if (asset) {
          results.push({
            id: `anim-${label}-${i}-${Date.now()}`,
            gesture: label,
            asset,
          });
        } else {
          errs.push(label);
        }
      }
      if (!cancelled) {
        setClips(results);
        setErrors(errs);
        setLoading(false);
      }
    };

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [labelsKey]);

  return {
    clips,
    loading,
    errors,
    progress: gestureLabels.length > 0 ? clips.length / gestureLabels.length : 1,
  };
}
