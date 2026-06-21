const { expect } = require('chai');
const { createConnection } = require('@app-core/mongoose');
const CreatorCard = require('@app/repository/creator-card');
const createCreatorCard = require('@app/services/creator-cards/create-card');
const getCreatorCard = require('@app/services/creator-cards/get-card');
const deleteCreatorCard = require('@app/services/creator-cards/delete-card');

const CRT_ONE = 'crt_8f2k1m9x4p7w3q5z';
const CRT_TWO = 'crt_a1b2c3d4e5f6g7h8';
const CRT_THREE = 'crt_x9y8z7w6v5u4t3s2';
const CRT_FOUR = 'crt_m1n2b3v4c5x6z7l8';
const CRT_FIVE = 'crt_q1w2e3r4t5y6u7i8';
const CRT_DRAFT = 'crt_draft0000000000a';
const CRT_SLUG = 'crt_slugtest00000001';

function assertSuccessShape(result) {
  expect(result).to.be.an('object');
  expect(result).to.have.property('id').that.is.a('string').and.not.empty;
  expect(result).to.not.have.property('_id');
  expect(result).to.have.property('status').that.is.a('string');
  expect(result).to.have.property('created').that.is.a('number');
  expect(result).to.have.property('updated').that.is.a('number');
}

async function catchError(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
}

async function cleanup() {
  const Model = CreatorCard.raw();
  await Model.deleteMany({
    creator_reference: {
      $in: [CRT_ONE, CRT_TWO, CRT_THREE, CRT_FOUR, CRT_FIVE, CRT_DRAFT, CRT_SLUG],
    },
  });
  await Model.deleteMany({
    slug: {
      $in: [
        'george-cooks',
        'ada-designs-things',
        'vip-rate-card',
        'my-draft-card',
        'unique-title-here',
      ],
    },
  });
  await Model.deleteMany({ slug: { $regex: /^&del:/ } });
}

describe('Creator Card API', function () {
  this.timeout(30000);

  let connectionResult;

  before(async function () {
    if (!process.env.MONGODB_URI) {
      this.skip();
    }
    connectionResult = await createConnection({ uri: process.env.MONGODB_URI });
    await cleanup();
  });

  after(async () => {
    if (connectionResult?.connection) {
      await cleanup();
      await connectionResult.connection.close();
    }
  });

  describe('POST /creator-cards', () => {
    it('creates a full public card with access_type defaulting to public', async () => {
      const result = await createCreatorCard({
        title: 'George Cooks',
        description: 'Weekly cooking podcast',
        slug: 'george-cooks',
        creator_reference: CRT_ONE,
        links: [{ title: 'YouTube', url: 'https://youtube.com/@georgecooks' }],
        service_rates: {
          currency: 'NGN',
          rates: [{ name: 'IG Story Post', description: 'One story mention', amount: 5000000 }],
        },
        status: 'published',
      });

      assertSuccessShape(result);
      expect(result.slug).to.equal('george-cooks');
      expect(result.access_type).to.equal('public');
      expect(result.title).to.equal('George Cooks');
      expect(result.description).to.equal('Weekly cooking podcast');
      expect(result.deleted).to.be.null;
      expect(result).to.have.property('access_code', null);
    });

    it('auto-generates a slug from the card title when slug is omitted', async () => {
      const result = await createCreatorCard({
        title: 'Ada Designs Things',
        creator_reference: CRT_TWO,
        status: 'published',
      });

      assertSuccessShape(result);
      expect(result.slug).to.equal('ada-designs-things');
      expect(result.access_type).to.equal('public');
      expect(result).to.have.property('access_code', null);
    });

    it('creates a private card and returns the access_code in the response', async () => {
      const result = await createCreatorCard({
        title: 'VIP Rate Card',
        creator_reference: CRT_THREE,
        status: 'published',
        access_type: 'private',
        access_code: 'A1B2C3',
      });

      assertSuccessShape(result);
      expect(result.access_type).to.equal('private');
      expect(result).to.have.property('access_code', 'A1B2C3');
      expect(result.slug).to.equal('vip-rate-card');
    });

    it('creates a draft card with a client-provided slug', async () => {
      const result = await createCreatorCard({
        title: 'My Draft Card',
        creator_reference: CRT_DRAFT,
        status: 'draft',
        slug: 'my-draft-card',
      });

      assertSuccessShape(result);
      expect(result.slug).to.equal('my-draft-card');
      expect(result.status).to.equal('draft');
    });

    it('rejects a duplicate client-provided slug with SL02', async () => {
      const err = await catchError(() =>
        createCreatorCard({
          title: 'Another George',
          slug: 'george-cooks',
          creator_reference: CRT_FOUR,
          status: 'published',
        })
      );

      expect(err).to.exist;
      expect(err.errorCode).to.equal('SL02');
    });

    it('rejects a private card missing access_code with AC01', async () => {
      const err = await catchError(() =>
        createCreatorCard({
          title: 'Secret Card',
          creator_reference: CRT_FIVE,
          status: 'published',
          access_type: 'private',
        })
      );

      expect(err).to.exist;
      expect(err.errorCode).to.equal('AC01');
    });

    it('rejects a public card with access_code set with AC05', async () => {
      const err = await catchError(() =>
        createCreatorCard({
          title: 'Public Card',
          creator_reference: CRT_FIVE,
          status: 'published',
          access_type: 'public',
          access_code: 'A1B2C3',
        })
      );

      expect(err).to.exist;
      expect(err.errorCode).to.equal('AC05');
    });

    it('rejects an invalid status value with a validation error', async () => {
      const err = await catchError(() =>
        createCreatorCard({
          title: 'Bad Status Card',
          creator_reference: CRT_FIVE,
          status: 'archived',
        })
      );

      expect(err).to.exist;
      expect(err.isApplicationError).to.be.true;
      expect(err.errorCode).to.be.a('string').and.not.empty;
    });

    it('rejects a missing required field with a validation error', async () => {
      const err = await catchError(() =>
        createCreatorCard({
          creator_reference: CRT_FIVE,
          status: 'published',
        })
      );

      expect(err).to.exist;
      expect(err.isApplicationError).to.be.true;
    });
  });

  describe('GET /creator-cards/:slug', () => {
    it('retrieves a public published card successfully', async () => {
      const result = await getCreatorCard({ slug: 'george-cooks' });

      assertSuccessShape(result);
      expect(result.slug).to.equal('george-cooks');
      expect(result.status).to.equal('published');
      expect(result.access_type).to.equal('public');
    });

    it('omits access_code entirely from the retrieval response', async () => {
      const result = await getCreatorCard({ slug: 'george-cooks' });

      expect(result).to.not.have.property('access_code');
      expect(result).to.not.have.property('_id');
    });

    it('returns NF01 for a slug that does not exist', async () => {
      const err = await catchError(() =>
        getCreatorCard({ slug: 'does-not-exist-123' })
      );

      expect(err).to.exist;
      expect(err.errorCode).to.equal('NF01');
    });

    it('returns NF02 for a draft card', async () => {
      const err = await catchError(() =>
        getCreatorCard({ slug: 'my-draft-card' })
      );

      expect(err).to.exist;
      expect(err.errorCode).to.equal('NF02');
      expect(err.errorCode).to.not.equal('NF01');
    });

    it('returns AC03 when accessing a private card without an access_code', async () => {
      const err = await catchError(() =>
        getCreatorCard({ slug: 'vip-rate-card' })
      );

      expect(err).to.exist;
      expect(err.errorCode).to.equal('AC03');
    });

    it('returns AC04 when accessing a private card with the wrong access_code', async () => {
      const err = await catchError(() =>
        getCreatorCard({ slug: 'vip-rate-card', access_code: 'WRONG1' })
      );

      expect(err).to.exist;
      expect(err.errorCode).to.equal('AC04');
    });

    it('retrieves a private card successfully with the correct access_code', async () => {
      const result = await getCreatorCard({ slug: 'vip-rate-card', access_code: 'A1B2C3' });

      assertSuccessShape(result);
      expect(result.slug).to.equal('vip-rate-card');
      expect(result.access_type).to.equal('private');
      expect(result).to.not.have.property('access_code');
    });
  });

  describe('DELETE /creator-cards/:slug', () => {
    it('returns NF01 when deleting a slug that does not exist', async () => {
      const err = await catchError(() =>
        deleteCreatorCard({
          slug: 'does-not-exist-123',
          creator_reference: CRT_FIVE,
        })
      );

      expect(err).to.exist;
      expect(err.errorCode).to.equal('NF01');
    });

    it('soft-deletes a public card and returns it with a deleted timestamp', async () => {
      const result = await deleteCreatorCard({
        slug: 'ada-designs-things',
        creator_reference: CRT_TWO,
      });

      assertSuccessShape(result);
      expect(result.slug).to.equal('ada-designs-things');
      expect(result.deleted).to.be.a('number').and.above(0);
      expect(result).to.have.property('access_code', null);
    });

    it('includes the actual access_code in the delete response for private cards', async () => {
      const result = await deleteCreatorCard({
        slug: 'vip-rate-card',
        creator_reference: CRT_THREE,
      });

      assertSuccessShape(result);
      expect(result.deleted).to.be.a('number').and.above(0);
      expect(result).to.have.property('access_code', 'A1B2C3');
    });

    it('returns NF01 on GET after a card has been soft-deleted', async () => {
      const err = await catchError(() =>
        getCreatorCard({ slug: 'ada-designs-things' })
      );

      expect(err).to.exist;
      expect(err.errorCode).to.equal('NF01');
    });
  });

  describe('Slug generation', () => {
    after(async () => {
      const Model = CreatorCard.raw();
      await Model.deleteMany({ creator_reference: CRT_SLUG });
    });

    it('appends a suffix when the auto-generated slug is already taken', async () => {
      await createCreatorCard({
        title: 'Unique Title Here',
        creator_reference: CRT_SLUG,
        status: 'published',
        slug: 'unique-title-here',
      });

      const second = await createCreatorCard({
        title: 'Unique Title Here',
        creator_reference: CRT_SLUG,
        status: 'published',
      });

      assertSuccessShape(second);
      expect(second.slug).to.not.equal('unique-title-here');
      expect(second.slug).to.match(/^unique-title-here-/);
    });

    it('appends a suffix when the title produces a slug shorter than 5 characters', async () => {
      const result = await createCreatorCard({
        title: 'Ayo',
        creator_reference: CRT_SLUG,
        status: 'published',
      });

      assertSuccessShape(result);
      expect(result.slug.length).to.be.at.least(5);
      expect(result.slug).to.match(/^ayo-/);
    });
  });
});