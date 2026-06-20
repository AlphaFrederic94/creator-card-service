const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { CreatorCardMessages } = require('@app/messages');

function throwValidationError(message) {
  throwAppError(message, ERROR_CODE.VALIDATIONERR);
}

function isSlugValid(slug) {
  return /^[A-Za-z0-9_-]+$/.test(slug);
}

function isAccessCodeValid(accessCode) {
  return /^[A-Za-z0-9]+$/.test(accessCode);
}

function validateSlug(slug) {
  if (!isSlugValid(slug)) {
    throwValidationError(CreatorCardMessages.INVALID_SLUG);
  }
}

function validateAccessCodeFormat(accessCode) {
  if (!isAccessCodeValid(accessCode)) {
    throwValidationError(CreatorCardMessages.INVALID_ACCESS_CODE_FORMAT);
  }
}

function validateLinkUrls(links = []) {
  links.forEach((link) => {
    if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
      throwValidationError(CreatorCardMessages.INVALID_LINK_URL);
    }
  });
}

function validateServiceRateAmounts(serviceRates) {
  if (serviceRates?.rates) {
    serviceRates.rates.forEach((rate) => {
      if (!Number.isInteger(rate.amount) || rate.amount < 1) {
        throwValidationError(CreatorCardMessages.INVALID_RATE_AMOUNT);
      }
    });
  }
}

module.exports = {
  validateSlug,
  validateAccessCodeFormat,
  validateLinkUrls,
  validateServiceRateAmounts,
};
