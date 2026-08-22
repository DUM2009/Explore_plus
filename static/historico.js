import { db, auth } from "./firebase.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


export async function guardarHistorico(texto){

    const user = auth.currentUser;


    if(!user){
        console.log("Utilizador não está ligado");
        return;
    }


    await addDoc(collection(db,"historico"),{

        uid:user.uid,

        texto:texto,

        data:serverTimestamp()

    });


    console.log("Histórico guardado!");
}