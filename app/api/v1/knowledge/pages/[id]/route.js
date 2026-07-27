import {
  getKnowledgePage,
  patchKnowledgePage,
  removeKnowledgePage,
} from '@/lib/api/knowledge-handlers';

export async function GET(request, context) {
  return getKnowledgePage(request, context);
}

export async function PATCH(request, context) {
  return patchKnowledgePage(request, context);
}

export async function DELETE(request, context) {
  return removeKnowledgePage(request, context);
}
