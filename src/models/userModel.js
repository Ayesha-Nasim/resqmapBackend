import { db } from "../config/firebase.js";

const usersCollection = db.collection("users");

export const UserModel = {
  async createUser(userData) {
    const docRef = await usersCollection.add(userData);
    return { id: docRef.id, ...userData };
  },

  async getUserByEmail(email) {
    const snapshot = await usersCollection.where("email", "==", email).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  },

  async getUserById(id) {
    const doc = await usersCollection.doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  async updateUser(id, updateData) {
  await usersCollection.doc(id).update({
    ...updateData,
    updatedAt: new Date(),
  });

  return this.getUserById(id);
},
async getUsersByRole(role) {
  const snap = await usersCollection.where("role", "==", role).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
},


};
