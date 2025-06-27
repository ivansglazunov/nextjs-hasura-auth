import { Hasura } from './hasura';
import { Hasyx } from './hasyx';
import { Generator } from './generator';
import { createApolloClient } from './apollo';
import { up } from './up-schedule';
import { down } from './down-schedule';
import { 
  calculateNextRun, 
  handleScheduleChange, 
  handleEventScheduled,
  processScheduledEvents,
  defaultEventHandler,
  ScheduleRecord,
  EventRecord 
} from './schedule-event';
import { generateHasuraSchema } from './hasura-schema';
import { v4 as uuidv4 } from 'uuid';
import schema from '../public/hasura-schema.json';

// Helper function to create unique test environment
async function createTestEnvironment() {
  const testSchema = `schedule_test_${uuidv4().replace(/-/g, '_')}`;
  
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  const apolloClient = createApolloClient({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  const hasyx = new Hasyx(apolloClient, Generator(schema));
  
  return { hasura, hasyx, testSchema };
}

// Helper function to create delay
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const isLocal = !+process?.env?.JEST_LOCAL!;

(isLocal ? describe.skip : describe)('Schedule Event System', () => {
  it('should create schedule, process events, and handle timing correctly', async () => {
    const { hasura, hasyx, testSchema } = await createTestEnvironment();
    
    try {
      // Setup: Apply schedule migration
      await up(hasura);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const startTime = currentTime + 60; // Start in 1 minute
      const endTime = currentTime + 300; // End in 5 minutes
      const messageId = uuidv4();
      const userId = uuidv4();
      
      // Create a schedule that runs every minute
      const scheduleData = {
        message_id: messageId,
        cron: '* * * * *', // Every minute
        start_at: startTime,
        end_at: endTime,
        user_id: userId
      };
      
      console.log(`Creating schedule from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
      
      // Insert schedule
      const scheduleResult = await hasyx.insert({
        table: 'schedule',
        objects: [scheduleData]
      });
      
      expect(scheduleResult.insert_schedule?.returning).toHaveLength(1);
      const schedule = scheduleResult.insert_schedule?.returning[0] as ScheduleRecord;
      
      console.log(`Created schedule ${schedule.id}`);
      
      // Wait a moment for any potential triggers
      await delay(1000);
      
      // Check that first event was created
      let events = await hasyx.select({
        table: 'events',
        where: { schedule_id: { _eq: schedule.id } }
      }) as EventRecord[];
      
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('pending');
      expect(events[0].scheduled).toBe(false);
      expect(events[0].schedule_id).toBe(schedule.id);
      expect(events[0].message_id).toBe(messageId);
      
      console.log(`First event created: ${events[0].id}, planned start: ${new Date(events[0].plan_start! * 1000).toISOString()}`);
      
      // Fast-forward time by manipulating plan_start to trigger immediately
      const firstEvent = events[0];
      const immediateTime = Math.floor(Date.now() / 1000) - 5; // 5 seconds ago
      
      await hasyx.update({
        table: 'events',
        where: { id: { _eq: firstEvent.id } },
        _set: { plan_start: immediateTime }
      });
      
      console.log('Updated first event to trigger immediately');
      
      // Process scheduled events
      await processScheduledEvents(hasyx, defaultEventHandler);
      
      // Wait for processing
      await delay(1000);
      
      // Check that first event was processed
      events = await hasyx.select({
        table: 'events',
        where: { id: { _eq: firstEvent.id } }
      }) as EventRecord[];
      
      expect(events).toHaveLength(1);
      expect(events[0].status).toBe('in_progress');
      expect(events[0].scheduled).toBe(true);
      expect(events[0].start).toBeDefined();
      
      console.log(`First event processed: status=${events[0].status}, scheduled=${events[0].scheduled}`);
      
      // Check that next event was created
      const allEvents = await hasyx.select({
        table: 'events',
        where: { schedule_id: { _eq: schedule.id } }
      }) as EventRecord[];
      
      expect(allEvents.length).toBeGreaterThanOrEqual(2);
      
      const nextEvents = allEvents.filter(e => e.id !== firstEvent.id);
      expect(nextEvents).toHaveLength(1);
      expect(nextEvents[0].status).toBe('pending');
      expect(nextEvents[0].scheduled).toBe(false);
      
      console.log(`Second event created: ${nextEvents[0].id}`);
      
      // Wait 65 seconds to simulate time passage and process multiple events
      console.log('Simulating multiple time progressions...');
      
      let processedCount = 1; // We already processed the first one
      const maxEvents = 4; // Process 4 total events
      
      for (let i = 1; i < maxEvents; i++) {
        // Get current pending events
        const pendingEvents = await hasyx.select({
          table: 'events',
          where: { 
            schedule_id: { _eq: schedule.id },
            scheduled: { _eq: false },
            status: { _eq: 'pending' }
          }
        }) as EventRecord[];
        
        if (pendingEvents.length === 0) {
          console.log('No more pending events, breaking');
          break;
        }
        
        // Set the event to trigger immediately
        const currentEvent = pendingEvents[0];
        const triggerTime = Math.floor(Date.now() / 1000) - 5;
        
        await hasyx.update({
          table: 'events',
          where: { id: { _eq: currentEvent.id } },
          _set: { plan_start: triggerTime }
        });
        
        // Process the event
        await processScheduledEvents(hasyx, defaultEventHandler);
        await delay(1000);
        
        processedCount++;
        console.log(`Processed event ${i + 1}/${maxEvents}`);
      }
      
      // Wait 7 minutes (420 seconds) simulation by checking all events
      console.log('Checking final state after simulated 7 minutes...');
      
      // Get all events for this schedule
      const finalEvents = await hasyx.select({
        table: 'events',
        where: { schedule_id: { _eq: schedule.id } }
      }) as EventRecord[];
      
      console.log(`Total events created: ${finalEvents.length}`);
      
      // All processed events should be scheduled=true and in_progress
      const scheduledEvents = finalEvents.filter(e => e.scheduled === true);
      expect(scheduledEvents.length).toBeGreaterThanOrEqual(processedCount);
      
      scheduledEvents.forEach(event => {
        expect(event.status).toBe('in_progress');
        expect(event.scheduled).toBe(true);
        expect(event.start).toBeDefined();
      });
      
      // Should have created appropriate number of events
      // For a 5-minute window with every-minute schedule, we should have ~5 events
      expect(finalEvents.length).toBeGreaterThanOrEqual(4);
      expect(finalEvents.length).toBeLessThanOrEqual(6); // Allow some variance
      
      console.log(`Test completed successfully. Processed ${scheduledEvents.length} events out of ${finalEvents.length} total.`);
      
    } finally {
      // Cleanup: Remove schedule migration
      try {
        await down(hasura);
        console.log('Cleanup completed');
      } catch (error) {
        console.warn('Cleanup error (non-critical):', error);
      }
    }
  }, 60000); // 60 second timeout

  describe('Cron Expression Parsing', () => {
    it('should calculate next run times correctly', () => {
      const baseTime = 1640995200; // 2022-01-01 00:00:00 UTC
      
      // Every minute
      let nextRun = calculateNextRun('* * * * *', baseTime);
      expect(nextRun).toBe(baseTime + 60);
      
      // Every 5 minutes
      nextRun = calculateNextRun('*/5 * * * *', baseTime);
      expect(nextRun).toBe(baseTime + 300);
      
      // At 30 minutes past every hour
      nextRun = calculateNextRun('30 * * * *', baseTime);
      expect(nextRun).toBe(baseTime + 1800); // 30 minutes later
      
      // Invalid expression should return null
      nextRun = calculateNextRun('invalid', baseTime);
      expect(nextRun).toBe(null);
    });
  });

  describe('Schedule Management', () => {
    it('should handle schedule operations independently', async () => {
      const { hasura, hasyx } = await createTestEnvironment();
      
      try {
        await up(hasura);
        
        const currentTime = Math.floor(Date.now() / 1000);
        const messageId = uuidv4();
        
        const schedule: ScheduleRecord = {
          id: uuidv4(),
          message_id: messageId,
          cron: '*/2 * * * *', // Every 2 minutes
          start_at: currentTime,
          end_at: currentTime + 300,
          user_id: uuidv4()
        };
        
        // Test INSERT operation
        await handleScheduleChange(hasyx, schedule, 'INSERT');
        
        let events = await hasyx.select({
          table: 'events',
          where: { schedule_id: { _eq: schedule.id } }
        }) as EventRecord[];
        
        expect(events).toHaveLength(1);
        expect(events[0].scheduled).toBe(false);
        
        // Test DELETE operation
        await handleScheduleChange(hasyx, schedule, 'DELETE');
        
        events = await hasyx.select({
          table: 'events',
          where: { schedule_id: { _eq: schedule.id } }
        }) as EventRecord[];
        
        expect(events).toHaveLength(0);
        
      } finally {
        await down(hasura);
      }
    });
  });
}); 