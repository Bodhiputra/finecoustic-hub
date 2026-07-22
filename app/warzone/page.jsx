import { redirect } from 'next/navigation';

export default async function WarzoneRedirect({ searchParams }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(sp).toString();
  redirect(`/tasks${qs ? `?${qs}` : ''}`);
}
