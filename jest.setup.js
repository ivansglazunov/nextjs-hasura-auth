// This file is used for Jest test setup

import React from 'react';
import '@testing-library/jest-dom';

// For React 18 testing

// Add TextEncoder and TextDecoder for jose library
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
