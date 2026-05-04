import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-6xl font-bold text-brand-500">404</div>
        <p className="mt-2 text-slate-500">Page not found</p>
        <Link to="/" className="mt-4 inline-block text-brand-600 hover:underline">Back to dashboard</Link>
      </div>
    </div>
  );
}
