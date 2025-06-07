// database migration script for matches

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, getDocs, writeBatch } = require('firebase/firestore');

const firebaseConfig = {

};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateMatches() {
  try {
    console.log(' Starting match migration...');
    
    const allMatchesQuery = query(collection(db, 'matches'));
    const snapshot = await getDocs(allMatchesQuery);
    
    console.log(` Found ${snapshot.size} total matches`);
    
    const batch = writeBatch(db);
    let updatedCount = 0;
    
    snapshot.forEach((matchDoc) => {
      const matchData = matchDoc.data();
      
      const needsMigration = (
        matchData.isActive === undefined || 
        (!matchData.lastMessage && !matchData.lastMessageAt)
      );
      
      if (needsMigration) {
        const updates = {};
        
        if (matchData.isActive === undefined) {
          updates.isActive = true;
          console.log(` Adding isActive=true to match ${matchDoc.id}`);
        }
        
        if (!matchData.lastMessage && !matchData.lastMessageAt) {
          updates.lastMessage = matchData.createdAt || new Date();
          console.log(` Adding lastMessage to match ${matchDoc.id}`);
        } else if (matchData.lastMessageAt && !matchData.lastMessage) {
          updates.lastMessage = matchData.lastMessageAt;
          console.log(` Converting lastMessageAt to lastMessage for match ${matchDoc.id}`);
        }
        
        batch.update(matchDoc.ref, updates);
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(` Migration complete: Updated ${updatedCount} match documents`);
    } else {
      console.log(' No matches needed migration - all up to date!');
    }
    
  } catch (error) {
    console.error(' Error migrating matches:', error);
  }
}

migrateMatches().then(() => {
  console.log('Migration script finished');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 