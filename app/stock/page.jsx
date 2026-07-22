import { redirect } from 'next/navigation';

export default function StockRedirect() {
  redirect('/ops?tool=stock');
}
