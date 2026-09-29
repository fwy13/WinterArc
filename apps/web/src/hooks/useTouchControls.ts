import { useEffect, useState } from 'react';
import { hasTouchControls } from '../engine/TouchInput';
export function useTouchControls(): boolean {
  const [touch, setTouch] = useState(hasTouchControls);
  useEffect(() => {
    const query = window.matchMedia('(any-pointer: coarse)');
    const update = () => setTouch(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return touch;
}
