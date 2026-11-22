import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const fields = {
  newsletter: ['pd_newsletter_email'],
  contact: ['pd_name', 'pd_email', 'pd_message']
} as const;

export async function POST(request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params;
  if (kind !== 'newsletter' && kind !== 'contact') {
    return new Response('Page not found', { status: 404 });
  }
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && origin !== `http://${host}`) {
    return new Response('Only the localhost form can submit here.', { status: 403 });
  }
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
    return new Response('Unsupported form format.', { status: 415 });
  }
  const length = Number(request.headers.get('content-length'));
  if (!Number.isInteger(length) || length < 1 || length > 8192) {
    return new Response('Please complete the form.', { status: 400 });
  }
  const params = new URLSearchParams(await request.text());
  const data = Object.fromEntries(fields[kind].map((field) => [field, (params.get(field) ?? '').trim()]));
  const email = data.pd_email ?? data.pd_newsletter_email;
  if (!Object.values(data).every(Boolean) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || params.get('pdas_website')) {
    return new Response('Enter a valid email address and complete the required fields.', { status: 400 });
  }
  const directory = join(process.cwd(), '.preview-data');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await appendFile(join(directory, 'form-submissions.jsonl'), JSON.stringify({
    kind, data, submittedAt: new Date().toISOString()
  }) + '\n', { mode: 0o600 });
  return new Response('Saved in the local preview. No email was sent.', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
