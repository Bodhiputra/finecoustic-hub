import {
  createPersonalJotHandler,
  listPersonalJots,
} from '@/lib/api/personal-jots-handlers';

export async function GET() {
  return listPersonalJots();
}

export async function POST(request) {
  return createPersonalJotHandler(request);
}
