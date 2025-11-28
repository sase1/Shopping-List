'use client';

import { useEffect, useState } from 'react';
import { listenItemsForList, addItem, toggleItemChecked } from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AddItem from '@/components/AddItem';
import ItemList from '@/components/ItemList';

export default function ListPage({ params }: { params: { listId: string } }) {
    const { listId } = params;
    const [items, setItems] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
        const unsub = listenItemsForList(listId, (docs) => setItems(docs));
        return () => {
            unsub();
            unsubAuth();
        };
    }, [listId]);

    const handleAdd = async (name: string) => {
        if (!user) return alert('Not logged in');
        await addItem(listId, name, user.uid, listId); // groupId = listId in this simple version
    };

    const handleToggle = async (itemId: string, checked: boolean) => {
        await toggleItemChecked(itemId, checked, listId);
    };


    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Shopping List</h2>
            <AddItem onAdd={handleAdd} />
            <div className="mt-4">
                <ItemList items={items} onToggle={handleToggle} />
            </div>
        </div>
    );
}
