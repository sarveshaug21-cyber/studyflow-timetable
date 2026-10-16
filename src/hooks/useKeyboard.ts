import { useEffect, useCallback, useRef } from 'react';

export function useKeyboard(onKeyDown: (event: KeyboardEvent) => void, deps: React.DependencyList = []) {
  const onKeyDownRef = useRef(onKeyDown);
  onKeyDownRef.current = onKeyDown;

  const depsRef = useRef(deps);
  depsRef.current = deps;

  const handler = useCallback((event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as HTMLElement).isContentEditable) {
      return;
    }
    onKeyDownRef.current(event);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

export function useEscapeKey(onEscape: () => void, deps: React.DependencyList = []) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  const depsRef = useRef(deps);
  depsRef.current = deps;

  useKeyboard(
    useCallback((e) => {
      if (e.key === 'Escape') {
        onEscapeRef.current();
      }
    }, []),
    deps
  );
}

export function useArrowNavigation(
  onUp: () => void,
  onDown: () => void,
  onLeft: () => void,
  onRight: () => void,
  deps: React.DependencyList = []
) {
  const callbacksRef = useRef({ onUp, onDown, onLeft, onRight });
  callbacksRef.current = { onUp, onDown, onLeft, onRight };

  const depsRef = useRef(deps);
  depsRef.current = deps;

  useKeyboard(
    useCallback((e) => {
      const { onUp, onDown, onLeft, onRight } = callbacksRef.current;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onDown();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onRight();
          break;
      }
    }, []),
    deps
  );
}