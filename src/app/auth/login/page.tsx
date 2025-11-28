'use client';

import { useState } from 'react';
import { login } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        try {
            await login(email, password);
            router.push('/dashboard');
        } catch (err: any) {

            // Firebase has specific error codes — let's make nicer messages
            const msg =
                err.code === 'auth/user-not-found'
                    ? 'No account found with that email.'
                    : err.code === 'auth/wrong-password'
                        ? 'Incorrect password. Please try again.'
                        : err.code === 'auth/invalid-email'
                            ? 'Invalid email format.'
                            : err.message || 'Something went wrong.';

            setErrorMessage(msg);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
                <h3 className="text-2xl font-bold mb-6 text-gray-800 text-center">Log In</h3>

                <form onSubmit={handleLogin} className="space-y-4">

                    <div>
                        <label className="block text-gray-700 mb-1" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-black"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 mb-1" htmlFor="password">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-black"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-sky-600 text-white py-2 rounded-lg hover:bg-sky-700 transition font-medium"
                    >
                        Log In
                    </button>

                    {/* ERROR MESSAGE */}
                    {errorMessage && (
                        <p className="mt-2 text-red-600 font-medium text-center">
                            {errorMessage}
                        </p>
                    )}
                </form>

                <p className="mt-4 text-sm text-gray-500 text-center">
                    Don’t have an account?{' '}
                    <Link href="/auth/register" className="text-green-600 hover:underline">
                        Register
                    </Link>
                </p>
            </div>
        </div>
    );
}
