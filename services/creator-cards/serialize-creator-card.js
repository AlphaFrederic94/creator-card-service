function normalizeDeletedValue(deleted) {
  let normalized = deleted;

  if (!deleted) {
    normalized = null;
  }

  return normalized;
}

function serializeCreatorCard(card, options = {}) {
  const { includeAccessCode = false, deleted } = options;
  let response;

  if (card) {
    response = {
      id: card._id,
      title: card.title,
      description: card.description,
      slug: card.slug,
      creator_reference: card.creator_reference,
      links: card.links || [],
      service_rates: card.service_rates,
      status: card.status,
      access_type: card.access_type || 'public',
      created: card.created,
      updated: card.updated,
      deleted: normalizeDeletedValue(typeof deleted === 'undefined' ? card.deleted : deleted),
    };

    if (includeAccessCode) {
      response.access_code = card.access_code || null;
    }
  }

  return response;
}

module.exports = serializeCreatorCard;
