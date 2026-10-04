import { INVITE_CODE_CHARS, randomCode } from './invite-code';

describe('randomCode', () => {
  it('makes 8 characters from the unambiguous alphabet', () => {
    const code = randomCode();
    expect(code.length).toBe(8);
    for (const c of code) expect(INVITE_CODE_CHARS).toContain(c);
  });

  it('draws from the cryptographic random source, not Math.random', () => {
    const spy = spyOn(crypto, 'getRandomValues').and.callThrough();
    spyOn(Math, 'random').and.throwError('Math.random must not be used');
    randomCode(12);
    expect(spy).toHaveBeenCalled();
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 200 }, () => randomCode()));
    expect(codes.size).toBe(200);
  });
});
