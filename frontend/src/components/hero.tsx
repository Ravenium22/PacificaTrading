'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

export function Hero() {
  return (
    <div className="relative min-h-screen bg-slate-950">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-950 to-blue-900/20" />

      <div className="relative container mx-auto px-4 py-20">
        {/* Hero section */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <h1 className="text-5xl md:text-7xl font-bold text-slate-100 mb-6">
            Copy Elite Traders on{' '}
            <span className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
              Pacifica
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-8">
            Automatically replicate the trades of successful traders on Pacifica.
            Scale positions, filter symbols, and grow your portfolio effortlessly.
          </p>
          <Link href="/copy-trading">
            <Button
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-6 text-lg rounded-xl"
            >
              Get Started
            </Button>
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-purple-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">
              Instant Execution
            </h3>
            <p className="text-slate-400">
              Copy trades in real-time with minimal latency. Never miss an opportunity.
            </p>
          </Card>

          <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">
              Position Scaling
            </h3>
            <p className="text-slate-400">
              Customize position sizes with multipliers from 0.1x to 1x to match your risk tolerance.
            </p>
          </Card>

          <Card className="bg-slate-900/50 backdrop-blur border-slate-800 p-6 rounded-xl">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/10 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">
              Symbol Filtering
            </h3>
            <p className="text-slate-400">
              Choose which trading pairs to copy. Focus on your preferred markets and assets.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
