import type { ExerciseImage as Img } from '../../program/types';

const url = (src: string) => `${import.meta.env.BASE_URL}${src}`;
const LABELS = ['Старт', 'Подъём', 'Опускание'];

/** Три кадра, как на макете. Для фото из базы (2 кадра) третий кадр — снова исходное положение. */
export function ExerciseImage({ image, name }: { image: Img; name: string }) {
  return (
    <div className="ex-img" role="img" aria-label={name}>
      {LABELS.map((label, i) => (
        <div key={label} className="frame">
          {image.frames === 3 ? (
            <div className="frame-pic" style={{ backgroundImage: `url(${url(image.src)})`, backgroundPosition: `${i * 50}% 50%` }} />
          ) : (
            <img className="frame-photo" src={url(i === 1 ? image.src1 : image.src0)} alt="" loading="lazy" />
          )}
          <span className="frame-n">{i + 1}</span>
          <span className="frame-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
