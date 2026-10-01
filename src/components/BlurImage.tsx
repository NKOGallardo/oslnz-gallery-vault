import { useState } from "react";

/**
 * Blur-up image loader: shows a soft pulsing placeholder until the image
 * has loaded, then fades the photo in (based on the .blurred-img pattern).
 */
export function BlurImage({
  src,
  alt,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  loading?: "lazy" | "eager";
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={"blurred-img" + (loaded ? " loaded" : "")}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
