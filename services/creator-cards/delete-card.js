const validator = require('@app-core/validator');
const CreatorCard = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-creator-card');
const throwCreatorCardError = require('./throw-creator-card-error');

const deleteCardSpec = `root {
  slug string<trim>
  creator_reference string<trim|length:20>
}`;

const parsedDeleteCardSpec = validator.parse(deleteCardSpec);

async function softDeleteCard(card, deletedAt, options = {}) {
  const CreatorCardModel = CreatorCard.raw();
  const updateResult = await CreatorCardModel.updateOne(
    { _id: card._id, deleted: 0 },
    [
      {
        $set: {
          deleted: deletedAt,
          updated: deletedAt,
          slug: { $concat: [`&del:${deletedAt}-`, '$slug'] },
        },
      },
    ],
    options
  );

  return updateResult;
}

async function deleteCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedDeleteCardSpec);
  const card = await CreatorCard.findOne({
    query: {
      slug: data.slug,
      creator_reference: data.creator_reference,
    },
  });

  if (!card) {
    throwCreatorCardError('NF01');
  }

  const deletedAt = Date.now();
  await softDeleteCard(card, deletedAt, options);

  const response = serializeCreatorCard(
    {
      ...card,
      updated: deletedAt,
    },
    { includeAccessCode: true, deleted: deletedAt }
  );

  return response;
}

module.exports = deleteCreatorCard;
