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
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [alreadyAddedMessage, setAlreadyAddedMessage] = useState('');


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
            setAlreadyAddedMessage(''); // clear message if adding
        } else {
            setAlreadyAddedMessage(`"${name}" is already in the list`);
            // optionally clear it after a few seconds
            setTimeout(() => setAlreadyAddedMessage(''), 3000);
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
        // Show confirmation modal instead of using window.confirm
        setShowConfirmModal(true);
    };

// Then create another function that actually clears the badges when the user confirms
    const confirmClearAll = async () => {
        if (!groupId) return;
        setDeleting(true); // start deleting

        try {
            const badgeDocs = await getDocs(collection(db, 'groups', groupId, 'quickBadges'));
            for (const docSnap of badgeDocs.docs) {
                await deleteDoc(doc(db, 'groups', groupId, 'quickBadges', docSnap.id));
            }
            setAddedItems(new Set());
        } catch (err) {
            console.error('Failed to clear badges', err);
        } finally {
            setDeleting(false); // done deleting
            setShowConfirmModal(false);
        }
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow space-y-2">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-black">Quickly add products to the list</h3>
                <span className="text-xs text-black">{badges.length}</span>
            </div>
            {badges.length > 0 && (
                <button
                    onClick={handleClearAll}
                    className="text-sm text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                >
                    Clear All
                </button>
            )}

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
            {alreadyAddedMessage && (
                <p className="text-red-600 text-sm mt-1">{alreadyAddedMessage}</p>
            )}

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
                    {showConfirmModal && (
                        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                            <div className="bg-white rounded-xl shadow-lg p-6 w-96 flex flex-col items-center">
                                <h3 className="text-lg font-semibold text-black mb-4">Confirm Delete</h3>
                                <p className="text-sm text-gray-700 mb-6 text-center">
                                    {deleting ? 'Deleting quick items...' : 'Are you sure you want to clear all badges? This action cannot be undone.'}
                                </p>

                                {deleting ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="w-6 h-6 border-4 border-t-red-600 border-gray-200 rounded-full animate-spin"></div>
                                        <span className="text-sm text-black">Deleting...</span>
                                    </div>
                                ) : (
                                    <div className="flex justify-end gap-3 w-full">
                                        <button
                                            onClick={() => setShowConfirmModal(false)}
                                            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-black cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmClearAll}
                                            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                                        >
                                            Delete All
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                </div>
            )}
        </div>
    );
}
