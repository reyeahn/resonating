import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  onSnapshot,
  addDoc,
  Timestamp,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { createNotification } from './notifications';

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: Timestamp;
  isRead: boolean;
}

export interface ChatConversation {
  id: string;
  participants: string[];
  participantNames: {[key: string]: string};
  participantPhotos: {[key: string]: string};
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: Timestamp;
    isRead: boolean;
  };
  relationshipType: 'match' | 'friend' | 'both';
  matchData?: {
    postId: string;
    songTitle: string;
    songArtist: string;
    songCoverUrl: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Get or create a conversation between two users
export const getOrCreateConversation = async (
  userId1: string,
  userId2: string,
  relationshipType: 'match' | 'friend' | 'both' = 'friend'
): Promise<string> => {
  try {
    // The conversation ID is always the same regardless of who initiates it
    // We sort the user IDs alphabetically to ensure consistency
    const participants = [userId1, userId2].sort();
    const conversationId = `${participants[0]}_${participants[1]}`;
    
    // Check if conversation already exists
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (conversationDoc.exists()) {
      // Update relationship type if needed
      const existingData = conversationDoc.data();
      const currentType = existingData.relationshipType;
      
      if (currentType !== 'both' && currentType !== relationshipType) {
        // If one is 'match' and one is 'friend', update to 'both'
        await updateDoc(conversationRef, {
          relationshipType: 'both',
          updatedAt: serverTimestamp()
        });
      }
      
      return conversationId;
    }
    
    // Get user data for both participants to store names and photos
    const [user1Doc, user2Doc] = await Promise.all([
      getDoc(doc(db, 'users', userId1)),
      getDoc(doc(db, 'users', userId2))
    ]);
    
    const userData1 = user1Doc.exists() ? user1Doc.data() : null;
    const userData2 = user2Doc.exists() ? user2Doc.data() : null;
    
    // Create new conversation
    await setDoc(conversationRef, {
      participants,
      participantNames: {
        [userId1]: userData1?.displayName || 'User',
        [userId2]: userData2?.displayName || 'User'
      },
      participantPhotos: {
        [userId1]: userData1?.photoURL || null,
        [userId2]: userData2?.photoURL || null
      },
      relationshipType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return conversationId;
  } catch (error) {
    console.error('Error getting/creating conversation:', error);
    throw error;
  }
};

// Add match data to an existing conversation
export const addMatchDataToConversation = async (
  conversationId: string,
  matchData: {
    postId: string;
    songTitle: string;
    songArtist: string;
    songCoverUrl: string;
  }
): Promise<void> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      relationshipType: 'both',
      matchData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding match data to conversation:', error);
    throw error;
  }
};

// Get all conversations for a user
export const getUserConversations = async (
  userId: string
): Promise<ChatConversation[]> => {
  try {
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );
    
    const snapshot = await getDocs(conversationsQuery);
    const conversations: ChatConversation[] = [];
    
    snapshot.forEach(doc => {
      conversations.push({
        id: doc.id,
        ...doc.data()
      } as ChatConversation);
    });
    
    return conversations;
  } catch (error) {
    console.error('Error getting user conversations:', error);
    throw error;
  }
};

// Subscribe to real-time updates for all user conversations
export const subscribeToUserConversations = (
  userId: string,
  callback: (conversations: ChatConversation[]) => void
) => {
  const conversationsQuery = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(conversationsQuery, (snapshot) => {
    const conversations: ChatConversation[] = [];
    
    snapshot.forEach(doc => {
      conversations.push({
        id: doc.id,
        ...doc.data()
      } as ChatConversation);
    });
    
    callback(conversations);
  });
};

// Send a message
export const sendChatMessage = async (
  conversationId: string,
  senderId: string,
  content: string
): Promise<string> => {
  try {
    // Get conversation data to find recipient
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      throw new Error('Conversation not found');
    }
    
    const conversationData = conversationDoc.data();
    const recipientId = conversationData.participants.find(
      (id: string) => id !== senderId
    );
    
    // Add the message
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messageRef = await addDoc(messagesRef, {
      senderId,
      content,
      createdAt: serverTimestamp(),
      isRead: false
    });
    
    // Update conversation with last message info
    await updateDoc(conversationRef, {
      lastMessage: {
        content,
        senderId,
        timestamp: serverTimestamp(),
        isRead: false
      },
      updatedAt: serverTimestamp()
    });
    
    // Create a notification for the recipient
    const senderName = conversationData.participantNames[senderId] || 'User';
    
    await createNotification(
      recipientId,
      'message',
      senderId,
      senderName,
      conversationData.participantPhotos[senderId],
      `${senderName} sent you a message`,
      conversationId
    );
    
    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Subscribe to messages for a conversation
export const subscribeToConversationMessages = (
  conversationId: string,
  callback: (messages: ChatMessage[]) => void
) => {
  const messagesQuery = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages: ChatMessage[] = [];
    
    snapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data()
      } as ChatMessage);
    });
    
    callback(messages);
  });
};

// Mark messages as read
export const markConversationMessagesAsRead = async (
  conversationId: string,
  readerId: string
): Promise<void> => {
  try {
    // Find unread messages not sent by the reader
    const messagesQuery = query(
      collection(db, 'conversations', conversationId, 'messages'),
      where('senderId', '!=', readerId),
      where('isRead', '==', false)
    );
    
    const messagesSnapshot = await getDocs(messagesQuery);
    
    if (messagesSnapshot.empty) {
      return; // No unread messages
    }
    
    // Create batch update
    const batch = writeBatch(db);
    
    messagesSnapshot.forEach(messageDoc => {
      batch.update(messageDoc.ref, { isRead: true });
    });
    
    // Check if last message needs to be updated
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (conversationDoc.exists()) {
      const lastMessage = conversationDoc.data().lastMessage;
      
      if (lastMessage && !lastMessage.isRead && lastMessage.senderId !== readerId) {
        batch.update(conversationRef, { 'lastMessage.isRead': true });
      }
    }
    
    await batch.commit();
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Migration function: convert match chats to unified chat system
export const migrateMatchToConversation = async (matchId: string): Promise<string> => {
  try {
    // Get match data
    const matchRef = doc(db, 'matches', matchId);
    const matchDoc = await getDoc(matchRef);
    
    if (!matchDoc.exists()) {
      throw new Error('Match not found');
    }
    
    const matchData = matchDoc.data();
    const userIds = matchData.userIds;
    
    // Create a conversation
    const conversationId = await getOrCreateConversation(
      userIds[0],
      userIds[1],
      'match'
    );
    
    // Add match data to conversation
    await addMatchDataToConversation(
      conversationId,
      {
        postId: matchData.postId,
        songTitle: matchData.songData.title,
        songArtist: matchData.songData.artist,
        songCoverUrl: matchData.songData.coverArtUrl
      }
    );
    
    // Get all messages from the match
    const messagesQuery = query(
      collection(db, 'matches', matchId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    
    const messagesSnapshot = await getDocs(messagesQuery);
    
    // Move messages to the conversation
    const batch = writeBatch(db);
    let lastMessage: {
      content: string;
      senderId: string;
      timestamp: any;
      isRead: boolean;
    } | null = null;
    
    messagesSnapshot.forEach(messageDoc => {
      const messageData = messageDoc.data();
      
      // Create new message in the conversation
      const newMessageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
      
      batch.set(newMessageRef, {
        senderId: messageData.senderId,
        content: messageData.text,
        createdAt: messageData.timestamp,
        isRead: messageData.isRead
      });
      
      // Keep track of the most recent message
      if (!lastMessage || messageData.timestamp > lastMessage.timestamp) {
        lastMessage = {
          content: messageData.text,
          senderId: messageData.senderId,
          timestamp: messageData.timestamp,
          isRead: messageData.isRead
        };
      }
    });
    
    // Update conversation with last message if available
    if (lastMessage) {
      const conversationRef = doc(db, 'conversations', conversationId);
      batch.update(conversationRef, {
        lastMessage,
        updatedAt: serverTimestamp()
      });
    }
    
    await batch.commit();
    
    return conversationId;
  } catch (error) {
    console.error('Error migrating match to conversation:', error);
    throw error;
  }
}; 