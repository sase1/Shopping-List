
'use client';

import { useState } from 'react';
import { register } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { AuthError } from 'firebase/auth';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [groupCode, setGroupCode] = useState('');
    const [groupName, setGroupName] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res = await register(email, password);
            const user = res.user;

            let groupIdToUse = groupCode.trim();

            if (groupIdToUse) {
                const groupDocRef = doc(db, 'groups', groupIdToUse);
                const groupDoc = await getDoc(groupDocRef);

                if (!groupDoc.exists()) {
                    setErrorMessage('Group code not found. Please check and try again.');
                    setSuccessMessage('');
                    return;
                }

                const members = groupDoc.data()?.members || [];
                if (!members.includes(user.uid)) {
                    await updateDoc(groupDocRef, { members: [...members, user.uid] });
                }
            } else {
                if (!groupName.trim()) {
                    setErrorMessage('Please enter a group name for your new group.');
                    setSuccessMessage('');
                    return;
                }

                groupIdToUse = uuidv4();
                await setDoc(doc(db, 'groups', groupIdToUse), {
                    name: groupName.trim(),
                    createdBy: user.uid,
                    members: [user.uid],
                });
            }

            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                name: name.trim() || null,
                groupId: groupIdToUse,
            });

            setSuccessMessage(`Account "${user.email}" successfully created!`);
            setErrorMessage('');

            setTimeout(() => {
                router.push('/dashboard');
            }, 1500);

        } catch (err) {
            const authErr = err as AuthError;
            const msg =
                authErr.code === 'auth/email-already-in-use'
                    ? 'This email is already in use.'
                    : authErr.code === 'auth/invalid-email'
                        ? 'Invalid email format.'
                        : authErr.code === 'auth/weak-password'
                            ? 'Password is too weak.'
                            : authErr.message || 'Something went wrong.';
            setErrorMessage(msg);
            setSuccessMessage('');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
                <h3 className="text-2xl font-bold mb-6 text-gray-800 text-center">Create Your Account</h3>

                <form onSubmit={handleRegister} className="space-y-4">

                    <div>
                        <label className="block text-gray-700 mb-1" htmlFor="email">Email</label>
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
                        <label className="block text-gray-700 mb-1" htmlFor="name">Your Name</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-black"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 mb-1" htmlFor="password">Password</label>
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

                    <div>
                        <label className="block text-gray-700 mb-1" htmlFor="groupCode">
                            Group Code (leave blank to create a new group)
                        </label>
                        <input
                            id="groupCode"
                            type="text"
                            value={groupCode}
                            onChange={e => setGroupCode(e.target.value)}
                            placeholder="Enter group code to join an existing group"
                            className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-black"
                        />
                    </div>

                    {!groupCode && (
                        <div>
                            <label className="block text-gray-700 mb-1" htmlFor="groupName">
                                Group Name
                            </label>
                            <input
                                id="groupName"
                                type="text"
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                                placeholder="Enter a friendly name for your group"
                                className="w-full border border-gray-300 px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-black"
                                required={!groupCode}
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-sky-600 text-white py-2 rounded-lg hover:bg-sky-700 transition font-medium"
                    >
                        Create Account
                    </button>

                    {successMessage && (
                        <p className="mt-2 text-green-600 font-medium text-center">{successMessage}</p>
                    )}

                    {errorMessage && (
                        <p className="mt-2 text-red-600 font-medium text-center">{errorMessage}</p>
                    )}

                </form>

                <p className="mt-4 text-sm text-gray-500 text-center">
                    Already have an account?{' '}
                    <a href="/auth/login" className="text-sky-600 hover:underline">
                        Log in
                    </a>
                </p>
            </div>
        </div>
    );
}
