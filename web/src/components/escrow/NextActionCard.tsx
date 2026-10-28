import Link from 'next/link';
import {Icon} from './Icon';
export function NextActionCard({ title, description, href, label, eyebrow = 'Needs your review' }: { title: string; description: string; href: string; label: string; eyebrow?: string }) {
  return <section className="esc-next"><div className="esc-next-symbol"><Icon name="proof" size={26}/></div><div><p className="esc-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div><Link className="esc-button primary" href={href}>{label}<Icon name="arrow" size={16}/></Link></section>;
}
