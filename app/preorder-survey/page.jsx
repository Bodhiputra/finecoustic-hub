import { redirect } from 'next/navigation';

export default function PreorderSurveyRedirect() {
  redirect('/marketing?tool=preorder-survey');
}
