// This file is used for Jest test setup

import { TextEncoder, TextDecoder } from 'util';
import { config } from 'dotenv';

// Load environment variables from .env file for tests
config();

// Add TextEncoder and TextDecoder for jose library
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
