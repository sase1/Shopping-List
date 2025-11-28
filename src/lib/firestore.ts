import { db } from './firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';

export interface Item {
    id: string;
    name: string;
    checked: boolean;
    addedByUid: string;
    category?: string;
    createdAt?: Timestamp;
}

export const listenItemsForList = (listId: string, cb: (items: Item[]) => void) => {
    const q = query(
        collection(db, 'groups', listId, 'items'),
        orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
        const items: Item[] = snapshot.docs.map((doc) => {
            const data = doc.data() as Omit<Item, 'id'>;
            return { id: doc.id, ...data };
        });
        cb(items);
    });

    return unsub;
};

export const addItem = async (listId: string, name: string, addedByUid: string) => {
    await addDoc(collection(db, 'groups', listId, 'items'), {
        name,
        checked: false,
        addedByUid,
        createdAt: serverTimestamp(),
    });
};

export const toggleItemChecked = async (itemId: string, checked: boolean, listId: string) => {
    const itemRef = doc(db, 'groups', listId, 'items', itemId);
    await updateDoc(itemRef, { checked });
};
