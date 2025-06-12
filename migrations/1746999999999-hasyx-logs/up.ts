import dotenv from 'dotenv';
import { up } from 'hasyx/lib/up-logs';

// Load environment variables from root .env file
dotenv.config();

// Run the migration
up(); 