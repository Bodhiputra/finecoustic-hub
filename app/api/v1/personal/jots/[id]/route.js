import {
  deletePersonalJotHandler,
  getPersonalJot,
  patchPersonalJot,
} from '@/lib/api/personal-jots-handlers';

export async function GET(request, context) {
  return getPersonalJot(request, context);
}

export async function PATCH(request, context) {
  return patchPersonalJot(request, context);
}

export async function DELETE(request, context) {
  return deletePersonalJotHandler(request, context);
}
