import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  compact?: boolean;
  className?: string;
  imageClassName?: string;
  showText?: boolean;
};

const LOGO_SRC = "/aubox%20logo%20dark.png";

export default function BrandMark({
  href,
  compact = false,
  className = "",
  imageClassName = "",
  showText = true,
}: BrandMarkProps) {
  const imageSize = compact ? 28 : 34;
  const content = (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src={LOGO_SRC}
        alt="Aubox logo"
        width={imageSize}
        height={imageSize}
        className={`rounded-md object-contain ${imageClassName}`}
        priority
      />
      {showText ? <span className="text-sm font-semibold tracking-tight text-[var(--ink)]">Aubox</span> : null}
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} aria-label="Aubox home" className="inline-flex">
      {content}
    </Link>
  );
}
