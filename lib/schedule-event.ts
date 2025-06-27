import Debug from './debug';
import { Hasyx } from './hasyx';

const debug = Debug('schedule-event');

export interface ScheduleRecord {
  id: string;
  message_id?: string;
  cron: string;
  start_at: number;
  end_at: number;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EventRecord {
  id: string;
  schedule_id?: string;
  message_id: string;
  user_id?: string;
  plan_start?: number;
  start?: number;
  end?: number;
  plan_end?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  scheduled: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Simple cron parser for basic expressions like "* * * * *" (every minute)
 * This is a basic implementation for common cases
 */
function parseCronExpression(cronExpression: string): { minute: number | null, interval: number } {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression format. Expected: minute hour day month weekday');
  }
  
  const [minute, hour, day, month, weekday] = parts;
  
  // Handle simple cases
  if (minute === '*' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    // Every minute
    return { minute: null, interval: 60 };
  }
  
  if (minute.startsWith('*/')) {
    // Every N minutes
    const intervalMinutes = parseInt(minute.substring(2));
    if (isNaN(intervalMinutes)) {
      throw new Error('Invalid interval in cron expression');
    }
    return { minute: null, interval: intervalMinutes * 60 };
  }
  
  if (!isNaN(parseInt(minute)) && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    // Specific minute every hour
    return { minute: parseInt(minute), interval: 3600 };
  }
  
  // For more complex expressions, default to every minute
  debug(`Complex cron expression "${cronExpression}" defaulting to every minute`);
  return { minute: null, interval: 60 };
}

/**
 * Calculate next execution time based on cron expression
 */
export function calculateNextRun(cronExpression: string, fromTime: number): number | null {
  try {
    const { minute, interval } = parseCronExpression(cronExpression);
    const fromDate = new Date(fromTime * 1000);
    
    if (minute === null) {
      // Interval-based scheduling
      const nextTime = fromTime + interval;
      return nextTime;
    } else {
      // Minute-specific scheduling (every hour at specific minute)
      const currentMinute = fromDate.getUTCMinutes();
      const nextHour = new Date(fromDate);
      
      if (currentMinute >= minute) {
        // Next occurrence is in the next hour
        nextHour.setUTCHours(nextHour.getUTCHours() + 1);
      }
      
      nextHour.setUTCMinutes(minute);
      nextHour.setUTCSeconds(0);
      nextHour.setUTCMilliseconds(0);
      
      return Math.floor(nextHour.getTime() / 1000);
    }
  } catch (error) {
    debug(`Error parsing cron expression "${cronExpression}":`, error);
    return null;
  }
}

/**
 * Handle schedule create/update - clean unscheduled events and create next event
 */
export async function handleScheduleChange(
  hasyx: Hasyx,
  schedule: ScheduleRecord,
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
) {
  debug(`Processing schedule ${operation} for ${schedule.id}`);
  
  if (operation === 'DELETE') {
    // Remove all pending events for this schedule
    await hasyx.delete({
      table: 'events',
      where: {
        schedule_id: { _eq: schedule.id },
        scheduled: { _eq: false }
      }
    });
    debug(`Deleted unscheduled events for schedule ${schedule.id}`);
    return;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Check if schedule is still active
  if (currentTime >= schedule.end_at) {
    debug(`Schedule ${schedule.id} has ended, skipping event creation`);
    return;
  }
  
  // Delete existing unscheduled events for this schedule
  await hasyx.delete({
    table: 'events',
    where: {
      schedule_id: { _eq: schedule.id },
      scheduled: { _eq: false }
    }
  });
  
  // Calculate next run time
  const nextRun = calculateNextRun(schedule.cron, Math.max(currentTime, schedule.start_at));
  
  if (!nextRun || nextRun >= schedule.end_at) {
    debug(`No more runs scheduled for ${schedule.id}`);
    return;
  }
  
  // Create next event
  const newEvent = {
    schedule_id: schedule.id,
    message_id: schedule.message_id,
    user_id: schedule.user_id,
    plan_start: nextRun,
    status: 'pending' as const,
    scheduled: false
  };
  
  await hasyx.insert({
    table: 'events',
    objects: [newEvent]
  });
  
  debug(`Created next event for schedule ${schedule.id} at ${new Date(nextRun * 1000).toISOString()}`);
}

/**
 * Handle event status change from scheduled false to true
 */
export async function handleEventScheduled(
  hasyx: Hasyx,
  event: EventRecord,
  oldEvent: EventRecord
) {
  // Only process if scheduled changed from false to true
  if (oldEvent.scheduled === false && event.scheduled === true && event.schedule_id) {
    debug(`Event ${event.id} was scheduled, creating next event`);
    
    // Get the schedule
    const scheduleResult = await hasyx.select({
      table: 'schedule',
      where: { id: { _eq: event.schedule_id } }
    });
    
    if (scheduleResult.length === 0) {
      debug(`Schedule ${event.schedule_id} not found`);
      return;
    }
    
    const schedule = scheduleResult[0] as ScheduleRecord;
    await handleScheduleChange(hasyx, schedule, 'UPDATE');
  }
}

/**
 * Process pending events that should start now
 */
export async function processScheduledEvents(
  hasyx: Hasyx,
  eventHandler: (event: EventRecord, schedule?: ScheduleRecord) => Promise<void>
) {
  const currentTime = Math.floor(Date.now() / 1000);
  debug(`Processing scheduled events at ${new Date().toISOString()}`);
  
  // Find events that should start now
  const pendingEvents = await hasyx.select({
    table: 'events',
    where: {
      scheduled: { _eq: false },
      plan_start: { _lte: currentTime },
      status: { _eq: 'pending' }
    }
  }) as EventRecord[];
  
  debug(`Found ${pendingEvents.length} events to process`);
  
  for (const event of pendingEvents) {
    try {
      let schedule: ScheduleRecord | undefined;
      
      // Get schedule if event is part of one
      if (event.schedule_id) {
        const scheduleResult = await hasyx.select({
          table: 'schedule',
          where: { id: { _eq: event.schedule_id } }
        });
        schedule = scheduleResult[0] as ScheduleRecord;
      }
      
      // Call the event handler
      await eventHandler(event, schedule);
      
      // Mark event as scheduled
      await hasyx.update({
        table: 'events',
        where: { id: { _eq: event.id } },
        _set: { scheduled: true }
      });
      
      debug(`Processed event ${event.id}`);
    } catch (error) {
      debug(`Error processing event ${event.id}:`, error);
    }
  }
}

/**
 * Default event handler - moves event to in_progress status
 */
export async function defaultEventHandler(
  hasyx: Hasyx,
  event: EventRecord,
  schedule?: ScheduleRecord
): Promise<void> {
  const currentTime = Math.floor(Date.now() / 1000);
  
  await hasyx.update({
    table: 'events',
    where: { id: { _eq: event.id } },
    _set: {
      status: 'in_progress',
      start: currentTime
    }
  });
  
  debug(`Event ${event.id} moved to in_progress status`);
}

/**
 * Main handler function for schedule event processing
 */
export async function handleScheduleEvent(
  hasyx: Hasyx,
  eventHandler: (event: EventRecord, schedule?: ScheduleRecord) => Promise<void> = (event, schedule) => defaultEventHandler(hasyx, event, schedule)
) {
  return processScheduledEvents(hasyx, eventHandler);
} 