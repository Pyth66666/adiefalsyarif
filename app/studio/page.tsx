import { CmsGate } from '@/components/cms/CmsGate';
import { Portfolio } from '@/components/portfolio/Portfolio';
import { getPublicContent } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const content = await getPublicContent();
  return <CmsGate initialContent={content}><Portfolio /></CmsGate>;
}
