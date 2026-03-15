import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBf1xAVBtu4dglRsGGIcNa99tDlsJiUT08",
  authDomain: "vehiclegrid-app.firebaseapp.com",
  projectId: "vehiclegrid-app",
  storageBucket: "vehiclegrid-app.firebasestorage.app",
  messagingSenderId: "1053969645594",
  appId: "1:1053969645594:web:d80c36c434283728add1a3"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
