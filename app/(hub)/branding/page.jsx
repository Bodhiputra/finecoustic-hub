import { redirect } from 'next/navigation';
import { getAboutFinecousticLandingPath } from '@/lib/internal';

export default function BrandingPage() {
  redirect(getAboutFinecousticLandingPath());
}
