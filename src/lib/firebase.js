import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCKMLjQSSat5JB31-ijgsS3yHGIXYPa0ag",
  authDomain: "cirad-suivi-projets.firebaseapp.com",
  projectId: "cirad-suivi-projets",
  storageBucket: "cirad-suivi-projets.firebasestorage.app",
  messagingSenderId: "290058721591",
  appId: "1:290058721591:web:c6ae042e7124467c7922b2",
};

let app = null;
let cloudDb = null;
let cloudAuth = null;

export function initFirebase() {
  if (cloudDb) return;
  try {
    app = firebase.initializeApp(firebaseConfig);
    cloudDb = firebase.firestore();
    cloudAuth = firebase.auth();
    console.log('✅ Firebase connecté');
  } catch (e) {
    console.warn('⚠️ Firebase:', e.message);
  }
}

export function getCloudDb() {
  return cloudDb;
}

export function getCloudAuth() {
  return cloudAuth;
}
