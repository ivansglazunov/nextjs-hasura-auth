// This file is used for Jest test setup

import { TextEncoder, TextDecoder } from 'util';

// Add TextEncoder and TextDecoder for jose library
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
