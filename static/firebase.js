import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBaU8XMtVsSTfkioEH_Vg0Vs6OjTPb7p9U",
  authDomain: "explore-436a5.firebaseapp.com",
  projectId: "explore-436a5",
  storageBucket: "explore-436a5.firebasestorage.app",
  messagingSenderId: "733101974683",
  appId: "1:733101974683:web:55ef5278ff5f97639b123e",
  measurementId: "G-W1NNE6QYJ3"
};


const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);
export const db = getFirestore(app);