import {
  createKnowledgePage,
  listKnowledgePages,
} from '@/lib/api/knowledge-handlers';

export async function GET(request) {
  return listKnowledgePages(request);
}

export async function POST(request) {
  return createKnowledgePage(request);
}
