const { throwAppError } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');

const BUSINESS_ERROR_STATUS = {
  SL02: CreatorCardMessages.SLUG_ALREADY_TAKEN,
  AC01: CreatorCardMessages.PRIVATE_ACCESS_CODE_REQUIRED,
  AC05: CreatorCardMessages.PUBLIC_ACCESS_CODE_NOT_ALLOWED,
  NF01: CreatorCardMessages.CREATOR_CARD_NOT_FOUND,
  NF02: CreatorCardMessages.CREATOR_CARD_NOT_FOUND,
  AC03: CreatorCardMessages.PRIVATE_ACCESS_CODE_REQUIRED_FOR_RETRIEVAL,
  AC04: CreatorCardMessages.INVALID_ACCESS_CODE,
};

function throwCreatorCardError(code, message = BUSINESS_ERROR_STATUS[code]) {
  throwAppError(message, code);
}

module.exports = throwCreatorCardError;
