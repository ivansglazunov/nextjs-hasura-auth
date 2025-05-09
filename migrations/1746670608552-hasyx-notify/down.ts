import dotenv from 'dotenv';
import { down } from 'hasyx/lib/down-notify';

// Load environment variables from root .env file
dotenv.config();

// Run the migration
down(); 