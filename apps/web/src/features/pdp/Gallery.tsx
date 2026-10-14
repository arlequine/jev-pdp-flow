interface Props {
  product: { name: string };
  images: string[];
  imageIndex: number;
  setImageIndex: (i: number) => void;
  colorOfImage: (img: string) => string;
}

/** Imagen principal y miniaturas. La imagen sigue al color elegido. */
export function Gallery({ product, images, imageIndex, setImageIndex, colorOfImage }: Props) {
  return (
        <div className="pdp-gallery">
          <img
            src={images[imageIndex]}
            className="pdp-main-image"
            width={800}
            height={800}
            alt={`${product.name} en color ${colorOfImage(images[imageIndex])}`}
          />
          <div className="pdp-thumbs" role="group" aria-label="Fotos del producto">
            {images.map((img: string, i: number) => (
              <button
                key={img}
                type="button"
                className={i === imageIndex ? 'pdp-thumb is-active' : 'pdp-thumb'}
                aria-label={`Ver foto ${i + 1}: ${product.name} en color ${colorOfImage(img)}`}
                aria-pressed={i === imageIndex}
                onClick={() => setImageIndex(i)}
              >
                <img src={img} alt="" width={90} height={90} />
              </button>
            ))}
          </div>
        </div>
  );
}
