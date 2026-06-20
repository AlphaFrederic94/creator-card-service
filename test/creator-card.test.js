const { expect } = require('chai');
const { createConnection } = require('@app-core/mongoose');
const CreatorCard = require('@app/repository/creator-card');
const createCreatorCard = require('@app/services/creator-cards/create-card');
const getCreatorCard = require('@app/services/creator-cards/get-card');
const deleteCreatorCard = require('@app/services/creator-cards/delete-card');

const TEST_CREATOR_ONE = 'crt_testcreator00001';
const TEST_CREATOR_TWO = 'crt_testcreator00002';

async function cleanup() {
  const Model = CreatorCard.raw();
  await Model.deleteMany({
    creator_reference: { $in: [TEST_CREATOR_ONE, TEST_CREATOR_TWO] },
  });
  await Model.deleteMany({
    slug: { $in: ['creator-card-test', 'private-card-test', 'draft-card-test'] },
  });
}

describe('creator cards', function () {
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

  it('creates and retrieves a public card without leaking access_code', async () => {
    const created = await createCreatorCard({
      title: 'Creator Card Test',
      slug: 'creator-card-test',
      creator_reference: TEST_CREATOR_ONE,
      links: [{ title: 'Website', url: 'https://example.com' }],
      service_rates: {
        currency: 'USD',
        rates: [{ name: 'Post', description: 'One sponsored post', amount: 2500 }],
      },
      status: 'published',
    });

    const retrieved = await getCreatorCard({ slug: 'creator-card-test' });

    expect(created).to.include({ slug: 'creator-card-test', access_type: 'public' });
    expect(created).to.have.property('id').that.is.a('string');
    expect(created).to.not.have.property('_id');
    expect(created).to.have.property('access_code', null);
    expect(retrieved).to.not.have.property('access_code');
    expect(retrieved).to.not.have.property('_id');
  });

  it('enforces private access and omits access_code from retrieval', async () => {
    await createCreatorCard({
      title: 'Private Card Test',
      slug: 'private-card-test',
      creator_reference: TEST_CREATOR_TWO,
      status: 'published',
      access_type: 'private',
      access_code: 'A1B2C3',
    });

    let missingCode;
    try {
      await getCreatorCard({ slug: 'private-card-test' });
    } catch (error) {
      missingCode = error.errorCode;
    }

    let wrongCode;
    try {
      await getCreatorCard({ slug: 'private-card-test', access_code: 'WRONG1' });
    } catch (error) {
      wrongCode = error.errorCode;
    }

    const retrieved = await getCreatorCard({
      slug: 'private-card-test',
      access_code: 'A1B2C3',
    });

    expect(missingCode).to.equal('AC03');
    expect(wrongCode).to.equal('AC04');
    expect(retrieved).to.not.have.property('access_code');
  });

  it('soft deletes by slug and creator_reference', async () => {
    const deleted = await deleteCreatorCard({
      slug: 'creator-card-test',
      creator_reference: TEST_CREATOR_ONE,
    });

    let getAfterDeleteCode;
    try {
      await getCreatorCard({ slug: 'creator-card-test' });
    } catch (error) {
      getAfterDeleteCode = error.errorCode;
    }

    expect(deleted.deleted).to.be.a('number');
    expect(deleted).to.have.property('access_code', null);
    expect(getAfterDeleteCode).to.equal('NF01');
  });

  it('rejects duplicate client-provided slugs and non-integer rates', async () => {
    await createCreatorCard({
      title: 'Duplicate Source',
      slug: 'creator-card-test',
      creator_reference: TEST_CREATOR_ONE,
      status: 'published',
    });

    let duplicateCode;
    try {
      await createCreatorCard({
        title: 'Duplicate Target',
        slug: 'creator-card-test',
        creator_reference: TEST_CREATOR_TWO,
        status: 'published',
      });
    } catch (error) {
      duplicateCode = error.errorCode;
    }

    let amountCode;
    try {
      await createCreatorCard({
        title: 'Float Amount Card',
        creator_reference: TEST_CREATOR_TWO,
        service_rates: {
          currency: 'USD',
          rates: [{ name: 'Post', description: 'One post', amount: 10.5 }],
        },
        status: 'published',
      });
    } catch (error) {
      amountCode = error.errorCode;
    }

    expect(duplicateCode).to.equal('SL02');
    expect(amountCode).to.equal('VALIDATION_ERROR');
  });
});
