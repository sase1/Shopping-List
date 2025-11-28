// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyBxU8fj0d8g-HycIT3zeHpGkm3HyxSq398",
    authDomain: "zemi-9245d.firebaseapp.com",
    projectId: "zemi-9245d",
    storageBucket: "zemi-9245d.appspot.com",
    messagingSenderId: "505589652301",
    appId: "1:505589652301:web:9f9024b2f563a078a4b504",
    measurementId: "G-SN1DTJ07SL"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
// export const analytics = getAnalytics(app);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;