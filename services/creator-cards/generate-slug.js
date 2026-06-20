const { randomBytes } = require('@app-core/randomness');

function createSuffix() {
  return randomBytes(3).toLowerCase();
}

function toSlugBase(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

function generateSlug(title, options = {}) {
  const { forceSuffix = false } = options;
  const base = toSlugBase(title);
  let slug = base;

  if (forceSuffix || slug.length < 5) {
    slug = `${base}-${createSuffix()}`;
  }

  return slug;
}

module.exports = generateSlug;
