import Link from 'next/link';
import Icon from '@/components/Icon';

/** Back navigation — matches internal-board-back styling. */
export default function HubBackLink({ href, label, className = '' }) {
  return (
    <Link href={href} className={`internal-board-back${className ? ` ${className}` : ''}`}>
      <Icon name="arrowLeft" size={14} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
