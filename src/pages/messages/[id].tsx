// message thread display and management
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/services/firebase';
import { FaUser, FaArrowLeft, FaPaperPlane, FaMusic } from 'react-icons/fa';
import { 
  ChatMessage, 
  ChatConversation,
  subscribeToConversationMessages, 
  sendChatMessage, 
  markConversationMessagesAsRead,
  getOrCreateConversation
} from '@/services/chat';

const ChatPage: React.FC = () => {
  const router = useRouter();
  const { id: conversationId } = router.query;
  const { user } = useAuth();
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [otherUser, setOtherUser] = useState<{id: string; name: string; photoURL: string | null}>({
    id: '',
    name: '',
    photoURL: null
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // fetch conversation data and determine the other user
  useEffect(() => {
    const fetchConversation = async () => {
      if (!conversationId || typeof conversationId !== 'string' || !user) return;
      
      try {
        setLoading(true);
        const conversationRef = doc(db, 'conversations', conversationId);
        const conversationDoc = await getDoc(conversationRef);
        
        if (conversationDoc.exists()) {
          const conversationData = conversationDoc.data() as ChatConversation;
          setConversation({
            ...conversationData,
            id: conversationDoc.id
          });
          
          // determine which user is the other person
          const otherUserId = conversationData.participants.find(id => id !== user.uid) || '';
          
          setOtherUser({
            id: otherUserId,
            name: conversationData.participantNames[otherUserId] || 'User',
            photoURL: conversationData.participantPhotos[otherUserId] || null
          });
          
        } else {
          console.error('Conversation not found');
          setLoading(false);
          router.push('/friends');
          return;
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching conversation:', error);
        setLoading(false);
      }
    };
    
    fetchConversation();
  }, [conversationId, user, router]);

  // subscribe to messages
  useEffect(() => {
    if (!conversationId || typeof conversationId !== 'string' || !user) return;
    
    const unsubscribe = subscribeToConversationMessages(
      conversationId,
      (updatedMessages) => {
        setMessages(updatedMessages);
        
        markConversationMessagesAsRead(conversationId, user.uid).catch(err => {
          console.error('Error marking messages as read:', err);
        });
      }
    );
    
    return () => unsubscribe();
  }, [conversationId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!user || !conversationId || typeof conversationId !== 'string' || !newMessage.trim()) return;
    
    try {
      await sendChatMessage(conversationId, user.uid, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  if (!user || loading || !conversation) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col pt-16 pb-0">
      {/* Chat header */}
      <div className="bg-white dark:bg-dark-200 p-4 shadow-md flex items-center sticky top-0 z-10">
        <button 
          onClick={() => router.back()}
          className="p-2 mr-2 text-primary-600 hover:text-primary-700"
        >
          <FaArrowLeft />
        </button>
        
        <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
          {otherUser.photoURL ? (
            <img 
              src={otherUser.photoURL} 
              alt={otherUser.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
              <FaUser className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <h2 className="font-medium text-gray-900 dark:text-white">
            {otherUser.name}
          </h2>
          
          {/* Show match song if available */}
          {conversation.matchData && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <FaMusic className="h-3 w-3 mr-1" />
              <span className="truncate max-w-xs">
                {conversation.matchData.songTitle} • {conversation.matchData.songArtist}
              </span>
            </div>
          )}
        </div>
        
        {/* View profile button */}
        <button
          onClick={() => router.push(`/profile/${otherUser.id}`)}
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 px-2 py-1"
        >
          View Profile
        </button>
      </div>
      
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No messages yet. Send a message to start the conversation!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.senderId === user.uid ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                  message.senderId === user.uid 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-200 dark:bg-dark-300 text-gray-900 dark:text-white'
                }`}
              >
                <p>{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.senderId === user.uid 
                    ? 'text-primary-100' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {message.createdAt?.toDate ? message.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <div className="bg-white dark:bg-dark-200 p-4 shadow-inner sticky bottom-0">
        <div className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 dark:bg-dark-300 text-gray-900 dark:text-white rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="bg-primary-600 text-white rounded-r-lg px-4 py-2 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 