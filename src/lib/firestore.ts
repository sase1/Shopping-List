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
} from 'firebase/firestore';

export const listenItemsForList = (listId: string, cb: (items: any[]) => void) => {
    const q = query(
        collection(db, 'groups', listId, 'items'),
        orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        cb(items);
    });

    return unsub;
};

export const addItem = async (listId: string, name: string, addedByUid: string, groupId: string) => {
    await addDoc(collection(db, 'groups', groupId, 'items'), {
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



