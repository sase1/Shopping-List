'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { observeUser, logout } from '@/lib/auth';
import {
    doc,
    getDoc,
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    writeBatch,
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';

interface Item {
    id: string;
    name: string;
    checked: boolean;
    addedByUid: string;
    category?: string;
    createdAt?: any;
}

interface Category {
    id: string;
    name: string;
    createdAt?: any;
}

interface Member {
    uid: string;
    email?: string;
    name?: string | null;
    avatarColor?: string;
}

export default function DashboardPage() {
    const [user, setUser] = useState<any>(null);
    const [group, setGroup] = useState<any>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    const [newItemName, setNewItemName] = useState('');
    const [newItemCategory, setNewItemCategory] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [filterCategory, setFilterCategory] = useState<string | 'All'>('All');
    const [search, setSearch] = useState('');

    const router = useRouter();

    // observe auth user
    useEffect(() => {
        const unsub = observeUser(u => setUser(u));
        return () => unsub();
    }, []);

    // load group, items, categories, members
    useEffect(() => {
        if (!user) return;

        let unsubGroup: (() => void) | null = null;
        let unsubItems: (() => void) | null = null;
        let unsubCategories: (() => void) | null = null;

        const load = async () => {
            setLoading(true);
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userDocRef);
                if (!userSnap.exists()) throw new Error('User doc not found');

                const userData = userSnap.data();
                const groupId = userData.groupId;
                if (!groupId) throw new Error('No groupId found for user');

                const groupRef = doc(db, 'groups', groupId);

                // listen to group doc (so we react to member changes / group name)
                unsubGroup = onSnapshot(groupRef, async (gSnap) => {
                    if (!gSnap.exists()) {
                        setGroup(null);
                        setMembers([]);
                        setItems([]);
                        setCategories([]);
                        setLoading(false);
                        return;
                    }
                    const gdata = gSnap.data();
                    setGroup({ id: groupId, ...gdata });

                    // load members list from group.members array
                    const memberUids: string[] = gdata.members || [];
                    // fetch each user doc
                    const memberDocs = await Promise.all(memberUids.map((uid: string) => getDoc(doc(db, 'users', uid))));
                    const memberList: Member[] = memberDocs.map((md, idx) => {
                        const data = md.exists() ? (md.data() as any) : {};
                        return {
                            uid: memberUids[idx],
                            email: data?.email,
                            name: data?.name ?? null,
                            avatarColor: data?.avatarColor ?? deterministicColorFromString(memberUids[idx]),
                        };
                    });
                    setMembers(memberList);
                });

                // items listener
                const itemsCol = collection(db, 'groups', groupId, 'items');
                unsubItems = onSnapshot(query(itemsCol, orderBy('createdAt', 'asc')), snapshot => {
                    const loaded: Item[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                    setItems(loaded);
                });

                // categories listener (dynamic)
                const categoriesCol = collection(db, 'groups', groupId, 'categories');
                unsubCategories = onSnapshot(query(categoriesCol, orderBy('createdAt', 'asc')), snapshot => {
                    const loaded: Category[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                    setCategories(loaded);
                    // if no selected newItemCategory, pick first category or null
                    if (!newItemCategory && loaded.length) {
                        setNewItemCategory(loaded[0].name);
                    } else if (!loaded.length) {
                        setNewItemCategory(null);
                    }
                });
            } catch (err) {
                console.error('Error loading dashboard data', err);
            } finally {
                setLoading(false);
            }
        };

        load();

        return () => {
            if (unsubGroup) unsubGroup();
            if (unsubItems) unsubItems();
            if (unsubCategories) unsubCategories();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // helpers
    const initialsOf = (nameOrEmail?: string | null) => {
        if (!nameOrEmail) return '?';
        const parts = nameOrEmail.split(/[\s@.]+/).filter(Boolean);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    };

    function deterministicColorFromString(str: string) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash) % 360;
        return `hsl(${h}deg 60% 70%)`;
    }

    const getDisplayName = useCallback((uid?: string) => {
        if (!uid) return 'Unknown';
        const m = members.find(mm => mm.uid === uid);
        if (!m) return uid;
        return m.name || m.email || uid;
    }, [members]);

    // add category
    const handleAddCategory = async () => {
        if (!group) return;
        const name = newCategoryName.trim();
        if (!name) return;
        try {
            await addDoc(collection(db, 'groups', group.id, 'categories'), {
                name,
                createdAt: serverTimestamp(),
            });
            setNewCategoryName('');
        } catch (err) {
            console.error('Failed to add category', err);
        }
    };

    // delete category
    const handleDeleteCategory = async (categoryId: string) => {
        if (!group) return;
        try {
            // optional: before deleting, remove category references from items (or set to null)
            // we'll set items with that category to 'Other' to keep things simple
            const toUpdate = items.filter(i => i.category === categories.find(c => c.id === categoryId)?.name);
            const batch = writeBatch(db);
            toUpdate.forEach(i => {
                const ref = doc(db, 'groups', group.id, 'items', i.id);
                batch.update(ref, { category: 'Other' });
            });
            // delete category doc
            const catRef = doc(db, 'groups', group.id, 'categories', categoryId);
            batch.delete(catRef);
            await batch.commit();
        } catch (err) {
            console.error('Failed to delete category', err);
        }
    };

    // add item
    const handleAddItem = async () => {
        if (!group) return;
        const name = newItemName.trim();
        if (!name) return;
        try {
            await addDoc(collection(db, 'groups', group.id, 'items'), {
                name,
                checked: false,
                addedByUid: user.uid,
                category: newItemCategory ?? 'Other',
                createdAt: serverTimestamp(),
            });
            setNewItemName('');
        } catch (err) {
            console.error('Failed to add item', err);
        }
    };

    const handleKeyDownAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddItem();
        }
    };

    // toggle checked
    const handleToggle = async (item: Item) => {
        if (!group) return;
        try {
            const ref = doc(db, 'groups', group.id, 'items', item.id);
            await updateDoc(ref, { checked: !item.checked });
        } catch (err) {
            console.error('Failed to toggle', err);
        }
    };

    // clear completed
    const handleClearCompleted = async () => {
        if (!group) return;
        const completed = items.filter(i => i.checked);
        if (!completed.length) return;
        try {
            const batch = writeBatch(db);
            completed.forEach(i => {
                const ref = doc(db, 'groups', group.id, 'items', i.id);
                batch.delete(ref);
            });
            await batch.commit();
        } catch (err) {
            console.error('Failed to clear completed', err);
        }
    };

    // logout
    const handleLogout = async () => {
        await logout();
        setUser(null);
        setGroup(null);
        setItems([]);
        setCategories([]);
        setMembers([]);
        router.push('/');
    };

    // derived filtered items
    const filteredItems = useMemo(() => {
        return items.filter(i => {
            if (filterCategory !== 'All' && i.category !== filterCategory) return false;
            if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [items, filterCategory, search]);

    if (!user) return <p className="text-center mt-20 text-lg">Loading user…</p>;
    if (loading) return <p className="text-center mt-20 text-lg">Loading group…</p>;
    if (!group) return <p className="text-center mt-20 text-lg">No group found.</p>;

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* LEFT SIDEBAR: categories + members */}
                <aside className="lg:col-span-1 space-y-6">
                    {/* Group card */}
                    <div className="bg-white p-4 rounded-xl shadow">
                        <h2 className="text-lg font-semibold text-black">{group.name}</h2>
                        <div className="mt-2 text-sm text-black">Group ID: <span className="font-mono">{group.id}</span></div>
                        <div className="mt-3">
                            <button onClick={() => navigator.clipboard.writeText(group.id)} className="text-sm bg-sky-600 text-white px-2 py-1 rounded">Copy ID</button>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="bg-white p-4 rounded-xl shadow">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-black">Categories</h3>
                            <span className="text-xs text-black">{categories.length}</span>
                        </div>

                        <div className="mt-3 flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="New category"
                                    className="flex-1 border px-2 py-1 rounded text-black"
                                />
                                <button onClick={handleAddCategory} className="bg-sky-600 text-white px-3 py-1 rounded">Add</button>
                            </div>

                            <div className="mt-2 flex flex-col gap-2 max-h-44 overflow-auto pr-1">
                                {categories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between">
                                        <button
                                            onClick={() => setFilterCategory(cat.name)}
                                            className={`text-left px-2 py-1 rounded flex-1 ${filterCategory === cat.name ? 'bg-gray-600' : 'hover:bg-gray-50 text-black'}`}
                                        >
                                            {cat.name}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCategory(cat.id)}
                                            title="Delete category"
                                            className="text-xs text-red-600 px-2"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Members */}
                    <div className="bg-white p-4 rounded-xl shadow">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-black">Members</h3>
                            <span className="text-xs text-black">{members.length}</span>
                        </div>

                        <div className="mt-3 flex flex-col gap-3 max-h-64 overflow-auto pr-1">
                            {members.map(m => (
                                <div key={m.uid} className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-gray-900"
                                        style={{ background: m.avatarColor ?? deterministicColorFromString(m.uid) }}
                                    >
                                        {initialsOf(m.name ?? m.email ?? m.uid)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-black">{m.name || m.email || m.uid}</span>
                                        <span className="text-xs text-black font-mono">UID: {m.uid}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* MAIN: items (span 3 cols on large) */}
                <main className="lg:col-span-3 space-y-6">
                    {/* header */}
                    <div className="bg-white p-6 rounded-xl shadow flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">{group.name || 'My Group'}</h1>
                            <p className="text-xs text-black">Share the Group ID to invite others to your list!</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="border px-3 py-2 rounded-md text-black"
                            />
                            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded">Logout</button>
                        </div>
                    </div>

                    {/* add item */}
                    <div className="bg-white p-4 rounded-xl shadow">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="Add new item and press Enter"
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                onKeyDown={handleKeyDownAdd}
                                className="flex-1 border px-4 py-2 rounded text-black"
                            />
                            <select
                                value={newItemCategory ?? ''}
                                onChange={e => setNewItemCategory(e.target.value)}
                                className="border px-3 py-2 rounded text-black"
                            >
                                <option value="" disabled>
                                    {categories.length ? 'Select category' : 'No categories'}
                                </option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.name}>
                                        {c.name}
                                    </option>
                                ))}
                                <option value="Other">Other</option>
                            </select>
                            <button onClick={handleAddItem} className="bg-sky-600 text-white px-4 py-2 rounded">Add
                            </button>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-3">
                                <label className="text-sm text-gray-600">Filter:</label>
                                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)} className="border px-2 py-1 rounded text-black">
                                    <option value="All">All</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    <option value="Other">Other</option>
                                </select>
                                <button onClick={() => { setFilterCategory('All'); setSearch(''); }} className="text-sm text-black ml-2">Reset</button>
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={handleClearCompleted} className="text-sm bg-purple-800 px-3 py-1 rounded">Clear completed</button>
                                <span className="text-sm text-gray-500">{items.filter(i => i.checked).length} completed</span>
                            </div>
                        </div>
                    </div>

                    {/* items list */}
                    <div className="space-y-3">
                        {filteredItems.length === 0 ? (
                            <div className="bg-white p-6 rounded-xl shadow text-center text-gray-500">No items yet.</div>
                        ) : (
                            filteredItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition">
                                    <div className="flex items-center gap-4">
                                        <input type="checkbox" checked={item.checked} onChange={() => handleToggle(item)} className="w-5 h-5" />
                                        <div>
                                            <div className={item.checked ? 'line-through text-gray-400 font-medium' : 'text-gray-800 font-medium'}>
                                                {item.name}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">{item.category ?? 'Uncategorized'} • added by {getDisplayName(item.addedByUid)}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400 font-mono">{item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : ''}</div>
                                </div>
                            ))
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
