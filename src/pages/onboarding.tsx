// new user setup and profile creation
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';

// define the question types
type QuestionType = {
  id: number;
  question: string;
  type: 'text' | 'multiple-choice';
  options?: string[];
};

// define the questions for the onboarding process
const questions: QuestionType[] = [
  {
    id: 1,
    question: 'Describe your ideal weekend soundtrack',
    type: 'text',
  },
  {
    id: 2,
    question: 'Which genre lifts your mood the most?',
    type: 'multiple-choice',
    options: [
      'Pop',
      'Rock',
      'Hip-Hop',
      'R&B',
      'Electronic',
      'Classical',
      'Jazz',
      'Country',
      'Metal',
      'Indie',
    ],
  },
  {
    id: 3,
    question: 'How frequently do you discover new music?',
    type: 'multiple-choice',
    options: ['Daily', 'Weekly', 'Monthly', 'Rarely'],
  },
  {
    id: 4,
    question: 'Share a brief memory tied to one of your favorite songs',
    type: 'text',
  },
  {
    id: 5,
    question: 'Which mood tag best describes your favorite playlists?',
    type: 'multiple-choice',
    options: [
      'Energetic',
      'Chill',
      'Nostalgic',
      'Happy',
      'Sad',
      'Focused',
      'Romantic',
      'Party',
    ],
  },
];

const Onboarding: React.FC = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user, userData } = useAuth();

  // if user is not logged in, redirect to home
  if (!user) {
    typeof window !== 'undefined' && router.push('/');
    return null;
  }

  const handleTextAnswer = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAnswers({
      ...answers,
      [questions[currentQuestion].id]: e.target.value,
    });
  };

  const handleMultiChoiceAnswer = (option: string) => {
    setAnswers({
      ...answers,
      [questions[currentQuestion].id]: option,
    });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSkip = () => {
    // if skipped, set answer to "undisclosed"
    setAnswers({
      ...answers,
      [questions[currentQuestion].id]: 'undisclosed',
    });
    handleNext();
  };

  const handleSubmit = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const questionnaireData = {
        weekendSoundtrack: answers[1] || 'undisclosed',
        moodGenre: answers[2] || 'undisclosed',
        discoveryFrequency: answers[3] || 'undisclosed',
        favoriteSongMemory: answers[4] || 'undisclosed',
        preferredMoodTag: answers[5] || 'undisclosed',
      };

      // update the user document in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        questionnaire: questionnaireData,
        onboardingCompleted: true,
      });

      router.push('/post-song');
    } catch (error) {
      console.error('Error updating questionnaire:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQuestionData = questions[currentQuestion];
  const hasAnswer = !!answers[currentQuestionData.id];

  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-dark-200 rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">
              Tell us about your musical tastes
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Question {currentQuestion + 1} of {questions.length}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-dark-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full"
              style={{
                width: `${((currentQuestion + 1) / questions.length) * 100}%`,
              }}
            ></div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            {currentQuestionData.question}
          </h3>

          {currentQuestionData.type === 'text' ? (
            <textarea
              className="w-full h-32 p-3 border border-gray-300 dark:border-dark-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-dark-100 text-gray-900 dark:text-white"
              placeholder="Type your answer here..."
              value={answers[currentQuestionData.id] || ''}
              onChange={handleTextAnswer}
            ></textarea>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {currentQuestionData.options?.map((option) => (
                <button
                  key={option}
                  className={`p-3 rounded-lg text-left transition-colors ${
                    answers[currentQuestionData.id] === option
                      ? 'bg-primary-100 dark:bg-primary-900 border-2 border-primary-500'
                      : 'bg-light-200 dark:bg-dark-300 hover:bg-light-300 dark:hover:bg-dark-400'
                  }`}
                  onClick={() => handleMultiChoiceAnswer(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-300 border border-gray-300 dark:border-dark-500 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-400"
            onClick={handlePrevious}
            disabled={currentQuestion === 0 || isSubmitting}
          >
            Previous
          </button>

          <button
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-dark-300 border border-gray-300 dark:border-dark-500 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-400"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Skip
          </button>

          <button
            className={`px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 ${
              (!hasAnswer || isSubmitting) &&
              'opacity-50 cursor-not-allowed'
            }`}
            onClick={handleNext}
            disabled={!hasAnswer || isSubmitting}
          >
            {currentQuestion === questions.length - 1 ? 'Finish' : 'Continue'}
            {isSubmitting && (
              <span className="ml-2 inline-block animate-spin">⟳</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding; 