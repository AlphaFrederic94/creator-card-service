/* eslint-disable no-await-in-loop */
const validator = require('@app-core/validator');
const { ERROR_CODE } = require('@app-core/errors');
const CreatorCard = require('@app/repository/creator-card');
const generateSlug = require('./generate-slug');
const serializeCreatorCard = require('./serialize-creator-card');
const throwCreatorCardError = require('./throw-creator-card-error');
const {
  validateSlug,
  validateAccessCodeFormat,
  validateLinkUrls,
  validateServiceRateAmounts,
} = require('./validators');

const createCardSpec = `root {
  title string<trim|lengthBetween:3,100>
  description? string<trim|maxLength:500>
  slug? string<trim|lengthBetween:5,50>
  creator_reference string<trim|length:20>
  links[]? {
    title string<trim|lengthBetween:1,100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string<trim|isAnyOf:NGN,USD,GBP,GHS>
    rates[] {
      name string<trim|lengthBetween:3,100>
      description string<trim|maxLength:250>
      amount number<min:1>
    }
  }
  status string<trim|isAnyOf:draft,published>
  access_type? string<trim|isAnyOf:public,private>
  access_code? string<trim|length:6>
}`;

const parsedCreateCardSpec = validator.parse(createCardSpec);

function isDuplicateSlugError(error) {
  return error?.code === 11000 || error?.errorCode === ERROR_CODE.DUPLRCRD;
}

async function createUniqueSlug(title) {
  let slug = generateSlug(title);
  let existingCard = await CreatorCard.findOne({ query: { slug } });

  while (existingCard) {
    slug = generateSlug(title, { forceSuffix: true });
    existingCard = await CreatorCard.findOne({ query: { slug } });
  }

  return slug;
}

function enforceAccessCodeRules(data) {
  const accessType = data.access_type || 'public';

  if (accessType === 'private' && !data.access_code) {
    throwCreatorCardError('AC01');
  }

  if (accessType === 'public' && typeof data.access_code !== 'undefined') {
    throwCreatorCardError('AC05');
  }

  if (data.access_code) {
    validateAccessCodeFormat(data.access_code);
  }
}

async function resolveSlug(data) {
  let slug;

  if (data.slug) {
    validateSlug(data.slug);

    const existingCard = await CreatorCard.findOne({ query: { slug: data.slug } });
    if (existingCard) {
      throwCreatorCardError('SL02');
    }

    slug = data.slug;
  } else {
    slug = await createUniqueSlug(data.title);
  }

  return slug;
}

async function createCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedCreateCardSpec);
  validateLinkUrls(data.links);
  validateServiceRateAmounts(data.service_rates);
  enforceAccessCodeRules(data);

  let slug = await resolveSlug(data);
  const wasSlugProvided = !!data.slug;
  let createdCard;
  let attempts = 0;

  while (!createdCard && attempts < 5) {
    attempts += 1;

    try {
      createdCard = await CreatorCard.create(
        {
          title: data.title,
          description: data.description,
          slug,
          creator_reference: data.creator_reference,
          links: data.links || [],
          service_rates: data.service_rates,
          status: data.status,
          access_type: data.access_type || 'public',
          access_code: data.access_type === 'private' ? data.access_code : null,
        },
        options
      );
    } catch (error) {
      if (!isDuplicateSlugError(error)) {
        throw error;
      }

      if (wasSlugProvided) {
        throwCreatorCardError('SL02');
      }

      slug = generateSlug(data.title, { forceSuffix: true });
    }
  }

  if (!createdCard) {
    throwCreatorCardError('SL02');
  }

  const response = serializeCreatorCard(createdCard, { includeAccessCode: true });

  return response;
}

module.exports = createCreatorCard;
