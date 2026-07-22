import { redirect } from 'next/navigation';

export default function CustomersRedirect() {
  redirect('/ops?tool=customers');
}
