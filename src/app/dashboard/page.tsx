'use client';

import {useEffect, useState, useCallback, useMemo} from 'react';
import {db} from '@/lib/firebase';
import {observeUser, logout} from '@/lib/auth';
import type {User as FirebaseUser} from 'firebase/auth';
import {
    doc,
    getDoc,
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    serverTimestamp,
    query,
    orderBy,
    writeBatch,
    Timestamp,
} from 'firebase/firestore';
import {useRouter} from 'next/navigation';
import QuickProductsPanel from "@/components/QuickProductsPanel";

interface Item {
    id: string;
    name: string;
    checked: boolean;
    addedByUid: string;
    category?: string;
    createdAt?: Timestamp;
}

interface Category {
    id: string;
    name: string;
    createdAt?: Timestamp;
}

interface Member {
    uid: string;
    email?: string;
    name?: string | null;
    avatarColor?: string;
}

interface Group {
    id: string;
    name: string;
    members: string[];
    createdBy: string;
}

export default function DashboardPage() {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [group, setGroup] = useState<Group | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    const [newItemName, setNewItemName] = useState('');
    const [newItemCategory, setNewItemCategory] = useState<string>('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [filterCategory, setFilterCategory] = useState<string | 'All'>('All');
    const [search, setSearch] = useState('');
    const [categoryError, setCategoryError] = useState('');
    const [errorMessage, setErrorMessage] = useState("");
    const [duplicateName, setDuplicateName] = useState("");
    const [copied, setCopied] = useState(false);

    const router = useRouter();

    useEffect(() => {
        const unsub = observeUser(u => setUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) return;

        let unsubGroup: (() => void) | null = null;
        let unsubItems: (() => void) | null = null;
        let unsubCategories: (() => void) | null = null;

        const load = async () => {
            setLoading(true);
            try {
                const userSnap = await getDoc(doc(db, 'users', user.uid));
                if (!userSnap.exists()) throw new Error('User doc not found');

                const userData = userSnap.data();
                const groupId = userData.groupId;
                if (!groupId) throw new Error('No groupId found for user');

                const groupRef = doc(db, 'groups', groupId);

                unsubGroup = onSnapshot(groupRef, async gSnap => {
                    if (!gSnap.exists()) {
                        setGroup(null);
                        setMembers([]);
                        setItems([]);
                        setCategories([]);
                        setLoading(false);
                        return;
                    }
                    const gdata = gSnap.data();
                    setGroup({
                        id: groupId,
                        name: gdata.name,
                        members: gdata.members || [],
                        createdBy: gdata.createdBy,
                    });

                    // load members
                    const memberDocs = await Promise.all(
                        gdata.members.map((uid: string) => getDoc(doc(db, 'users', uid)))
                    );
                    setMembers(
                        memberDocs.map((md, i) => {
                            const data = md.exists() ? md.data() : {};
                            return {
                                uid: gdata.members[i],
                                email: data?.email,
                                name: data?.name ?? null,
                                avatarColor: data?.avatarColor ?? deterministicColorFromString(gdata.members[i]),
                            };
                        })
                    );
                    setLoading(false);
                });

                unsubItems = onSnapshot(
                    query(collection(db, 'groups', groupId, 'items'), orderBy('createdAt', 'asc')),
                    snapshot => setItems(snapshot.docs.map(d => ({...(d.data() as Item), id: d.id})))
                );

                unsubCategories = onSnapshot(
                    query(collection(db, 'groups', groupId, 'categories'), orderBy('createdAt', 'asc')),
                    snapshot => {
                        const loaded = snapshot.docs.map(d => ({...(d.data() as Category), id: d.id}));
                        setCategories(loaded);

                        // ❗ If no categories exist → reset selection
                        if (loaded.length === 0) {
                            setNewItemCategory('');
                        }

                        // ❗ Do NOT auto-select anything when categories load
                        // (remove your old auto-select code completely)
                    }
                );


            } catch (err) {
                console.error('Error loading dashboard data', err);
            }
        };

        load();

        return () => {
            unsubGroup?.();
            unsubItems?.();
            unsubCategories?.();
        };
    }, [user]);

    const initialsOf = (nameOrEmail?: string | null) => {
        if (!nameOrEmail) return '?';
        const parts = nameOrEmail.split(/[\s@.]+/).filter(Boolean);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    };

    const deterministicColorFromString = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        const h = Math.abs(hash) % 360;
        return `hsl(${h}deg 60% 70%)`;
    };

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

        const duplicate = categories.some(c => c.name.toLowerCase() === name.toLowerCase());
        if (duplicate) {
            setCategoryError('Category already exists');
            return;
        }

        try {
            await addDoc(collection(db, 'groups', group.id, 'categories'), {
                name,
                createdAt: serverTimestamp(),
            });

            setNewCategoryName('');
            setNewItemCategory(''); // 🔥 prevents auto-select
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
                batch.update(ref, {category: 'Other'});
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
    const handleAddItem = async (name: string) => {
        if (!group) return;

        name = name.trim();
        if (!name) return;

        // Clear previous error
        setErrorMessage("");
        setDuplicateName("");

        // Prevent duplicates
        const existingItem = items.find(
            item => item.name.trim().toLowerCase() === name.toLowerCase()
        );

        if (existingItem) {
            setDuplicateName(existingItem.name);       // highlight this item in list
            setErrorMessage("This item is already in the list.");
            return;
        }

        try {
            await addDoc(collection(db, 'groups', group.id, 'items'), {
                name,
                checked: false,
                addedByUid: user!.uid,
                category: newItemCategory ?? 'Other',
                createdAt: serverTimestamp(),
            });

            // Reset everything after success
            setNewItemName('');
            setDuplicateName("");
        } catch (err) {
            console.error('Failed to add item', err);
        }
    };


    const handleToggleAll = async () => {
        if (!group || items.length === 0) return;

        const allChecked = items.every(i => i.checked);
        const batch = writeBatch(db);

        items.forEach(item => {
            const ref = doc(db, 'groups', group.id, 'items', item.id);
            batch.update(ref, {checked: !allChecked});
        });

        try {
            await batch.commit();
        } catch (err) {
            console.error("Failed to toggle all items", err);
        }
    };


    const handleKeyDownAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddItem(newItemName); // pass the input value
            // setNewItemName(''); // clear input if needed
        }
    };

    // toggle checked
    const handleToggle = async (item: Item) => {
        if (!group) return;
        try {
            const ref = doc(db, 'groups', group.id, 'items', item.id);
            await updateDoc(ref, {checked: !item.checked});
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

    const handleCopyId = () => {
        if (!group) return;
        navigator.clipboard.writeText(group.id);
        setCopied(true);

        // hide message after 2 seconds
        setTimeout(() => setCopied(false), 2000);
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
                        <div className="mt-2 text-sm text-black">Group ID: <span className="font-mono">{group.id}</span>
                        </div>
                        {copied && (
                            <div className="text-green-600 text-sm mt-2 font-medium">
                                ✓ Copied to clipboard
                            </div>
                        )}
                        <div className="mt-3">
                            <button onClick={handleCopyId}
                                    className="text-sm bg-sky-600 hover:bg-sky-700 text-white px-2 py-1 rounded cursor-pointer">Copy
                                ID
                            </button>
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
                                    onChange={e => {
                                        setNewCategoryName(e.target.value);
                                        setCategoryError(''); // clear when typing
                                    }}
                                    placeholder="New category"
                                    className="flex-1 border px-2 py-1 rounded text-black"
                                />
                                <button
                                    onClick={handleAddCategory}
                                    className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded cursor-pointer"
                                >
                                    Add
                                </button>
                            </div>

                            {categoryError && (
                                <p className="text-red-600 text-sm mt-1">{categoryError}</p>
                            )}


                            <div className="mt-2 flex flex-col gap-2 max-h-44 overflow-auto pr-1">
                                {categories.length > 0 &&
                                    <button
                                        onClick={() => setFilterCategory('All')}
                                        className={`text-left px-2 py-1 rounded cursor-pointer ${filterCategory === 'All' ? 'bg-gray-700' : 'hover:bg-gray-50 text-black'}`}
                                    >
                                        All
                                    </button>
                                }
                                {categories.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between">
                                        <button
                                            onClick={() => setFilterCategory(cat.name)}
                                            className={`text-left px-2 py-1 rounded flex-1 cursor-pointer ${filterCategory === cat.name ? 'bg-gray-700' : 'hover:bg-gray-50 text-black'}`}
                                        >
                                            {cat.name}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCategory(cat.id)}
                                            title="Delete category"
                                            className="text-xs text-red-600 px-2 cursor-pointer"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>


                </aside>

                {/* MAIN: items (span 3 cols on large) */}
                <main className="lg:col-span-2 space-y-6">
                    {/* header */}
                    <div className="bg-white p-6 rounded-xl shadow flex items-start justify-between">
                        <div className="flex flex-col gap-2 flex-1">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">{group ? `${group.name} shopping list` : 'My Group'}</h1>
                                <p className="text-xs text-black">
                                    Share the Group ID to invite others to your list!
                                </p>
                            </div>


                        </div>

                        <div className="flex items-center gap-3 ml-4">
                            <button
                                onClick={handleLogout}
                                className="bg-red-600 hover:bg-red-700 cursor-pointer text-white px-4 py-2 rounded"
                            >
                                Logout
                            </button>
                        </div>
                    </div>


                    {/* add item */}
                    <div className="bg-white p-4 rounded-xl shadow">
                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="border px-3 py-2 rounded-md text-black"
                            />
                        </div>
                        <div className="flex gap-3">
                            <div className="flex flex-col flex-1">
                                <input
                                    type="text"
                                    placeholder="Add new item and press Enter"
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    onKeyDown={handleKeyDownAdd}
                                    className="flex-1 border px-4 py-2 rounded text-black"
                                />
                                {errorMessage && (
                                    <div style={{color: 'red', fontSize: '0.85rem', marginTop: '4px'}}>
                                        {errorMessage}
                                    </div>
                                )}
                            </div>
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
                                <option value="Uncategorized">Uncategorized</option>
                            </select>
                            <button
                                onClick={() => handleAddItem(newItemName)}
                                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded cursor-pointer"
                            >
                                Add
                            </button>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-3">
                                <label className="text-sm text-gray-600">Filter:</label>
                                <select
                                    value={filterCategory}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                        setFilterCategory(e.target.value)
                                    }
                                    className="border px-2 py-1 rounded text-black"
                                >
                                    <option value="All">All</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                    <option value="Other">Other</option>
                                </select>
                                <button onClick={() => {
                                    setFilterCategory('All');
                                    setSearch('');
                                }} className="text-sm text-red-600 hover:text-red-900  ml-2 cursor-pointer">Reset
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={handleClearCompleted}
                                        className="text-sm bg-purple-700 hover:bg-purple-800 px-3 py-1 rounded cursor-pointer">Clear
                                    completed
                                </button>
                                <span
                                    className="text-sm text-gray-500">{items.filter(i => i.checked).length} completed</span>
                            </div>
                        </div>
                    </div>

                    {/* items list */}
                    <div className="space-y-3">
                        {filteredItems.length !== 0 ?
                            <button
                                onClick={handleToggleAll}
                                className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded mb-4 cursor-pointer"
                            >
                                {items.every(i => i.checked) ? "Deselect All" : "Select All"}
                            </button> : null
                        }
                        {filteredItems.length === 0 ? (
                            <div className="bg-white p-6 rounded-xl shadow text-center text-gray-500">No items
                                yet.</div>
                        ) : (
                            filteredItems.map(item => (
                                <div key={item.id}
                                     className={`flex items-center justify-between bg-white p-4 rounded-xl shadow-sm 
                                        hover:shadow-md transition
                                        ${duplicateName.toLowerCase() === item.name.toLowerCase() ? "bg-red-100 border border-red-300" : ""}
                                      `}>
                                    <div className="flex items-center gap-4">
                                        <input type="checkbox" checked={item.checked}
                                               onChange={() => handleToggle(item)} className="w-5 h-5 cursor-pointer"/>
                                        <div>
                                            <div
                                                className={item.checked ? 'line-through text-gray-400 font-medium' : 'text-gray-800 font-medium'}>
                                                {item.name}
                                            </div>
                                            <div
                                                className="text-xs text-gray-500 mt-1">{item.category ?? 'Uncategorized'} •
                                                added by {getDisplayName(item.addedByUid)}</div>
                                        </div>
                                    </div>
                                    <div
                                        className="text-xs text-gray-400 font-mono">{item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : ''}</div>
                                </div>
                            ))
                        )}
                    </div>
                </main>
                <aside className="lg:col-span-1 space-y-6">

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
                                        className="w-16 h-12 rounded-full flex items-center justify-center text-sm font-semibold text-gray-900"
                                        style={{background: m.avatarColor ?? deterministicColorFromString(m.uid)}}
                                    >
                                        {initialsOf(m.name ?? m.email ?? m.uid)}
                                    </div>
                                    <div className="flex items-center w-full">
                                        <span className="text-sm font-medium text-black">{m.name || m.email || m.uid}</span>
                                        {m.uid === user.uid && (
                                        <span className="ml-auto text-xs text-sky-600 font-semibold text-right">
                                            (You)
                                        </span>
                                        )}
                                        {/*<span className="text-xs text-black font-mono">UID: {m.uid}</span>*/}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>


                    <QuickProductsPanel
                        onAddItem={handleAddItem}
                        groupId={group.id}
                    />

                </aside>
            </div>
        </div>
    );
}
