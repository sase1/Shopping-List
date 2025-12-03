'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    getDocs
} from 'firebase/firestore';

interface QuickProductsPanelProps {
    onAddItem: (name: string) => void;
    groupId: string;
}

export default function QuickProductsPanel({ onAddItem, groupId }: QuickProductsPanelProps) {
    const [input, setInput] = useState('');
    const [badges, setBadges] = useState<string[]>([]);
    const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
    const [badgeError, setBadgeError] = useState('');

    // Load real-time badges
    useEffect(() => {
        if (!groupId) return;

        const q = query(collection(db, 'groups', groupId, 'quickBadges'), orderBy('name'));
        const unsub = onSnapshot(q, snapshot => {
            const loaded = snapshot.docs.map(d => d.data().name as string);
            setBadges(loaded);
        });

        return () => unsub();
    }, [groupId]);

    // Add badge(s)
    const handleAddBadge = async () => {
        setBadgeError(''); // clear previous error

        const names = input
            .split(',')
            .map(i => i.trim())
            .filter(Boolean);

        if (names.length === 0) return;

        // Detect duplicates
        const duplicates = names.filter(n =>
            badges.some(b => b.toLowerCase() === n.toLowerCase())
        );

        if (duplicates.length > 0) {
            setBadgeError(`Already exists: ${duplicates.join(', ')}`);
            return;
        }

        try {
            for (const name of names) {
                await addDoc(collection(db, 'groups', groupId, 'quickBadges'), { name });
            }
            setInput('');
        } catch (err) {
            console.error('Failed to add badge', err);
        }
    };

    // Click to add product
    const handleBadgeClick = (name: string) => {
        if (!addedItems.has(name)) {
            onAddItem(name);
            setAddedItems(prev => new Set(prev).add(name));
        }
    };

    // Delete a badge
    const handleBadgeDelete = async (name: string) => {
        if (!groupId) return;

        try {
            const badgeDocs = await getDocs(collection(db, 'groups', groupId, 'quickBadges'));
            const docToDelete = badgeDocs.docs.find(d => d.data().name === name);

            if (docToDelete) {
                await deleteDoc(doc(db, 'groups', groupId, 'quickBadges', docToDelete.id));
            }
        } catch (err) {
            console.error('Failed to delete badge', err);
        }
    };

    // Delete all badges
    const handleClearAll = async () => {
        if (!groupId) return;

        try {
            const badgeDocs = await getDocs(collection(db, 'groups', groupId, 'quickBadges'));
            for (const docSnap of badgeDocs.docs) {
                await deleteDoc(doc(db, 'groups', groupId, 'quickBadges', docSnap.id));
            }
            setAddedItems(new Set());
        } catch (err) {
            console.error('Failed to clear badges', err);
        }
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow space-y-2">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-black">Quick Add Products Items</h3>
                <span className="text-xs text-black">{badges.length}</span>
                {badges.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        className="text-sm text-red-600 hover:text-red-800 font-semibold"
                    >
                        Clear All
                    </button>
                )}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Type product name..."
                    value={input}
                    onChange={e => {
                        setInput(e.target.value);
                        setBadgeError('');
                    }}
                    className="flex-1 border px-3 py-2 rounded text-black"
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddBadge();
                        }
                    }}
                />
                <button
                    onClick={handleAddBadge}
                    className="bg-sky-600 text-white px-3 py-2 rounded hover:bg-sky-700 cursor-pointer"
                >
                    Add
                </button>
            </div>

            {badgeError && (
                <p className="text-red-600 text-sm mt-1">{badgeError}</p>
            )}


            {badges.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {badges.map(name => (
                        <div
                            key={name}
                            className={`flex items-center gap-1 px-3 py-1 rounded ${
                                addedItems.has(name)
                                    ? 'bg-red-500 text-white'
                                    : 'bg-sky-600 text-white hover:bg-sky-700'
                            }`}
                        >
                            <button onClick={() => handleBadgeClick(name)} className="focus:outline-none cursor-pointer">
                                {name}
                            </button>
                            <button
                                onClick={() => handleBadgeDelete(name)}
                                className="ml-1 text-white font-bold hover:text-gray-200 focus:outline-none cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
