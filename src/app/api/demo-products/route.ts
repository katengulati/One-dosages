import { demoProducts } from '@/lib/demo-products';

export function GET() {
  return Response.json(demoProducts);
}
