'use client';

import Link from 'next/link';
import Image from 'next/image';

type BrandLogoProps = {
  /** Pixel width/height of the mark (square). */
  size?: number;
  /** Show “Synq” wordmark next to the mark. */
  showWordmark?: boolean;
  /** Wordmark typography: matches main app nav vs landing hero. */
  variant?: 'nav' | 'landing';
  className?: string;
};

export default function BrandLogo({
  size = 36,
  showWordmark = true,
  variant = 'nav',
  className = '',
}: BrandLogoProps) {
  const wordClasses =
    variant === 'landing'
      ? 'text-2xl font-black text-white tracking-tighter uppercase'
      : 'text-xl font-bold text-white tracking-tight';

  return (
    <Link
      href="/"
      className={`flex items-center gap-3 group ${className}`}
    >
      <Image
        src="/synq-logo.png"
        alt="Synq"
        width={size}
        height={size}
        className="object-contain shrink-0 group-hover:opacity-90 transition-opacity"
        priority
      />
      {showWordmark ? <span className={wordClasses}>Synq</span> : null}
    </Link>
  );
}
