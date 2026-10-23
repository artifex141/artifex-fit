// Сигнал конца отдыха.
// На iPhone Web Audio глушится переключателем «Без звука», а обычный <audio> — нет, поэтому играем WAV через <audio>.
// iOS разрешает звук только после нажатия: unlockSound() надо вызвать синхронно внутри обработчика нажатия.

const RATE = 22050;

/** Два коротких тона (880 и 1320 Гц) в 16-битном моно WAV. */
export function makeBeepWav(): Uint8Array {
  const tones: [number, number][] = [
    [880, 0.18],
    [0, 0.06],
    [1320, 0.22],
  ];
  const samples = tones.reduce((n, [, d]) => n + Math.round(d * RATE), 0);
  const wav = new Uint8Array(44 + samples * 2);
  const v = new DataView(wav.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, wav.length - 8, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // моно
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples * 2, true);
  let o = 44;
  for (const [f, d] of tones) {
    const n = Math.round(d * RATE);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / 200, (n - i) / 200); // мягкие края без щелчков
      const s = f ? Math.sin((2 * Math.PI * f * i) / RATE) * 0.6 * env : 0;
      v.setInt16(o, s * 32767, true);
      o += 2;
    }
  }
  return wav;
}

let el: HTMLAudioElement | null = null;
let unlocked = false;

export function unlockSound() {
  try {
    // Короткий звук, приглушающий музыку, а не останавливающий её (Safari 17+).
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'transient';
    if (!el) {
      el = new Audio(URL.createObjectURL(new Blob([makeBeepWav()], { type: 'audio/wav' })));
      el.preload = 'auto';
    }
    if (!unlocked) {
      el.muted = true;
      void el
        .play()
        .then(() => {
          el!.pause();
          el!.currentTime = 0;
          el!.muted = false;
          unlocked = true;
        })
        .catch(() => {
          el!.muted = false;
        });
    }
  } catch {
    /* без звука */
  }
}

export function playBeep() {
  if (!el) return;
  el.muted = false;
  el.currentTime = 0;
  void el.play().catch(() => {});
}
