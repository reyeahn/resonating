// push notification management and delivery
import { db } from '@/services/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

export interface Notification {
  id: string;
  userId: string;
  type: 'friend_request' | 'match' | 'like' | 'comment' | 'message' | 'friend_request_accepted' | 'friend_added';
  fromUserId: string;
  fromUserName: string;
  fromUserPhotoURL?: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  relatedId?: string; // ID of the related post/match/etc
}

export const getUnreadNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(notificationsQuery);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
    })) as Notification[];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    
    const querySnapshot = await getDocs(notificationsQuery);
    const batch = writeBatch(db);
    
    querySnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const createNotification = async (
  userId: string,
  type: Notification['type'],
  fromUserId: string,
  fromUserName: string,
  fromUserPhotoURL: string | undefined,
  content: string,
  relatedId?: string
): Promise<string> => {
  try {
    // build notification data object, only including relatedId if it exists
    const notificationData: any = {
      userId,
      type,
      fromUserId,
      fromUserName,
      fromUserPhotoURL: fromUserPhotoURL || null,
      content,
      isRead: false,
      createdAt: serverTimestamp(),
    };
    
    // only add relatedId if it's not undefined
    if (relatedId !== undefined) {
      notificationData.relatedId = relatedId;
    }
    
    const notificationRef = await addDoc(collection(db, 'notifications'), notificationData);
    
    return notificationRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}; 