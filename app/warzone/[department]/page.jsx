import { redirect } from 'next/navigation';
import { getDepartmentPath } from '@/lib/warzone';

export default async function WarzoneDeptRedirect({ params, searchParams }) {
  const { department } = await params;
  const sp = await searchParams;
  const path = getDepartmentPath(department);
  const qs = new URLSearchParams(sp).toString();
  redirect(`${path}${qs ? `?${qs}` : ''}`);
}
