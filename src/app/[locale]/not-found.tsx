import Link from "next/link";

// Rendered inside the locale layout; the text is bilingual because
// not-found pages don't receive route params.
export default function NotFound() {
  return (
    <section className="hero">
      <h1>404</h1>
      <p>
        Page not found · Página no encontrada
      </p>
      <Link className="btn" href="/">
        Home · Inicio
      </Link>
    </section>
  );
}
