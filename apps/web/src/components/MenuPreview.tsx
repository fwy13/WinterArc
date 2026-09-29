import { useEffect, useRef } from 'react';
import type { GameId } from 'winterarc-core';
import { MenuPreviewEngine } from '../engine/MenuPreviewEngine';

interface Props {
  selected: GameId;
  active: boolean;
  onready: () => void;
  onerror: (error: unknown) => void;
}

export default function MenuPreview({ selected, active, onready, onerror }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<MenuPreviewEngine | null>(null);
  const cbRef = useRef({ onready, onerror });
  cbRef.current = { onready, onerror };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let instance: MenuPreviewEngine | null = null;
    try {
      instance = new MenuPreviewEngine(canvas);
      previewRef.current = instance;
      void instance
        .initialize()
        .then(() => {
          if (!disposed) cbRef.current.onready();
        })
        .catch((error) => {
          if (!disposed) cbRef.current.onerror(error);
        });
    } catch (error) {
      cbRef.current.onerror(error);
    }
    return () => {
      disposed = true;
      instance?.dispose();
      previewRef.current = null;
    };
  }, []);

  useEffect(() => {
    previewRef.current?.select(selected);
  }, [selected]);
  useEffect(() => {
    previewRef.current?.setActive(active);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 h-dvh w-full ${active ? '' : 'invisible'}`}
      aria-hidden="true"
    />
  );
}
