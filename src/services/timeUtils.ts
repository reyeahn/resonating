// pacific timezone calculations and temporal logic

/**
 * gets the current Pacific Time Date object
 */
export const getPacificTime = (): Date => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
};

/**
 * Gets the most recent 9 AM Pacific reset time

 */
export const getLastResetTime = (): Date => {
  const pacificNow = getPacificTime();
  const resetTime = new Date(pacificNow);
  
  // set to 9 AM today
  resetTime.setHours(9, 0, 0, 0);
  
  // if current time is before 9 AM today, use yesterday's 9 AM
  if (pacificNow.getTime() < resetTime.getTime()) {
    resetTime.setDate(resetTime.getDate() - 1);
  }
  
  return resetTime;
};

/**
 * gets the next 9 AM Pacific reset time
 */
export const getNextResetTime = (): Date => {
  const pacificNow = getPacificTime();
  const nextReset = new Date(pacificNow);
  
  nextReset.setHours(9, 0, 0, 0);
  
  if (pacificNow.getTime() >= nextReset.getTime()) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  
  return nextReset;
};

/**
 * checks if a given timestamp is after the most recent 9 AM Pacific reset
 */
export const isAfterLastReset = (timestamp: Date | any): boolean => {
  const lastReset = getLastResetTime();
  
  const dateToCheck = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  
  return dateToCheck.getTime() > lastReset.getTime();
};

/**
 * checks if the user has posted today (after 9 AM Pacific reset)
 */
export const hasPostedToday = (lastPostDate: Date | any | null, lastPostDateManual?: Date | any | null): boolean => {
  if (!lastPostDate && !lastPostDateManual) return false;
  
  // try primary timestamp first
  if (lastPostDate) {
    const result = isAfterLastReset(lastPostDate);
    console.log(' hasPostedToday check (primary):', {
      lastPostDate,
      isAfterReset: result,
      lastResetTime: getLastResetTime()
    });
    if (result) return true;
  }
  
  if (lastPostDateManual) {
    const result = isAfterLastReset(lastPostDateManual);
    console.log(' hasPostedToday check (fallback):', {
      lastPostDateManual,
      isAfterReset: result,
      lastResetTime: getLastResetTime()
    });
    return result;
  }
  
  return false;
};

/**
 * gets a human-readable time until next reset
 */
export const getTimeUntilReset = (): string => {
  const now = getPacificTime();
  const nextReset = getNextResetTime();
  const diff = nextReset.getTime() - now.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

/**
 * formats a date as a human-readable date string
 */
export const formatPostDate = (date: Date | any): string => {
  const postDate = date?.toDate ? date.toDate() : new Date(date);
  const now = getPacificTime();
  
  // check if it's today
  const isToday = postDate.toDateString() === now.toDateString();
  if (isToday) return 'Today';
  
  // check if it's yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = postDate.toDateString() === yesterday.toDateString();
  if (isYesterday) return 'Yesterday';
  
  // otherwise format as "Jan 15, 2024"
  return postDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}; 