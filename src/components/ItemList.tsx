'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ItemList({
                                     items,
                                     onToggle,
                                 }: {
    items: any[];
    onToggle: (id: string, checked: boolean) => void;
}) {
    const [users, setUsers] = useState<Record<string, string>>({});

    // Preload user emails for addedByUid
    useEffect(() => {
        const fetchUsers = async () => {
            const u: Record<string, string> = {};
            for (const item of items) {
                if (!u[item.addedByUid]) {
                    const docSnap = await getDoc(doc(db, 'users', item.addedByUid));
                    u[item.addedByUid] = docSnap.exists() ? docSnap.data()?.email : 'Unknown';
                }
            }
            setUsers(u);
        };
        fetchUsers();
    }, [items]);

    return (
        <ul className="space-y-2">
            {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between p-2 bg-white rounded shadow">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => onToggle(item.id, e.target.checked)}
                        />
                        <span className={item.checked ? 'line-through text-gray-400' : ''}>{item.name}</span>
                        <span className="text-xs text-gray-500">({users[item.addedByUid]})</span>
                    </div>
                </li>
            ))}
        </ul>
    );
}
