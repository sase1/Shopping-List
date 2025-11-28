import ClientListPage from './ClientListPage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Page({ params }: any) {
    return <ClientListPage listId={params.listId} />;
}




// 'use client';
//
// import { useEffect, useState } from 'react';
// import { listenItemsForList, addItem, toggleItemChecked } from '@/lib/firestore';
// import { auth } from '@/lib/firebase';
// import type { User } from 'firebase/auth';
// import { onAuthStateChanged } from 'firebase/auth';
// import AddItem from '@/components/AddItem';
// import ItemList from '@/components/ItemList';
// import { Timestamp } from "firebase/firestore";
//
// // Define a proper type for Item
// export interface Item {
//     id: string;
//     name: string;
//     checked: boolean;
//     addedByUid: string;
//     createdAt?: Timestamp;
// }
//
// // Props type for client component
// interface ListPageProps {
//     params: {
//         listId: string;
//     };
// }
//
// export default function ListPage({ params }: ListPageProps) {
//     const { listId } = params;
//     const [items, setItems] = useState<Item[]>([]);
//     const [user, setUser] = useState<User | null>(null);
//
//     useEffect(() => {
//         const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
//         const unsub = listenItemsForList(listId, (docs) => setItems(docs as Item[]));
//         return () => {
//             unsub();
//             unsubAuth();
//         };
//     }, [listId]);
//
//     const handleAdd = async (name: string) => {
//         if (!user) return alert('Not logged in');
//         await addItem(listId, name, user.uid);
//     };
//
//     const handleToggle = async (itemId: string, checked: boolean) => {
//         await toggleItemChecked(itemId, checked, listId);
//     };
//
//     return (
//         <div>
//             <h2 className="text-xl font-semibold mb-4">Shopping List</h2>
//             <AddItem onAdd={handleAdd} />
//             <div className="mt-4">
//                 <ItemList items={items} onToggle={handleToggle} />
//             </div>
//         </div>
//     );
// }
