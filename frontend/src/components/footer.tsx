export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-6 text-center">
        <span className="text-sm text-slate-400">
          Built by{' '}
          <a
            href="https://x.com/0xravenium"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-200 hover:text-white underline decoration-slate-600 hover:decoration-slate-400 transition-colors"
          >
            Ravenium
          </a>
        </span>
      </div>
    </footer>
  );
}
