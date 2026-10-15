import { describe, expect, expectTypeOf, it } from 'vitest';
import { ApiClientError, createFetchClient } from './client.js';

type Call = { url: string; init: RequestInit | undefined };

// A fake fetch that records calls and answers with a fixed status and body. No network.
function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(text, { status });
  };
  return { calls, fetchImpl };
}

describe('createFetchClient', () => {
  it('GET: role in the query, response decoded to bigint', async () => {
    const { calls, fetchImpl } = fakeFetch(200, {
      ref: 'tr-1',
      status: 'pending',
      elapsedMs: 10,
    });
    const api = createFetchClient('http://x', fetchImpl);
    const proof = await api.transferStatus({ ref: 'a/b', as: 'alice' });
    expect(proof.status).toBe('pending');
    expect(calls[0]?.url).toBe('http://x/api/transfers/a%2Fb?as=alice');
    expect(calls[0]?.init?.method).toBe('GET');
    expect(calls[0]?.init?.body).toBeUndefined();
  });

  it('POST: path param stripped from the body, bigint sent as a string', async () => {
    const { calls, fetchImpl } = fakeFetch(200, {
      ref: 'tr-2',
      status: 'confirmed',
      elapsedMs: 5,
    });
    const api = createFetchClient('', fetchImpl);
    await api.deposit({ as: 'bob', amountCents: 5000n });
    expect(calls[0]?.url).toBe('/api/deposits');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ as: 'bob', amountCents: '5000' });

    const { calls: c2, fetchImpl: f2 } = fakeFetch(500, {});
    await createFetchClient('', f2)
      .decideLines({ id: 'dinner', as: 'bob', decision: 'approved' })
      .catch(() => undefined);
    expect(c2[0]?.url).toBe('/api/expenses/dinner/decision');
    expect(JSON.parse(String(c2[0]?.init?.body))).toEqual({ as: 'bob', decision: 'approved' });
  });

  it('decodes money strings in responses', async () => {
    const { fetchImpl } = fakeFetch(200, {
      payouts: [],
      unclaimed: [{ member: 'charlie', amountCents: '4650' }],
      uncovered: { totalCents: '0', charges: [] },
      potCashCents: '14341',
    });
    const plan = await createFetchClient('', fetchImpl).proposeClose({ as: 'dave' });
    expect(plan.potCashCents).toBe(14341n);
    expectTypeOf(plan.potCashCents).toEqualTypeOf<bigint>();
  });

  it('inputs are typed: role required, unknown role rejected', () => {
    type Api = ReturnType<typeof createFetchClient>;
    expectTypeOf<Parameters<Api['getTrip']>[0]>().toEqualTypeOf<{
      as: 'alice' | 'bob' | 'charlie' | 'dave';
    }>();
    expectTypeOf<Parameters<Api['voidExpense']>[0]>().toEqualTypeOf<{
      id: string;
      as: 'dave';
    }>();
    type GetTripInput = Parameters<Api['getTrip']>[0];
    // @ts-expect-error mallory is not on the trip
    const bad: GetTripInput = { as: 'mallory' };
    void bad;
  });

  it('routes with no input can be called without arguments', async () => {
    const { calls, fetchImpl } = fakeFetch(200, { status: 'loading', fake: true });
    expect(await createFetchClient('', fetchImpl).aiStatus()).toEqual({
      status: 'loading',
      fake: true,
    });
    expect(calls[0]?.url).toBe('/api/ai/status');
  });

  it('maps an ApiError body to ApiClientError', async () => {
    const { fetchImpl } = fakeFetch(409, {
      error: { code: 'POT_NOT_SETTLED', message: '1 payout pending', action: 'Wait.' },
    });
    const err = await createFetchClient('', fetchImpl)
      .proposeClose({ as: 'dave' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ code: 'POT_NOT_SETTLED', action: 'Wait.', httpStatus: 409 });
  });

  it('maps a non-contract error, a bad response and a network failure to INTERNAL', async () => {
    const html = fakeFetch(502, '<html>bad gateway</html>');
    await expect(
      createFetchClient('', html.fetchImpl).getRates({ as: 'dave' }),
    ).rejects.toMatchObject({
      code: 'INTERNAL',
      httpStatus: 502,
    });

    const bad = fakeFetch(200, { potCashCents: 6.59 });
    await expect(
      createFetchClient('', bad.fetchImpl).getTrip({ as: 'dave' }),
    ).rejects.toMatchObject({
      code: 'INTERNAL',
    });

    const down = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(createFetchClient('', down).aiStatus()).rejects.toMatchObject({
      code: 'INTERNAL',
      httpStatus: 0,
    });
  });
});
