import { notFound } from 'next/navigation';
import { parseMediaType } from '@/lib/route-params';

export default async function MediaTypeLayout({
  children,
  params,
}: LayoutProps<'/[locale]/[mediaType]'>) {
  if (!parseMediaType((await params).mediaType)) notFound();
  return children;
}
