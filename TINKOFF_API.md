# Tinkoff API Documentation

## Base URL
The current base URL for Tinkoff API is:
```
https://securepay.tinkoff.ru/v2
```

## Available Endpoints

### Init
Initiates a payment in the Tinkoff system.
- **URL**: `/Init`
- **Method**: POST
- **Request Format**: JSON

### GetState
Checks the status of a payment.
- **URL**: `/GetState`
- **Method**: POST
- **Request Format**: JSON

### Confirm
Confirms a two-stage payment.
- **URL**: `/Confirm`
- **Method**: POST
- **Request Format**: JSON

### Cancel
Cancels a payment or makes a refund.
- **URL**: `/Cancel`
- **Method**: POST
- **Request Format**: JSON

### AddCard
Initiates adding a new card for a customer.
- **URL**: `/AddCard`
- **Method**: POST
- **Request Format**: JSON

### GetCardList
Returns a list of saved customer cards.
- **URL**: `/GetCardList`
- **Method**: POST
- **Request Format**: JSON

### RemoveCard
Removes a customer's saved card.
- **URL**: `/RemoveCard`
- **Method**: POST
- **Request Format**: JSON

### Charge
Makes a recurring payment using a saved card.
- **URL**: `/Charge`
- **Method**: POST
- **Request Format**: JSON

## Authentication and Security

All requests to the API require:
1. **TerminalKey** - provided by Tinkoff during merchant registration
2. **Token** - security token calculated by concatenating request parameters and hashing them with SHA-256

### Token Generation
For each request, generate a token by:
1. Sort all request parameters alphabetically
2. Concatenate parameter values (excluding `Token`, `Receipt`, and other complex objects)
3. Add the terminal password to the string
4. Calculate SHA-256 hash of the resulting string

## Response Format

All API responses have a common structure:
```json
{
  "Success": true/false,
  "ErrorCode": "0",  // "0" means success
  "Message": "Error message if any",
  "Details": "Detailed error if any",
  "TerminalKey": "Your terminal key",
  // Other response fields specific to the operation
}
```

## Resources
- [Official Tinkoff Documentation](https://www.tinkoff.ru/kassa/dev/payments/)

## Note
This documentation is based on available open-source information and may not be complete. Always refer to the official Tinkoff documentation for the most up-to-date information. 