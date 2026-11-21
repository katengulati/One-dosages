// Pages are served by src/app/[locale]/[[...slug]]/route.ts as complete HTML
// documents. This layout only wraps Next.js' own pages (e.g. the 404 page).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
