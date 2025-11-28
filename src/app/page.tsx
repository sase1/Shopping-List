'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { observeUser } from '@/lib/auth';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsub = observeUser((user) => {
      if (user) {
        router.replace('/dashboard'); // logged in → dashboard
      }
    });
    return () => unsub();
  }, [router]);

  return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <h1 className="text-3xl font-bold">Shared Shopping List</h1>
        <p className="text-gray-500">Collaborate with your family or friends</p>

        <div className="flex gap-4 mt-4">
          <Link
              href="/auth/login"
              className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 transition"
          >
            Log in
          </Link>
          <Link
              href="/auth/register"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Register
          </Link>
        </div>
      </div>
  );
}
