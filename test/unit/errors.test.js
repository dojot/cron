const { errors, getErrors } = require('../../src/schemas/errors');

describe('Error', () => {
  it('Should handle the app errors', () => {
    const error = new Error(
      `Error: Error: ${JSON.stringify(
        errors.invalid.http.criterion
      )}; ${JSON.stringify(errors.invalid.name)};"object" text`
    );
    const errorList = getErrors(error);

    expect(errorList).toHaveLength(3);
    expect(errorList[0]).toEqual(errors.invalid.http.criterion);
    expect(errorList[1]).toEqual(errors.invalid.name);
    expect(errorList[2]).toEqual({ error: 100, message: '"object" text' });
  });
});
