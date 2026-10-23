import type { ExerciseImage as Img } from '../../program/types';

const url = (src: string) => `${import.meta.env.BASE_URL}${src}`;
const LABELS = ['Старт', 'Подъём', 'Опускание'];

export function ExerciseImage({ image, name }: { image: Img; name: string }) {
  if (image.frames === 3) {
    return (
      <div className="ex-img three" role="img" aria-label={name}>
        {[0, 50, 100].map((pos, i) => (
          <div key={pos} className="frame" style={{ backgroundImage: `url(${url(image.src)})`, backgroundPosition: `${pos}% 50%` }}>
            <span className="frame-n">{i + 1}</span>
            <span className="frame-label">{LABELS[i]}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="ex-img two">
      {[image.src0, image.src1].map((src, i) => (
        <div key={src} className="frame photo">
          <img src={url(src)} alt={`${name}, кадр ${i + 1}`} loading="lazy" />
          <span className="frame-n">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}
