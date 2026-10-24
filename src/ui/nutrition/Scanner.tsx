// Сканер штрихкодов: задняя камера, распознавание каждые 300 мс (zxing-wasm — в Safari нет BarcodeDetector).
import { useEffect, useRef, useState } from 'react';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { ChevronIcon, Overlay } from '../kit';

export function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const done = useRef(onCode);
  done.current = onCode;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch {
        if (!stopped) setError('Нет доступа к камере — разреши её для сайта в настройках Safari или введи код с упаковки');
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current!;
      v.srcObject = stream;
      await v.play().catch(() => {});
      // wasm берём из своей сборки, а не с CDN по умолчанию.
      const { BarcodeDetector, setZXingModuleOverrides } = await import('barcode-detector/ponyfill');
      setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) });
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const tick = async () => {
        if (stopped) return;
        try {
          const [hit] = v.readyState >= 2 ? await detector.detect(v) : [];
          if (hit?.rawValue && !stopped) return done.current(hit.rawValue);
        } catch {
          /* кадр не прочитался — пробуем следующий */
        }
        timer = setTimeout(tick, 300);
      };
      void tick();
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const code = typed.replace(/\D/g, '');
  return (
    <Overlay>
      <div className="sc">
        <video ref={video} className="sc-video" playsInline muted autoPlay />
        <div className="sc-frame" aria-hidden="true" />
        <header className="sc-head">
          <button className="glass-btn sc-back" aria-label="Закрыть" onClick={onClose}>
            <ChevronIcon dir="left" />
          </button>
          <span>Наведи камеру на штрихкод</span>
        </header>
        <div className="sc-bottom">
          {error && <p className="sc-error">{error}</p>}
          <div className="row">
            <input className="field" aria-label="Штрихкод" inputMode="numeric" placeholder="Или введи цифры кода" value={typed} onChange={(e) => setTyped(e.target.value)} />
            <button className="btn primary" disabled={code.length < 6 || code.length > 14} onClick={() => onCode(code)}>
              Найти
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
