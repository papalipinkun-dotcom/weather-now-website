import { Link } from 'wouter';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">Not found</div>
        <h1 className="auth-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={28} aria-hidden="true" /> 404 · Page not found
        </h1>
        <p className="page-description">No page exists at this address.</p>
        <Link href="/" className="button primary" style={{ marginTop: 16 }}>Return to overview</Link>
      </div>
    </div>
  );
}
