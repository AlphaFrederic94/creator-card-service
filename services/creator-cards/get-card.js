const validator = require('@app-core/validator');
const CreatorCard = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-creator-card');
const throwCreatorCardError = require('./throw-creator-card-error');

const getCardSpec = `root {
  slug string<trim>
  access_code? string<trim>
}`;

const parsedGetCardSpec = validator.parse(getCardSpec);

async function getCreatorCard(serviceData) {
  const data = validator.validate(serviceData, parsedGetCardSpec);
  const card = await CreatorCard.findOne({ query: { slug: data.slug } });

  if (!card) {
    throwCreatorCardError('NF01');
  }

  if (card.status === 'draft') {
    throwCreatorCardError('NF02');
  }

  if (card.access_type === 'private' && !data.access_code) {
    throwCreatorCardError('AC03');
  }

  if (card.access_type === 'private' && data.access_code !== card.access_code) {
    throwCreatorCardError('AC04');
  }

  const response = serializeCreatorCard(card, { includeAccessCode: false });

  return response;
}

module.exports = getCreatorCard;
