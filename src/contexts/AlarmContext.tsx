import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import * as db from '../db';
import type { Alarm } from '../types';

interface AlarmContextType {
  alarms: Alarm[];
  activeAlarm: Alarm | null;
  loading: boolean;
  addAlarm: (title: string, time: string, daysOfWeek: number[]) => Promise<void>;
  updateAlarm: (id: number, title: string, time: string, daysOfWeek: number[]) => Promise<void>;
  toggleAlarm: (id: number, isActive: boolean) => Promise<void>;
  deleteAlarm: (id: number) => Promise<void>;
  dismissAlarm: () => void;
  snoozeAlarm: (id: number, minutes: number) => void;
  getSnoozeCount: (id: number) => number;
}

const AlarmContext = createContext<AlarmContextType | undefined>(undefined);

export const AlarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser } = useAuth();
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [loading, setLoading] = useState(true);
  const lastTriggeredTime = useRef<string | null>(null);
  
  // Track snooze state: alarmId -> { count: number, nextTrigger: timestamp }
  const snoozeState = useRef<Record<number, { count: number; nextTrigger: number }>>({});

  const refreshAlarms = useCallback(async () => {
    if (!authUser) return;
    try {
      const data = await db.getAlarms(authUser.id);
      setAlarms(data);
    } catch (error) {
      console.error('Failed to fetch alarms:', error);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) {
      refreshAlarms();
    } else {
      setAlarms([]);
      setLoading(false);
    }
  }, [authUser, refreshAlarms]);

  const addAlarm = async (title: string, time: string, daysOfWeek: number[]) => {
    if (!authUser) return;
    await db.addAlarm(authUser.id, title, time, daysOfWeek);
    await refreshAlarms();
  };

  const updateAlarm = async (id: number, title: string, time: string, daysOfWeek: number[]) => {
    await db.updateAlarm(id, title, time, daysOfWeek);
    // Reset snooze on edit
    delete snoozeState.current[id];
    await refreshAlarms();
  };

  const toggleAlarm = async (id: number, isActive: boolean) => {
    await db.toggleAlarm(id, isActive);
    // Reset snooze on toggle
    delete snoozeState.current[id];
    await refreshAlarms();
  };

  const deleteAlarm = async (id: number) => {
    await db.deleteAlarm(id);
    delete snoozeState.current[id];
    await refreshAlarms();
  };

  const dismissAlarm = () => {
    if (activeAlarm) {
      // Clear snooze state when fully dismissed/neutralized
      delete snoozeState.current[activeAlarm.id];
    }
    setActiveAlarm(null);
  };

  const snoozeAlarm = (id: number, minutes: number) => {
    const currentSnooze = snoozeState.current[id] || { count: 0, nextTrigger: 0 };
    const until = Date.now() + minutes * 60 * 1000;
    
    snoozeState.current[id] = {
      count: currentSnooze.count + 1,
      nextTrigger: until
    };
    
    setActiveAlarm(null);
  };

  const getSnoozeCount = (id: number) => {
    return snoozeState.current[id]?.count || 0;
  };

  // Alarm Checker Logic
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentDay = now.getDay(); // 0-6
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const nowTs = Date.now();

      // Prevent multiple triggers in the same minute for the INITIAL trigger
      const isNewMinute = lastTriggeredTime.current !== currentTimeStr;

      const trigger = alarms.find(alarm => {
        if (!alarm.is_active) return false;

        const snooze = snoozeState.current[alarm.id];
        
        if (snooze) {
          // If already snoozed, trigger if we've passed the nextTrigger time
          return nowTs >= snooze.nextTrigger;
        } else {
          // If not snoozed, trigger if time matches and it's a new minute
          return isNewMinute && 
                 alarm.time === currentTimeStr && 
                 alarm.days_of_week.includes(currentDay);
        }
      });

      if (trigger) {
        setActiveAlarm(trigger);
        // Only update lastTriggeredTime for the primary trigger (non-snoozed)
        if (!snoozeState.current[trigger.id]) {
          lastTriggeredTime.current = currentTimeStr;
        } else {
          // Update snooze trigger time to prevent immediate re-firing while overlay is up
          snoozeState.current[trigger.id].nextTrigger = nowTs + 60000; 
        }
      }
    }, 5000); 

    return () => clearInterval(interval);
  }, [alarms]);

  return (
    <AlarmContext.Provider value={{ alarms, activeAlarm, loading, addAlarm, updateAlarm, toggleAlarm, deleteAlarm, dismissAlarm, snoozeAlarm, getSnoozeCount }}>
      {children}
    </AlarmContext.Provider>
  );
};

export const useAlarms = () => {
  const context = useContext(AlarmContext);
  if (context === undefined) {
    throw new Error('useAlarms must be used within an AlarmProvider');
  }
  return context;
};
