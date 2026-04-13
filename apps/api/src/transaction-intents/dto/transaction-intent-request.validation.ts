export const TRANSACTION_INTENT_IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const TRANSACTION_INTENT_IDEMPOTENCY_KEY_MAX_LENGTH = 120;
export const TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH = 2;
export const TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH = 20;
export const TRANSACTION_INTENT_AMOUNT_PATTERN =
  /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
export const TRANSACTION_INTENT_AMOUNT_PATTERN_MESSAGE =
  "amount must be a positive decimal string with up to 18 decimal places.";
