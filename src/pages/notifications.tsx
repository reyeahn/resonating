// notification center and alerts display
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { FaUser, FaHeart, FaComment, FaUserFriends, FaMusic } from 'react-icons/fa';
import { getUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead, Notification } from '@/services/notifications';

const Notifications: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const unreadNotifications = await getUnreadNotifications(user!.uid);
      setNotifications(unreadNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(user!.uid);
      setNotifications([]);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      await markNotificationAsRead(notification.id);
      setNotifications(notifications.filter(n => n.id !== notification.id));

      // navigate based on notification type
      switch (notification.type) {
        case 'friend_request':
          router.push('/friends?tab=requests');
          break;
        case 'match':
          router.push('/matches');
          break;
        case 'like':
        case 'comment':
          if (notification.relatedId) {
            router.push(`/post/${notification.relatedId}`);
          }
          break;
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'friend_request':
        return <FaUserFriends className="h-5 w-5 text-blue-500" />;
      case 'match':
        return <FaMusic className="h-5 w-5 text-green-500" />;
      case 'like':
        return <FaHeart className="h-5 w-5 text-red-500" />;
      case 'comment':
        return <FaComment className="h-5 w-5 text-purple-500" />;
      default:
        return <FaUser className="h-5 w-5 text-gray-500" />;
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 pt-16 pb-20 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          {notifications.length > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4">
              <FaUser className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No new notifications
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              When you get new notifications, they'll appear here!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className="w-full bg-white dark:bg-dark-200 rounded-lg shadow-md p-4 text-left hover:bg-gray-50 dark:hover:bg-dark-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700">
                    {notification.fromUserPhotoURL ? (
                      <img
                        src={notification.fromUserPhotoURL}
                        alt={notification.fromUserName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 dark:text-white">
                      <span className="font-semibold">{notification.fromUserName}</span>
                      {' '}
                      {notification.content}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications; 